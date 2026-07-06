use crate::client_cfg;
use std::collections::BTreeMap;
use std::path::Path;

type TierConfig = &'static [(&'static str, &'static str)];

const SHADOW_TIERS: &[TierConfig] = &[
    &[
        ("graphics.shadowlights", "1"),
        ("graphicssettings.shadowqualitypreset", "0"),
    ],
    &[
        ("graphics.shadowlights", "1"),
        ("graphicssettings.shadowqualitypreset", "0"),
    ],
    &[
        ("graphics.shadowlights", "1"),
        ("graphicssettings.shadowqualitypreset", "2"),
    ],
    &[
        ("graphics.shadowlights", "1"),
        ("graphicssettings.shadowqualitypreset", "2"),
    ],
];

#[tauri::command]
pub fn apply_shadow_quality(path: String, tier: u32) -> Result<(), String> {
    let tier = tier as usize;

    let config = SHADOW_TIERS
        .get(tier)
        .ok_or_else(|| {
            format!(
                "Недопустимый уровень качества теней: {tier}. Допустимый диапазон: 0..{}",
                SHADOW_TIERS.len().saturating_sub(1)
            )
        })?;

    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;

    let changes: BTreeMap<String, Option<String>> = config
        .iter()
        .map(|(key, value)| (key.to_string(), Some(value.to_string())))
        .collect();

    let updated = client_cfg::apply_values(&content, &changes);
    client_cfg::write_atomic(cfg_path, &updated)?;

    log::info!("Shadow quality applied: path={path}, tier={tier}");
    Ok(())
}

#[tauri::command]
pub fn read_shadow_quality(path: String) -> Result<u32, String> {
    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;
    let parsed = client_cfg::parse(&content);

    match parsed.get("graphicssettings.shadowqualitypreset").map(String::as_str) {
        Some("2") => Ok(2),
        Some("0") | None => Ok(1),
        Some(other) => {
            log::warn!(
                "Unexpected shadowqualitypreset value: {other:?}, falling back to tier 1"
            );
            Ok(1)
        }
    }
}

const TEXTURE_TIERS: &[TierConfig] = &[
    &[
        ("graphicssettings.globaltexturemipmaplimit", "0"),
        ("graphics.af", "8"),
        ("graphics.lodbias", "1"),
        ("graphics.shaderlod", "5"),
        ("graphicssettings.anisotropicfiltering", "0"),
        ("mesh.quality", "150"),
        ("terrain.quality", "100"),
    ],
    &[
        ("graphicssettings.globaltexturemipmaplimit", "1"),
        ("graphics.af", "8"),
        ("graphics.lodbias", "1"),
        ("graphics.shaderlod", "3"),
        ("graphicssettings.anisotropicfiltering", "1"),
        ("mesh.quality", "150"),
        ("terrain.quality", "100"),
    ],
    &[
        ("graphicssettings.globaltexturemipmaplimit", "2"),
        ("graphics.af", "2"),
        ("graphics.lodbias", "0.6"),
        ("graphics.shaderlod", "2"),
        ("graphicssettings.anisotropicfiltering", "1"),
        ("mesh.quality", "30"),
        ("terrain.quality", "100"),
    ],
    &[
        ("graphicssettings.globaltexturemipmaplimit", "3"),
        ("graphics.af", "1"),
        ("graphics.lodbias", "0.5"),
        ("graphics.shaderlod", "1"),
        ("graphicssettings.anisotropicfiltering", "0"),
        ("mesh.quality", "0"),
        ("terrain.quality", "100"),
    ],
    &[
        ("graphicssettings.globaltexturemipmaplimit", "3"),
        ("graphics.af", "1"),
        ("graphics.lodbias", "0.5"),
        ("graphics.shaderlod", "1"),
        ("graphicssettings.anisotropicfiltering", "0"),
        ("mesh.quality", "0"),
        ("terrain.quality", "100"),
    ],
];

#[tauri::command]
pub fn apply_texture_quality(path: String, tier: u32) -> Result<(), String> {
    let tier = tier as usize;

    let config = TEXTURE_TIERS
        .get(tier)
        .ok_or_else(|| {
            format!(
                "Недопустимый уровень качества текстур: {tier}. Допустимый диапазон: 0..{}",
                TEXTURE_TIERS.len().saturating_sub(1)
            )
        })?;

    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;

    let changes: BTreeMap<String, Option<String>> = config
        .iter()
        .map(|(key, value)| (key.to_string(), Some(value.to_string())))
        .collect();

    let updated = client_cfg::apply_values(&content, &changes);
    client_cfg::write_atomic(cfg_path, &updated)?;

    log::info!("Texture quality applied: path={path}, tier={tier}");
    Ok(())
}

