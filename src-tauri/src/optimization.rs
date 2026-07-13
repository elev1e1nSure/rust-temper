use std::os::windows::process::CommandExt;
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::Manager;

/// Prevents a console window from flashing up when spawning powershell.exe.
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WRITE};
use winreg::RegKey;

use crate::client_cfg;
use crate::steam_launch_options;

const OPTIMIZATION_STATE_FILE: &str = "optimization-state.json";

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OptimizationBaselines {
    pcie_lpm: Option<PcieLpmBaseline>,
    hvci: Option<RegistryValue>,
    xbox_game_dvr: Option<RegistryValue>,
    xbox_game_bar: Option<RegistryValue>,
    game_mode: Option<RegistryValue>,
}

#[derive(Clone, Deserialize, Serialize)]
struct PcieLpmBaseline {
    ac: u32,
    dc: u32,
}

#[derive(Clone, Deserialize, Serialize)]
struct RegistryValue {
    existed: bool,
    value: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizationStatus {
    pcie_lpm: bool,
    hvci: bool,
    xbox_game_bar: bool,
    game_mode: bool,
    gc_buffer: bool,
}

#[tauri::command]
pub fn get_optimization_status(app: tauri::AppHandle) -> Result<OptimizationStatus, String> {
    let baselines = load_baselines(&app)?;
    Ok(OptimizationStatus {
        pcie_lpm: baselines.pcie_lpm.is_some() && is_pcie_lpm_disabled()?,
        hvci: baselines.hvci.is_some() && is_hvci_disabled()?,
        xbox_game_bar: baselines.xbox_game_dvr.is_some()
            && baselines.xbox_game_bar.is_some()
            && is_xbox_game_bar_disabled()?,
        game_mode: baselines.game_mode.is_some() && is_game_mode_enabled()?,
        gc_buffer: steam_launch_options::read_rust_gc_buffer()
            .unwrap_or_else(|error| {
                log::warn!("Unable to read Rust GC buffer status: {error}");
                None
            })
            .is_some(),
    })
}

#[tauri::command]
pub fn disable_pcie_lpm(app: tauri::AppHandle) -> Result<(), String> {
    let _guard = client_cfg::operation_lock()?;
    let mut state = load_baselines(&app)?;
    if state.pcie_lpm.is_none() {
        let (ac, dc) = pcie_lpm_values()?;
        state.pcie_lpm = Some(PcieLpmBaseline { ac, dc });
        save_baselines(&app, &state)?;
    }
    run_elevated_powershell(
        r#"
        & powercfg.exe /setacvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        & powercfg.exe /setdcvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        & powercfg.exe /setactive SCHEME_CURRENT
        exit $LASTEXITCODE
        "#,
    )
}

#[tauri::command]
pub fn enable_pcie_lpm(app: tauri::AppHandle) -> Result<(), String> {
    let _guard = client_cfg::operation_lock()?;
    let mut state = load_baselines(&app)?;
    let baseline = state
        .pcie_lpm
        .as_ref()
        .ok_or_else(|| "Нет сохранённых исходных значений PCIe LPM".to_string())?;
    let script = format!(
        r#"
        & powercfg.exe /setacvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM {}
        if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}
        & powercfg.exe /setdcvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM {}
        if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}
        & powercfg.exe /setactive SCHEME_CURRENT
        exit $LASTEXITCODE
        "#,
        baseline.ac, baseline.dc
    );
    run_elevated_powershell(&script)?;
    state.pcie_lpm = None;
    save_baselines(&app, &state)
}

#[tauri::command]
pub fn disable_hvci(app: tauri::AppHandle) -> Result<(), String> {
    let _guard = client_cfg::operation_lock()?;
    let mut state = load_baselines(&app)?;
    if state.hvci.is_none() {
        state.hvci = Some(read_registry_value(
            &RegKey::predef(HKEY_LOCAL_MACHINE),
            "SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity",
            "Enabled",
        )?);
        save_baselines(&app, &state)?;
    }
    run_elevated_powershell(
        r#"
        $ErrorActionPreference = 'Stop'
        New-Item -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity' -Force | Out-Null
        New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity' -Name 'Enabled' -PropertyType DWord -Value 0 -Force | Out-Null
        "#,
    )
}

