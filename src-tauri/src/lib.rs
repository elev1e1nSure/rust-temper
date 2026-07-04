mod known_commands;
mod keys_cfg;
mod rust_locator;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            rust_locator::find_keys_cfg,
            known_commands::get_known_commands,
            keys_cfg::read_keys_cfg,
            keys_cfg::write_keys_cfg,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
