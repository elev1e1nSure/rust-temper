use std::process::Command;

use serde::Serialize;
use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WRITE};
use winreg::RegKey;

use crate::steam_launch_options;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizationStatus {
    pcie_lpm: bool,
    hvci: bool,
    xbox_game_bar: bool,
    gc_buffer: bool,
}

#[tauri::command]
pub fn get_optimization_status() -> OptimizationStatus {
    OptimizationStatus {
        pcie_lpm: is_pcie_lpm_disabled().unwrap_or(false),
        hvci: is_hvci_disabled(),
        xbox_game_bar: is_xbox_game_bar_disabled(),
        gc_buffer: steam_launch_options::read_rust_gc_buffer()
            .ok()
            .flatten()
            .is_some(),
    }
}

#[tauri::command]
pub fn disable_pcie_lpm() -> Result<(), String> {
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
pub fn enable_pcie_lpm() -> Result<(), String> {
    run_elevated_powershell(
        r#"
        & powercfg.exe /setacvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 1
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        & powercfg.exe /setdcvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 1
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        & powercfg.exe /setactive SCHEME_CURRENT
        exit $LASTEXITCODE
        "#,
    )
}

#[tauri::command]
pub fn disable_hvci() -> Result<(), String> {
    run_elevated_powershell(
        r#"
        New-Item -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity' -Force | Out-Null
        New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity' -Name 'Enabled' -PropertyType DWord -Value 0 -Force | Out-Null
        "#,
    )
}

#[tauri::command]
pub fn enable_hvci() -> Result<(), String> {
    run_elevated_powershell(
        r#"
        New-Item -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity' -Force | Out-Null
        New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity' -Name 'Enabled' -PropertyType DWord -Value 1 -Force | Out-Null
        "#,
    )
}

#[tauri::command]
pub fn disable_xbox_game_bar() -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
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
        .and_then(|_| game_bar.set_value("AutoGameModeEnabled", &0_u32))
        .map_err(|err| format!("Не удалось отключить Xbox Game Bar: {err}"))
}

#[tauri::command]
pub fn enable_xbox_game_bar() -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (game_dvr, _) = hkcu
        .create_subkey_with_flags("System\\GameConfigStore", KEY_WRITE)
        .map_err(|err| format!("Не удалось открыть настройки Game DVR: {err}"))?;
    game_dvr
        .set_value("GameDVR_Enabled", &1_u32)
        .map_err(|err| format!("Не удалось включить Game DVR: {err}"))?;

    let (game_bar, _) = hkcu
        .create_subkey_with_flags("SOFTWARE\\Microsoft\\GameBar", KEY_WRITE)
        .map_err(|err| format!("Не удалось открыть настройки Xbox Game Bar: {err}"))?;
    game_bar
        .set_value("ShowStartupPanel", &1_u32)
        .and_then(|_| game_bar.set_value("AutoGameModeEnabled", &1_u32))
        .map_err(|err| format!("Не удалось включить Xbox Game Bar: {err}"))
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
        "$process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', '{encoded}'); exit $process.ExitCode"
    );
    run_powershell(&launcher).map(|_| ())
}

fn is_pcie_lpm_disabled() -> Result<bool, String> {
    let output = Command::new("powercfg.exe")
        .args(["/query", "SCHEME_CURRENT", "SUB_PCIEXPRESS", "ASPM"])
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
    Ok(values.len() >= 2 && values[values.len() - 2..].iter().all(|value| *value == 0))
}

fn is_hvci_disabled() -> bool {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key = hklm.open_subkey_with_flags(
        "SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity",
        KEY_READ,
    );
    key.and_then(|key| key.get_value::<u32, _>("Enabled"))
        .unwrap_or(0)
        == 0
}

fn is_xbox_game_bar_disabled() -> bool {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let game_dvr_disabled = hkcu
        .open_subkey_with_flags("System\\GameConfigStore", KEY_READ)
        .and_then(|key| key.get_value::<u32, _>("GameDVR_Enabled"))
        .is_ok_and(|value| value == 0);
    let game_bar_disabled = hkcu
        .open_subkey_with_flags("SOFTWARE\\Microsoft\\GameBar", KEY_READ)
        .and_then(|key| key.get_value::<u32, _>("ShowStartupPanel"))
        .is_ok_and(|value| value == 0);

    game_dvr_disabled && game_bar_disabled
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