#[tauri::command]
pub fn enable_hvci(app: tauri::AppHandle) -> Result<(), String> {
    let _guard = client_cfg::operation_lock()?;
    let mut state = load_baselines(&app)?;
    let baseline = state
        .hvci
        .as_ref()
        .ok_or_else(|| "Нет сохранённого исходного значения HVCI".to_string())?;
    let action = if baseline.existed {
        format!(
            "New-ItemProperty -Path $path -Name 'Enabled' -PropertyType DWord -Value {} -Force | Out-Null",
            baseline.value
        )
    } else {
        "Remove-ItemProperty -Path $path -Name 'Enabled' -ErrorAction SilentlyContinue".to_string()
    };
    let script = format!(
        "$ErrorActionPreference = 'Stop'; $path = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity'; New-Item -Path $path -Force | Out-Null; {action}"
    );
    run_elevated_powershell(&script)?;
    state.hvci = None;
    save_baselines(&app, &state)
}

#[tauri::command]
pub fn disable_xbox_game_bar(app: tauri::AppHandle) -> Result<(), String> {
    let _guard = client_cfg::operation_lock()?;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let mut state = load_baselines(&app)?;
    if state.xbox_game_dvr.is_none() {
        state.xbox_game_dvr = Some(read_registry_value(
            &hkcu,
            "System\\GameConfigStore",
            "GameDVR_Enabled",
        )?);
    }
    if state.xbox_game_bar.is_none() {
        state.xbox_game_bar = Some(read_registry_value(
            &hkcu,
            "SOFTWARE\\Microsoft\\GameBar",
            "ShowStartupPanel",
        )?);
    }
    save_baselines(&app, &state)?;

    let (game_dvr, _) = hkcu
        .create_subkey_with_flags("System\\GameConfigStore", KEY_WRITE)
        .map_err(|err| format!("Не удалось открыть настройки Game DVR: {err}"))?;
    game_dvr
        .set_value("GameDVR_Enabled", &0_u32)
        .map_err(|err| format!("Не удалось отключить Game DVR: {err}"))?;

    let (game_bar, _) = hkcu
        .create_subkey_with_flags("SOFTWARE\\Microsoft\\GameBar", KEY_WRITE)
        .map_err(|err| format!("Не удалось открыть настройки Xbox Game Bar: {err}"))?;
    game_bar
        .set_value("ShowStartupPanel", &0_u32)
        .map_err(|err| format!("Не удалось отключить Xbox Game Bar: {err}"))
}

#[tauri::command]
pub fn enable_xbox_game_bar(app: tauri::AppHandle) -> Result<(), String> {
    let _guard = client_cfg::operation_lock()?;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let mut state = load_baselines(&app)?;
    let game_dvr = state
        .xbox_game_dvr
        .as_ref()
        .ok_or_else(|| "Нет сохранённого исходного значения Game DVR".to_string())?;
    let game_bar = state
        .xbox_game_bar
        .as_ref()
        .ok_or_else(|| "Нет сохранённого исходного значения Xbox Game Bar".to_string())?;
    restore_registry_value(
        &hkcu,
        "System\\GameConfigStore",
        "GameDVR_Enabled",
        game_dvr,
    )?;
    restore_registry_value(
        &hkcu,
        "SOFTWARE\\Microsoft\\GameBar",
        "ShowStartupPanel",
        game_bar,
    )?;
    state.xbox_game_dvr = None;
    state.xbox_game_bar = None;
    save_baselines(&app, &state)
}

#[tauri::command]
pub fn enable_game_mode(app: tauri::AppHandle) -> Result<(), String> {
    let _guard = client_cfg::operation_lock()?;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let mut state = load_baselines(&app)?;
    if state.game_mode.is_none() {
        state.game_mode = Some(read_registry_value(
            &hkcu,
            "SOFTWARE\\Microsoft\\GameBar",
            "AutoGameModeEnabled",
        )?);
        save_baselines(&app, &state)?;
    }
    set_game_mode(true)
}