#[tauri::command]
pub fn read_texture_quality(path: String) -> Result<u32, String> {
    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;
    let parsed = client_cfg::parse(&content);

    match parsed.get("graphicssettings.globaltexturemipmaplimit").map(String::as_str) {
        Some("0") => Ok(0),
        Some("1") => Ok(1),
        Some("2") => Ok(2),
        Some("3") => Ok(3),
        None => Ok(0),
        Some(other) => {
            log::warn!(
                "Unexpected globaltexturemipmaplimit value: {other:?}, falling back to tier 0"
            );
            Ok(0)
        }
    }
}

const WATER_TIERS: &[TierConfig] = &[
    &[
        ("water.quality", "0"),
        ("water.reflections", "0"),
    ],
    &[
        ("water.quality", "0"),
        ("water.reflections", "1"),
    ],
    &[
        ("water.quality", "0"),
        ("water.reflections", "2"),
    ],
];

#[tauri::command]
pub fn apply_water_quality(path: String, tier: u32) -> Result<(), String> {
    let tier = tier as usize;

    let config = WATER_TIERS
        .get(tier)
        .ok_or_else(|| {
            format!(
                "Недопустимый уровень качества воды: {tier}. Допустимый диапазон: 0..{}",
                WATER_TIERS.len().saturating_sub(1)
            )
        })?;

    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;

    let changes: BTreeMap<String, Option<String>> = config
        .iter()
        .map(|(key, value)| (key.to_string(), Some(value.to_string())))
        .collect();

    let updated = client_cfg::apply_values(&content, &changes);
    client_cfg::write_atomic(cfg_path, &updated)?;

    log::info!("Water quality applied: path={path}, tier={tier}");
    Ok(())
}

#[tauri::command]
pub fn read_water_quality(path: String) -> Result<u32, String> {
    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;
    let parsed = client_cfg::parse(&content);

    match parsed.get("water.reflections").map(String::as_str) {
        Some("0") => Ok(0),
        Some("1") => Ok(1),
        Some("2") => Ok(2),
        None => Ok(0),
        Some(other) => {
            log::warn!(
                "Unexpected water.reflections value: {other:?}, falling back to tier 0"
            );
            Ok(0)
        }
    }
}

const LIGHTING_TIERS: &[TierConfig] = &[
    &[
        ("graphics.contactshadows", "False"),
        ("effects.ao", "False"),
    ],
    &[
        ("graphics.contactshadows", "False"),
        ("effects.ao", "True"),
    ],
    &[
        ("graphics.contactshadows", "True"),
        ("effects.ao", "True"),
    ],
];

#[tauri::command]
pub fn apply_lighting_quality(path: String, tier: u32) -> Result<(), String> {
    let tier = tier as usize;

    let config = LIGHTING_TIERS
        .get(tier)
        .ok_or_else(|| {
            format!(
                "Недопустимый уровень качества освещения: {tier}. Допустимый диапазон: 0..{}",
                LIGHTING_TIERS.len().saturating_sub(1)
            )
        })?;

    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;

    let changes: BTreeMap<String, Option<String>> = config
        .iter()
        .map(|(key, value)| (key.to_string(), Some(value.to_string())))
        .collect();

    let updated = client_cfg::apply_values(&content, &changes);
    client_cfg::write_atomic(cfg_path, &updated)?;

    log::info!("Lighting quality applied: path={path}, tier={tier}");
    Ok(())
}

#[tauri::command]
pub fn read_lighting_quality(path: String) -> Result<u32, String> {
    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;
    let parsed = client_cfg::parse(&content);

    let ao = parsed.get("effects.ao").map(String::as_str).unwrap_or("");
    let contact = parsed.get("graphics.contactshadows").map(String::as_str).unwrap_or("");

    match (ao, contact) {
        ("True", "True") => Ok(2),
        ("True", _) => Ok(1),
        _ => Ok(0),
    }
}

const GRASS_TIERS: &[TierConfig] = &[
    &[
        ("grass.displacement", "True"),
        ("grass.quality", "0"),
        ("graphics.grassshadows", "False"),
    ],
    &[
        ("grass.displacement", "True"),
        ("grass.quality", "50"),
        ("graphics.grassshadows", "False"),
    ],
    &[
        ("grass.displacement", "True"),
        ("grass.quality", "100"),
        ("graphics.grassshadows", "True"),
    ],
];

