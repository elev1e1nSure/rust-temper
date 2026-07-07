//! Graphics quality settings for client.cfg.
//!
//! Every setting is a discrete slider whose position ("tier") maps to a bundle
//! of raw config keys. Adding a new setting is data-only: declare a `Quality`
//! descriptor below, expose two thin command wrappers, and register them in
//! `lib.rs`. The read/write mechanics are shared and never duplicated per key.

use crate::client_cfg;
use std::collections::BTreeMap;
use std::path::Path;

/// One tier = the set of `(config key, value)` pairs written together for that
/// slider position.
type TierConfig = &'static [(&'static str, &'static str)];

/// How to reverse-map an on-disk config back to a tier index for the UI.
enum ReadSpec {
    /// Look up a single key and translate its value to a tier index.
    Lookup {
        key: &'static str,
        /// Ordered `(config value, tier)` pairs. First match wins.
        map: &'static [(&'static str, u32)],
        /// Tier used when the key is missing or holds an unexpected value.
        default: u32,
    },
    /// Bespoke detection for settings a single key can't describe.
    Custom(fn(&BTreeMap<String, String>) -> u32),
}

/// A graphics quality setting: the tiers it can write and how to read them back.
struct Quality {
    /// Genitive name spliced into range-error messages, e.g. `"качества теней"`.
    label: &'static str,
    /// Stable identifier for log lines.
    log_name: &'static str,
    tiers: &'static [TierConfig],
    read: ReadSpec,
}

impl Quality {
    /// Write the config bundle for `tier` into the file at `path`.
    fn apply(&self, path: &str, tier: u32) -> Result<(), String> {
        // Graphics tiers share the same client.cfg that tweaks mutate, so they
        // must take the same process-wide lock to avoid lost-update races.
        let _guard = client_cfg::operation_lock()?;
        let config = self.tiers.get(tier as usize).ok_or_else(|| {
            format!(
                "Недопустимый уровень {}: {tier}. Допустимый диапазон: 0..{}",
                self.label,
                self.tiers.len().saturating_sub(1)
            )
        })?;

        let cfg_path = Path::new(path);
        let content = client_cfg::read(cfg_path)?;

        let changes: BTreeMap<String, Option<String>> = config
            .iter()
            .map(|(key, value)| (key.to_string(), Some(value.to_string())))
            .collect();

        let updated = client_cfg::apply_values(&content, &changes);
        client_cfg::write_atomic(cfg_path, &updated)?;

        log::info!("{} applied: path={path}, tier={tier}", self.log_name);
        Ok(())
    }

    /// Infer the current tier from the config file at `path`.
    fn read(&self, path: &str) -> Result<u32, String> {
        let content = client_cfg::read(Path::new(path))?;
        let parsed = client_cfg::parse(&content);

        let tier = match &self.read {
            ReadSpec::Lookup { key, map, default } => match parsed.get(*key) {
                None => *default,
                Some(value) => map
                    .iter()
                    .find(|(candidate, _)| candidate == value)
                    .map(|(_, tier)| *tier)
                    .unwrap_or_else(|| {
                        log::warn!(
                            "Unexpected {key} value: {value:?}, falling back to tier {default}"
                        );
                        *default
                    }),
            },
            ReadSpec::Custom(detect) => detect(&parsed),
        };

        Ok(tier)
    }
}

// --- Setting descriptors -----------------------------------------------------

const SHADOWS: Quality = Quality {
    label: "качества теней",
    log_name: "Shadow quality",
    tiers: &[
        &[
            ("graphics.shadowlights", "1"),
            ("graphicssettings.shadowqualitypreset", "0"),
        ],
        &[
            ("graphics.shadowlights", "1"),
            ("graphicssettings.shadowqualitypreset", "2"),
        ],
    ],
    read: ReadSpec::Lookup {
        key: "graphicssettings.shadowqualitypreset",
        map: &[("0", 0), ("2", 1)],
        default: 0,
    },
};

const TEXTURES: Quality = Quality {
    label: "качества текстур",
    log_name: "Texture quality",
    tiers: &[
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
    ],
    read: ReadSpec::Lookup {
        key: "graphicssettings.globaltexturemipmaplimit",
        map: &[("0", 0), ("1", 1), ("2", 2), ("3", 3)],
        default: 0,
    },
};

