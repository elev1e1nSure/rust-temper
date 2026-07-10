mod client_cfg;
mod graphics;
mod keys_cfg;
mod known_commands;
mod optimization;
mod rust_locator;
mod settings_backup;
mod steam;
mod steam_launch_options;
mod tweak_defs;
mod tweak_state;
mod tweaks;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            rust_locator::find_rust_install,
            known_commands::get_known_commands,
            keys_cfg::read_keys_cfg,
            keys_cfg::write_keys_cfg,
            tweaks::get_known_tweaks,
            tweaks::read_client_cfg,
            tweaks::toggle_tweak,
            tweaks::set_tweak_slider,
            graphics::apply_graphics_quality,
            graphics::read_graphics_quality,
            settings_backup::ensure_initial_game_settings_backup,
            settings_backup::get_game_settings_backup_status,
            settings_backup::restore_game_settings_backup,
            steam::is_rust_running,
            steam_launch_options::read_rust_launch_options,
            steam_launch_options::set_rust_launch_options,
            steam_launch_options::clear_rust_launch_options,
            optimization::disable_pcie_lpm,
            optimization::disable_hvci,
            optimization::disable_xbox_game_bar,
            optimization::apply_recommended_gc_buffer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