#[tauri::command]
pub fn disable_game_mode(app: tauri::AppHandle) -> Result<(), String> {
    let _guard = client_cfg::operation_lock()?;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let mut state = load_baselines(&app)?;
    let baseline = state
        .game_mode
        .as_ref()
        .ok_or_else(|| "Нет сохранённого исходного значения игрового режима".to_string())?;
    restore_registry_value(
        &hkcu,
        "SOFTWARE\\Microsoft\\GameBar",
        "AutoGameModeEnabled",
        baseline,
    )?;
    state.game_mode = None;
    save_baselines(&app, &state)
}

#[tauri::command]
pub fn apply_recommended_gc_buffer() -> Result<u32, String> {
    let total_memory_bytes =
        powershell_output("(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory")?
            .trim()
            .parse::<u64>()
            .map_err(|err| format!("Не удалось определить объём ОЗУ: {err}"))?;
    let total_memory_gb = total_memory_bytes / 1024 / 1024 / 1024;
    // Rust's GC buffer slider caps at 4096 MB in practice; higher values aren't
    // recognized by the engine, so scale up to that ceiling and stop there.
    let buffer_mb = match total_memory_gb {
        0..=8 => 2048,
        _ => 4096,
    };

    steam_launch_options::set_rust_gc_buffer(buffer_mb)?;
    Ok(buffer_mb)
}

#[tauri::command]
pub fn clear_rust_gc_buffer() -> Result<(), String> {
    steam_launch_options::clear_rust_gc_buffer()
}

fn run_elevated_powershell(script: &str) -> Result<(), String> {
    let encoded = encode_powershell(script);
    let launcher = format!(
        "$process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', '{encoded}'); exit $process.ExitCode"
    );
    run_powershell(&launcher).map(|_| ())
}

fn is_pcie_lpm_disabled() -> Result<bool, String> {
    let (ac, dc) = pcie_lpm_values()?;
    Ok(ac == 0 && dc == 0)
}

fn pcie_lpm_values() -> Result<(u32, u32), String> {
    let output = Command::new("powercfg.exe")
        .args(["/query", "SCHEME_CURRENT", "SUB_PCIEXPRESS", "ASPM"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|err| format!("Не удалось прочитать настройки PCIe LPM: {err}"))?;
    if !output.status.success() {
        return Err("Не удалось прочитать настройки PCIe LPM.".to_string());
    }

    let values: Vec<u32> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            line.rsplit_once("0x")
                .and_then(|(_, value)| value.split_whitespace().next())
                .and_then(|value| u32::from_str_radix(value, 16).ok())
        })
        .collect();
    if values.len() < 2 {
        return Err("В выводе powercfg отсутствуют значения PCIe LPM".to_string());
    }
    Ok((values[values.len() - 2], values[values.len() - 1]))
}

fn is_hvci_disabled() -> Result<bool, String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let value = read_registry_value(
        &hklm,
        "SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity",
        "Enabled",
    )?;
    Ok(!value.existed || value.value == 0)
}

fn is_xbox_game_bar_disabled() -> Result<bool, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let game_dvr = read_registry_value(&hkcu, "System\\GameConfigStore", "GameDVR_Enabled")?;
    let game_bar = read_registry_value(&hkcu, "SOFTWARE\\Microsoft\\GameBar", "ShowStartupPanel")?;
    Ok(game_dvr.existed && game_dvr.value == 0 && game_bar.existed && game_bar.value == 0)
}

fn is_game_mode_enabled() -> Result<bool, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let value = read_registry_value(&hkcu, "SOFTWARE\\Microsoft\\GameBar", "AutoGameModeEnabled")?;
    Ok(value.existed && value.value == 1)
}

fn set_game_mode(enabled: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (game_bar, _) = hkcu
        .create_subkey_with_flags("SOFTWARE\\Microsoft\\GameBar", KEY_WRITE)
        .map_err(|err| format!("Не удалось открыть настройки игрового режима: {err}"))?;
    game_bar
        .set_value("AutoGameModeEnabled", &(u32::from(enabled)))
        .map_err(|err| format!("Не удалось изменить состояние игрового режима: {err}"))
}