const WATER: Quality = Quality {
    label: "качества воды",
    log_name: "Water quality",
    tiers: &[
        &[("water.reflections", "0")],
        &[("water.reflections", "1")],
        &[("water.reflections", "2")],
    ],
    read: ReadSpec::Lookup {
        key: "water.reflections",
        map: &[("0", 0), ("1", 1), ("2", 2)],
        default: 0,
    },
};

const LIGHTING: Quality = Quality {
    label: "качества освещения",
    log_name: "Lighting quality",
    tiers: &[
        &[
            ("graphics.contactshadows", "False"),
            ("effects.ao", "False"),
        ],
        &[("graphics.contactshadows", "False"), ("effects.ao", "True")],
        &[("graphics.contactshadows", "True"), ("effects.ao", "True")],
    ],
    read: ReadSpec::Custom(read_lighting_tier),
};

/// Lighting tier is defined by two independent flags, so it needs a joint check.
fn read_lighting_tier(parsed: &BTreeMap<String, String>) -> u32 {
    let ao = parsed.get("effects.ao").map(String::as_str).unwrap_or("");
    let contact = parsed
        .get("graphics.contactshadows")
        .map(String::as_str)
        .unwrap_or("");

    match (ao, contact) {
        ("True", "True") => 2,
        ("True", _) => 1,
        _ => 0,
    }
}

const GRASS: Quality = Quality {
    label: "качества травы",
    log_name: "Grass quality",
    tiers: &[
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
    ],
    read: ReadSpec::Lookup {
        key: "grass.quality",
        map: &[("0", 0), ("50", 1), ("100", 2)],
        default: 2,
    },
};

const CLOUDS: Quality = Quality {
    label: "качества облаков",
    log_name: "Clouds quality",
    tiers: &[
        &[("graphics.volumetric_clouds", "0")],
        &[("graphics.volumetric_clouds", "1")],
        &[("graphics.volumetric_clouds", "2")],
        &[("graphics.volumetric_clouds", "4")],
    ],
    read: ReadSpec::Lookup {
        key: "graphics.volumetric_clouds",
        map: &[("0", 0), ("1", 1), ("2", 2), ("4", 3)],
        default: 0,
    },
};

const SMOOTHING: Quality = Quality {
    label: "сглаживания",
    log_name: "Smoothing quality",
    tiers: &[
        &[("effects.sharpen", "True"), ("effects.antialiasing", "0")],
        &[("effects.sharpen", "True"), ("effects.antialiasing", "1")],
        &[("effects.sharpen", "True"), ("effects.antialiasing", "2")],
        &[("effects.sharpen", "True"), ("effects.antialiasing", "3")],
    ],
    read: ReadSpec::Lookup {
        key: "effects.antialiasing",
        map: &[("0", 0), ("1", 1), ("2", 2), ("3", 3)],
        default: 0,
    },
};

// --- Command wrappers --------------------------------------------------------

#[tauri::command]
pub fn apply_shadow_quality(path: String, tier: u32) -> Result<(), String> {
    SHADOWS.apply(&path, tier)
}

#[tauri::command]
pub fn read_shadow_quality(path: String) -> Result<u32, String> {
    SHADOWS.read(&path)
}

#[tauri::command]
pub fn apply_texture_quality(path: String, tier: u32) -> Result<(), String> {
    TEXTURES.apply(&path, tier)
}

#[tauri::command]
pub fn read_texture_quality(path: String) -> Result<u32, String> {
    TEXTURES.read(&path)
}

#[tauri::command]
pub fn apply_water_quality(path: String, tier: u32) -> Result<(), String> {
    WATER.apply(&path, tier)
}

#[tauri::command]
pub fn read_water_quality(path: String) -> Result<u32, String> {
    WATER.read(&path)
}

#[tauri::command]
pub fn apply_lighting_quality(path: String, tier: u32) -> Result<(), String> {
    LIGHTING.apply(&path, tier)
}

#[tauri::command]
pub fn read_lighting_quality(path: String) -> Result<u32, String> {
    LIGHTING.read(&path)
}

