mod client_cfg;
mod graphics;
mod keys_cfg;
mod known_commands;
mod rust_locator;
mod tweak_state;
mod tweaks;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
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
            graphics::apply_shadow_quality,
            graphics::read_shadow_quality,
            graphics::apply_texture_quality,
            graphics::read_texture_quality,
            graphics::apply_water_quality,
            graphics::read_water_quality,
            graphics::apply_lighting_quality,
            graphics::read_lighting_quality,
            graphics::apply_grass_quality,
            graphics::read_grass_quality,
            graphics::apply_clouds_quality,
            graphics::read_clouds_quality,
            graphics::apply_smoothing_quality,
            graphics::read_smoothing_quality,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