#[tauri::command]
pub fn apply_grass_quality(path: String, tier: u32) -> Result<(), String> {
    let tier = tier as usize;

    let config = GRASS_TIERS
        .get(tier)
        .ok_or_else(|| {
            format!(
                "Недопустимый уровень качества травы: {tier}. Допустимый диапазон: 0..{}",
                GRASS_TIERS.len().saturating_sub(1)
            )
        })?;

    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;

    let changes: BTreeMap<String, Option<String>> = config
        .iter()
        .map(|(key, value)| (key.to_string(), Some(value.to_string())))
        .collect();

    let updated = client_cfg::apply_values(&content, &changes);
    client_cfg::write_atomic(cfg_path, &updated)?;

    log::info!("Grass quality applied: path={path}, tier={tier}");
    Ok(())
}

#[tauri::command]
pub fn read_grass_quality(path: String) -> Result<u32, String> {
    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;
    let parsed = client_cfg::parse(&content);

    match parsed.get("grass.quality").map(String::as_str) {
        Some("0") => Ok(0),
        Some("50") => Ok(1),
        Some("100") => Ok(2),
        None => Ok(2),
        Some(other) => {
            log::warn!(
                "Unexpected grass.quality value: {other:?}, falling back to tier 2"
            );
            Ok(2)
        }
    }
}

const CLOUDS_TIERS: &[TierConfig] = &[
    &[("graphics.volumetric_clouds", "0")],
    &[("graphics.volumetric_clouds", "1")],
    &[("graphics.volumetric_clouds", "4")],
    &[("graphics.volumetric_clouds", "4")],
];

#[tauri::command]
pub fn apply_clouds_quality(path: String, tier: u32) -> Result<(), String> {
    let tier = tier as usize;

    let config = CLOUDS_TIERS
        .get(tier)
        .ok_or_else(|| {
            format!(
                "Недопустимый уровень качества облаков: {tier}. Допустимый диапазон: 0..{}",
                CLOUDS_TIERS.len().saturating_sub(1)
            )
        })?;

    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;

    let changes: BTreeMap<String, Option<String>> = config
        .iter()
        .map(|(key, value)| (key.to_string(), Some(value.to_string())))
        .collect();

    let updated = client_cfg::apply_values(&content, &changes);
    client_cfg::write_atomic(cfg_path, &updated)?;

    log::info!("Clouds quality applied: path={path}, tier={tier}");
    Ok(())
}

#[tauri::command]
pub fn read_clouds_quality(path: String) -> Result<u32, String> {
    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;
    let parsed = client_cfg::parse(&content);

    match parsed.get("graphics.volumetric_clouds").map(String::as_str) {
        Some("0") => Ok(0),
        Some("1") => Ok(1),
        Some("4") => Ok(2),
        None => Ok(0),
        Some(other) => {
            log::warn!(
                "Unexpected graphics.volumetric_clouds value: {other:?}, falling back to tier 0"
            );
            Ok(0)
        }
    }
}

const SMOOTHING_TIERS: &[TierConfig] = &[
    &[
        ("effects.sharpen", "True"),
        ("effects.antialiasing", "0"),
    ],
    &[
        ("effects.sharpen", "True"),
        ("effects.antialiasing", "2"),
    ],
    &[
        ("effects.sharpen", "True"),
        ("effects.antialiasing", "3"),
    ],
    &[
        ("effects.sharpen", "True"),
        ("effects.antialiasing", "3"),
    ],
];

#[tauri::command]
pub fn apply_smoothing_quality(path: String, tier: u32) -> Result<(), String> {
    let tier = tier as usize;

    let config = SMOOTHING_TIERS
        .get(tier)
        .ok_or_else(|| {
            format!(
                "Недопустимый уровень сглаживания: {tier}. Допустимый диапазон: 0..{}",
                SMOOTHING_TIERS.len().saturating_sub(1)
            )
        })?;

    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;

    let changes: BTreeMap<String, Option<String>> = config
        .iter()
        .map(|(key, value)| (key.to_string(), Some(value.to_string())))
        .collect();

    let updated = client_cfg::apply_values(&content, &changes);
    client_cfg::write_atomic(cfg_path, &updated)?;

    log::info!("Smoothing quality applied: path={path}, tier={tier}");
    Ok(())
}

#[tauri::command]
pub fn read_smoothing_quality(path: String) -> Result<u32, String> {
    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;
    let parsed = client_cfg::parse(&content);

    match parsed.get("effects.antialiasing").map(String::as_str) {
        Some("0") => Ok(0),
        Some("1") => Ok(1),
        Some("2") => Ok(2),
        Some("3") => Ok(2),
        None => Ok(0),
        Some(other) => {
            log::warn!(
                "Unexpected effects.antialiasing value: {other:?}, falling back to tier 0"
            );
            Ok(0)
        }
    }
}
