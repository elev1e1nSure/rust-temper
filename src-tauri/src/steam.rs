#[cfg(all(windows, not(test)))]
use std::process::Command;

#[cfg(all(windows, not(test)))]
const PROCESS_NAMES: [&str; 6] = [
    "RustClient",
    "steam",
    "steamwebhelper",
    "gameoverlayui",
    "steamerrorreporter",
    "steamservice",
];

/// Stop Steam and the running Rust client before mutating game config files.
/// Steam/Rust can flush stale settings back to disk on shutdown, so this must
/// happen before the read-modify-write cycle starts.
#[cfg(all(windows, not(test)))]
pub(crate) fn unload_before_config_write() -> Result<(), String> {
    let names_literal = PROCESS_NAMES
        .iter()
        .map(|name| format!("'{name}'"))
        .collect::<Vec<_>>()
        .join(",");
    let wait_names_literal = PROCESS_NAMES
        .iter()
        .copied()
        .filter(|name| *name != "steamservice")
        .map(|name| format!("'{name}'"))
        .collect::<Vec<_>>()
        .join(",");

    let script = format!(
        "$ErrorActionPreference = 'SilentlyContinue'; \
         $names = @({names_literal}); \
         $waitNames = @({wait_names_literal}); \
         Get-Process -Name $names | Stop-Process -Force; \
         $deadline = (Get-Date).AddSeconds(8); \
         do {{ \
             Start-Sleep -Milliseconds 200; \
             $remaining = @(Get-Process -Name $waitNames); \
         }} while ($remaining.Count -gt 0 -and (Get-Date) -lt $deadline); \
         if ($remaining.Count -gt 0) {{ \
             Write-Error ('Processes still running: ' + (($remaining | Select-Object -ExpandProperty Name -Unique) -join ', ')); \
             exit 1; \
         }}"
    );

    use std::os::windows::process::CommandExt;
    // Suppress the console window powershell.exe would otherwise flash.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| format!("Не удалось выгрузить Steam перед записью конфига: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let details = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("PowerShell завершился с кодом {:?}", output.status.code())
        };
        return Err(format!(
            "Не удалось полностью выгрузить Steam перед записью конфига: {details}"
        ));
    }

    log::info!("Steam/Rust processes unloaded before config mutation");
    Ok(())
}

#[cfg(any(not(windows), test))]
pub(crate) fn unload_before_config_write() -> Result<(), String> {
    Ok(())
}

/// Whether the Rust game client is currently running. The UI polls this to gate
/// all config editing behind a blocking overlay: while Rust is open it would
/// flush its in-memory settings over any client.cfg/keys.cfg edit on exit, so we
/// refuse to work until the player closes the game.
#[cfg(all(windows, not(test)))]
#[tauri::command]
pub fn is_rust_running() -> bool {
    use std::os::windows::process::CommandExt;
    // Suppress the console window tasklist would otherwise flash on each poll.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    match Command::new("tasklist")
        .args(["/FI", "IMAGENAME eq RustClient.exe", "/NH", "/FO", "CSV"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        Ok(output) => String::from_utf8_lossy(&output.stdout)
            .to_ascii_lowercase()
            .contains("rustclient.exe"),
        Err(error) => {
            // Fail open: a broken probe must not permanently lock the UI.
            log::warn!("is_rust_running: tasklist failed: {error}");
            false
        }
    }
}

#[cfg(any(not(windows), test))]
#[tauri::command]
pub fn is_rust_running() -> bool {
    false
}