#[tauri::command]
pub fn apply_grass_quality(path: String, tier: u32) -> Result<(), String> {
    GRASS.apply(&path, tier)
}

#[tauri::command]
pub fn read_grass_quality(path: String) -> Result<u32, String> {
    GRASS.read(&path)
}

#[tauri::command]
pub fn apply_clouds_quality(path: String, tier: u32) -> Result<(), String> {
    CLOUDS.apply(&path, tier)
}

#[tauri::command]
pub fn read_clouds_quality(path: String) -> Result<u32, String> {
    CLOUDS.read(&path)
}

#[tauri::command]
pub fn apply_smoothing_quality(path: String, tier: u32) -> Result<(), String> {
    SMOOTHING.apply(&path, tier)
}

#[tauri::command]
pub fn read_smoothing_quality(path: String) -> Result<u32, String> {
    SMOOTHING.read(&path)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── read_lighting_tier ────────────────────────────────────────────────────

    #[test]
    fn lighting_tier_both_false() {
        let mut map = BTreeMap::new();
        map.insert("effects.ao".into(), "False".into());
        map.insert("graphics.contactshadows".into(), "False".into());
        assert_eq!(read_lighting_tier(&map), 0);
    }

    #[test]
    fn lighting_tier_ao_only() {
        let mut map = BTreeMap::new();
        map.insert("effects.ao".into(), "True".into());
        map.insert("graphics.contactshadows".into(), "False".into());
        assert_eq!(read_lighting_tier(&map), 1);
    }

    #[test]
    fn lighting_tier_both_true() {
        let mut map = BTreeMap::new();
        map.insert("effects.ao".into(), "True".into());
        map.insert("graphics.contactshadows".into(), "True".into());
        assert_eq!(read_lighting_tier(&map), 2);
    }

    #[test]
    fn lighting_tier_contact_only() {
        let mut map = BTreeMap::new();
        map.insert("effects.ao".into(), "False".into());
        map.insert("graphics.contactshadows".into(), "True".into());
        // AO false, Contact true → tier 0 (first branch: "True","True" → 2, "True",_ → 1, _ → 0)
        assert_eq!(read_lighting_tier(&map), 0);
    }

    #[test]
    fn lighting_tier_missing_keys() {
        let map = BTreeMap::new();
        assert_eq!(read_lighting_tier(&map), 0);
    }

    // ── Quality::read via SHADOWS ─────────────────────────────────────────────

    #[test]
    fn shadows_read_tier_0() {
        let dir = std::env::temp_dir().join(format!("graphics_test_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(
            &path,
            b"graphicssettings.shadowqualitypreset \"0\"\ngraphics.shadowlights \"1\"\n",
        )
        .unwrap();
        assert_eq!(SHADOWS.read(path.to_str().unwrap()).unwrap(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn shadows_read_tier_1() {
        let dir = std::env::temp_dir().join(format!("graphics_test_sh1_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(
            &path,
            b"graphicssettings.shadowqualitypreset \"2\"\ngraphics.shadowlights \"1\"\n",
        )
        .unwrap();
        assert_eq!(SHADOWS.read(path.to_str().unwrap()).unwrap(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn shadows_read_missing_key_falls_to_default() {
        let dir = std::env::temp_dir().join(format!("graphics_test_shd_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(&path, b"otherkey \"0\"\n").unwrap();
        // default is 0
        assert_eq!(SHADOWS.read(path.to_str().unwrap()).unwrap(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn shadows_read_unexpected_value_falls_to_default() {
        let dir = std::env::temp_dir().join(format!("graphics_test_shu_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(&path, b"graphicssettings.shadowqualitypreset \"999\"\n").unwrap();
        // unexpected value → default 0
        assert_eq!(SHADOWS.read(path.to_str().unwrap()).unwrap(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── Quality::read via WATER ───────────────────────────────────────────────

    #[test]
    fn water_read_tier_0() {
        let dir = std::env::temp_dir().join(format!("graphics_test_w0_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(&path, b"water.reflections \"1\"\n").unwrap();
        assert_eq!(WATER.read(path.to_str().unwrap()).unwrap(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn water_read_tier_2() {
        let dir = std::env::temp_dir().join(format!("graphics_test_w2_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(&path, b"water.reflections \"2\"\n").unwrap();
        assert_eq!(WATER.read(path.to_str().unwrap()).unwrap(), 2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── Quality::read via CLOUDS ──────────────────────────────────────────────

    #[test]
    fn clouds_read_tier_3() {
        let dir = std::env::temp_dir().join(format!("graphics_test_c3_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(&path, b"graphics.volumetric_clouds \"4\"\n").unwrap();
        assert_eq!(CLOUDS.read(path.to_str().unwrap()).unwrap(), 3);
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── Quality::read via SMOOTHING ────────────────────────────────────────────

    #[test]
    fn smoothing_read_tier_0() {
        let dir = std::env::temp_dir().join(format!("graphics_test_sm0_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(
            &path,
            b"effects.antialiasing \"0\"\neffects.sharpen \"True\"\n",
        )
        .unwrap();
        assert_eq!(SMOOTHING.read(path.to_str().unwrap()).unwrap(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── Quality::read via GRASS ────────────────────────────────────────────────

    #[test]
    fn grass_read_tier_1() {
        let dir = std::env::temp_dir().join(format!("graphics_test_g1_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(
            &path,
            b"grass.quality \"50\"\ngrass.displacement \"True\"\ngraphics.grassshadows \"False\"\n",
        )
        .unwrap();
        assert_eq!(GRASS.read(path.to_str().unwrap()).unwrap(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── Quality::read via LIGHTING (custom) ────────────────────────────────────

    #[test]
    fn lighting_read_tier_0() {
        let dir = std::env::temp_dir().join(format!("graphics_test_l0_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(
            &path,
            b"effects.ao \"False\"\ngraphics.contactshadows \"False\"\n",
        )
        .unwrap();
        assert_eq!(LIGHTING.read(path.to_str().unwrap()).unwrap(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn lighting_read_tier_2() {
        let dir = std::env::temp_dir().join(format!("graphics_test_l2_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(
            &path,
            b"effects.ao \"True\"\ngraphics.contactshadows \"True\"\n",
        )
        .unwrap();
        assert_eq!(LIGHTING.read(path.to_str().unwrap()).unwrap(), 2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── Quality::apply + read round-trip ──────────────────────────────────────

    #[test]
    fn shadows_apply_then_read_roundtrip() {
        let dir = std::env::temp_dir().join(format!("graphics_rt_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(&path, b"").unwrap();
        SHADOWS.apply(path.to_str().unwrap(), 1).unwrap();
        assert_eq!(SHADOWS.read(path.to_str().unwrap()).unwrap(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn water_apply_then_read_roundtrip() {
        let dir = std::env::temp_dir().join(format!("graphics_rt_w_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(&path, b"").unwrap();
        WATER.apply(path.to_str().unwrap(), 2).unwrap();
        assert_eq!(WATER.read(path.to_str().unwrap()).unwrap(), 2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn textures_apply_then_read_roundtrip() {
        let dir = std::env::temp_dir().join(format!("graphics_rt_t_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(&path, b"").unwrap();
        TEXTURES.apply(path.to_str().unwrap(), 3).unwrap();
        assert_eq!(TEXTURES.read(path.to_str().unwrap()).unwrap(), 3);
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── Quality::apply error cases ────────────────────────────────────────────

    #[test]
    fn shadows_apply_invalid_tier() {
        let dir = std::env::temp_dir().join(format!("graphics_err_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(&path, b"").unwrap();
        let result = SHADOWS.apply(path.to_str().unwrap(), 99);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("качества теней"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn textures_apply_invalid_tier() {
        let dir = std::env::temp_dir().join(format!("graphics_err_t_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(&path, b"").unwrap();
        let result = TEXTURES.apply(path.to_str().unwrap(), 10);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("качества текстур"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── Quality::read missing file ────────────────────────────────────────────

    #[test]
    fn read_missing_file_returns_default() {
        let dir = std::env::temp_dir().join(format!("graphics_missing_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("nonexistent.cfg");
        // Missing file → read returns ""
        // Then parse returns empty map → default should apply
        assert_eq!(SHADOWS.read(path.to_str().unwrap()).unwrap(), 0);
    }

    // ── Command wrappers ─────────────────────────────────────────────────────

    #[test]
    fn command_apply_shadow_quality() {
        let dir = std::env::temp_dir().join(format!("gfx_cmd_s_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg").to_string_lossy().to_string();
        std::fs::write(&path, b"").unwrap();
        apply_shadow_quality(path.clone(), 1).unwrap();
        assert_eq!(read_shadow_quality(path).unwrap(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn command_read_shadow_quality_missing() {
        let dir = std::env::temp_dir().join(format!("gfx_cmd_sr_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg").to_string_lossy().to_string();
        assert_eq!(read_shadow_quality(path).unwrap(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn command_apply_texture_quality() {
        let dir = std::env::temp_dir().join(format!("gfx_cmd_t_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg").to_string_lossy().to_string();
        std::fs::write(&path, b"").unwrap();
        apply_texture_quality(path.clone(), 2).unwrap();
        assert_eq!(read_texture_quality(path).unwrap(), 2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn command_apply_water_quality() {
        let dir = std::env::temp_dir().join(format!("gfx_cmd_w_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg").to_string_lossy().to_string();
        std::fs::write(&path, b"").unwrap();
        apply_water_quality(path.clone(), 1).unwrap();
        assert_eq!(read_water_quality(path).unwrap(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn command_apply_lighting_quality() {
        let dir = std::env::temp_dir().join(format!("gfx_cmd_l_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg").to_string_lossy().to_string();
        std::fs::write(&path, b"").unwrap();
        apply_lighting_quality(path.clone(), 2).unwrap();
        assert_eq!(read_lighting_quality(path).unwrap(), 2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn command_apply_grass_quality() {
        let dir = std::env::temp_dir().join(format!("gfx_cmd_g_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg").to_string_lossy().to_string();
        std::fs::write(&path, b"").unwrap();
        apply_grass_quality(path.clone(), 0).unwrap();
        assert_eq!(read_grass_quality(path).unwrap(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn command_apply_clouds_quality() {
        let dir = std::env::temp_dir().join(format!("gfx_cmd_c_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg").to_string_lossy().to_string();
        std::fs::write(&path, b"").unwrap();
        apply_clouds_quality(path.clone(), 2).unwrap();
        assert_eq!(read_clouds_quality(path).unwrap(), 2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn command_apply_smoothing_quality() {
        let dir = std::env::temp_dir().join(format!("gfx_cmd_sm_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg").to_string_lossy().to_string();
        std::fs::write(&path, b"").unwrap();
        apply_smoothing_quality(path.clone(), 3).unwrap();
        assert_eq!(read_smoothing_quality(path).unwrap(), 3);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn command_apply_invalid_tier() {
        let dir = std::env::temp_dir().join(format!("gfx_cmd_e_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg").to_string_lossy().to_string();
        std::fs::write(&path, b"").unwrap();
        let result = apply_shadow_quality(path, 99);
        assert!(result.is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── Texture quality specific tiers ────────────────────────────────────────

    #[test]
    fn textures_read_all_tiers() {
        let dir = std::env::temp_dir().join(format!("graphics_allt_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        for (tier, value) in &[("0", 0), ("1", 1), ("2", 2), ("3", 3)] {
            std::fs::write(
                &path,
                format!("graphicssettings.globaltexturemipmaplimit \"{tier}\"\n"),
            )
            .unwrap();
            assert_eq!(TEXTURES.read(path.to_str().unwrap()).unwrap(), *value);
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── Clouds specific tiers ─────────────────────────────────────────────────

    #[test]
    fn clouds_read_all_tiers() {
        let dir = std::env::temp_dir().join(format!("graphics_allc_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        for (value, tier) in &[("0", 0), ("1", 1), ("2", 2), ("4", 3)] {
            std::fs::write(&path, format!("graphics.volumetric_clouds \"{value}\"\n")).unwrap();
            assert_eq!(CLOUDS.read(path.to_str().unwrap()).unwrap(), *tier);
        }
        let _ = std::fs::remove_dir_all(&dir);
    }
}
