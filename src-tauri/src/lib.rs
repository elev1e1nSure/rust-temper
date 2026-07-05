mod keys_cfg;
mod known_commands;
mod rust_locator;
mod tweaks;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            rust_locator::find_keys_cfg,
            known_commands::get_known_commands,
            keys_cfg::read_keys_cfg,
            keys_cfg::write_keys_cfg,
            tweaks::get_known_tweaks,
            tweaks::read_client_cfg,
            tweaks::toggle_tweak,
            tweaks::set_tweak_slider,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
