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
    ],
    // Tiers 0/1 and 2/3 collapse to the same preset on disk, so reads round to 1 or 2.
    read: ReadSpec::Lookup {
        key: "graphicssettings.shadowqualitypreset",
        map: &[("2", 2), ("0", 1)],
        default: 1,
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
        &[("water.quality", "0"), ("water.reflections", "0")],
        &[("water.quality", "0"), ("water.reflections", "1")],
        &[("water.quality", "0"), ("water.reflections", "2")],
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
        &[("graphics.volumetric_clouds", "4")],
        &[("graphics.volumetric_clouds", "4")],
    ],
    read: ReadSpec::Lookup {
        key: "graphics.volumetric_clouds",
        map: &[("0", 0), ("1", 1), ("4", 2)],
        default: 0,
    },
};

const SMOOTHING: Quality = Quality {
    label: "сглаживания",
    log_name: "Smoothing quality",
    tiers: &[
        &[("effects.sharpen", "True"), ("effects.antialiasing", "0")],
        &[("effects.sharpen", "True"), ("effects.antialiasing", "2")],
        &[("effects.sharpen", "True"), ("effects.antialiasing", "3")],
        &[("effects.sharpen", "True"), ("effects.antialiasing", "3")],
    ],
    read: ReadSpec::Lookup {
        key: "effects.antialiasing",
        map: &[("0", 0), ("1", 1), ("2", 1), ("3", 2)],
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