fn read_registry_value(root: &RegKey, path: &str, name: &str) -> Result<RegistryValue, String> {
    let key = match root.open_subkey_with_flags(path, KEY_READ) {
        Ok(key) => key,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(RegistryValue {
                existed: false,
                value: 0,
            });
        }
        Err(error) => {
            return Err(format!(
                "Не удалось прочитать раздел реестра {path}: {error}"
            ))
        }
    };
    match key.get_value::<u32, _>(name) {
        Ok(value) => Ok(RegistryValue {
            existed: true,
            value,
        }),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(RegistryValue {
            existed: false,
            value: 0,
        }),
        Err(error) => Err(format!(
            "Не удалось прочитать значение реестра {path}\\{name}: {error}"
        )),
    }
}

fn restore_registry_value(
    root: &RegKey,
    path: &str,
    name: &str,
    original: &RegistryValue,
) -> Result<(), String> {
    if original.existed {
        let (key, _) = root
            .create_subkey_with_flags(path, KEY_WRITE)
            .map_err(|error| format!("Не удалось открыть раздел реестра {path}: {error}"))?;
        return key.set_value(name, &original.value).map_err(|error| {
            format!("Не удалось восстановить значение реестра {path}\\{name}: {error}")
        });
    }

    let key = match root.open_subkey_with_flags(path, KEY_WRITE) {
        Ok(key) => key,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Не удалось открыть раздел реестра {path}: {error}")),
    };
    match key.delete_value(name) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Не удалось удалить восстановленное значение {path}\\{name}: {error}"
        )),
    }
}

fn load_baselines(app: &tauri::AppHandle) -> Result<OptimizationBaselines, String> {
    let path = optimization_state_path(app)?;
    let content = client_cfg::read(&path)?;
    if content.trim().is_empty() {
        return Ok(OptimizationBaselines::default());
    }
    serde_json::from_str(&content).map_err(|error| {
        format!(
            "Не удалось прочитать исходные значения оптимизаций {}: {error}",
            path.display()
        )
    })
}

fn save_baselines(app: &tauri::AppHandle, state: &OptimizationBaselines) -> Result<(), String> {
    let path = optimization_state_path(app)?;
    let content = serde_json::to_string_pretty(state)
        .map_err(|error| format!("Не удалось сохранить исходные значения: {error}"))?
        + "\n";
    client_cfg::write_atomic(&path, &content)
}

fn optimization_state_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(OPTIMIZATION_STATE_FILE))
        .map_err(|error| error.to_string())
}

fn powershell_output(script: &str) -> Result<String, String> {
    run_powershell(script)
}

fn run_powershell(script: &str) -> Result<String, String> {
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|err| format!("Не удалось запустить PowerShell: {err}"))?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }

    let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if message.is_empty() {
        "Операция отменена или завершилась с ошибкой.".to_string()
    } else {
        message
    })
}

fn encode_powershell(script: &str) -> String {
    const BASE64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes: Vec<u8> = script
        .encode_utf16()
        .flat_map(|unit| unit.to_le_bytes())
        .collect();
    let mut encoded = String::with_capacity(bytes.len().div_ceil(3) * 4);

    for chunk in bytes.chunks(3) {
        let first = chunk[0];
        let second = *chunk.get(1).unwrap_or(&0);
        let third = *chunk.get(2).unwrap_or(&0);
        encoded.push(BASE64[(first >> 2) as usize] as char);
        encoded.push(BASE64[(((first & 0b11) << 4) | (second >> 4)) as usize] as char);
        encoded.push(if chunk.len() > 1 {
            BASE64[(((second & 0b1111) << 2) | (third >> 6)) as usize] as char
        } else {
            '='
        });
        encoded.push(if chunk.len() > 2 {
            BASE64[(third & 0b11_1111) as usize] as char
        } else {
            '='
        });
    }

    encoded
}
