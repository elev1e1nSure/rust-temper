use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct BackendKeyRule {
    pub key: String,
    pub on: String,
    pub off: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedSlider {
    pub min: f64,
    pub max: f64,
    pub step: f64,
    pub default_value: f64,
    pub label: String,
    pub value_format: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TweakDef {
    pub key: String,
    pub title: String,
    pub description: String,
    pub section: String,
    pub badge: Option<String>,
    pub backend_keys: Vec<BackendKeyRule>,
    pub advanced_slider: Option<AdvancedSlider>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientCfgState {
    pub states: HashMap<String, bool>,
    pub raw_values: HashMap<String, String>,
}

fn rule(key: &str, on: &str, off: &str) -> Vec<BackendKeyRule> {
    vec![BackendKeyRule {
        key: key.to_string(),
        on: on.to_string(),
        off: off.to_string(),
    }]
}

fn group(pairs: &[(&str, &str, &str)]) -> Vec<BackendKeyRule> {
    pairs
        .iter()
        .map(|(key, on, off)| BackendKeyRule {
            key: key.to_string(),
            on: on.to_string(),
            off: off.to_string(),
        })
        .collect()
}

/// Ported from RustForge's OPTIONS_CONFIG + CFG_RULES (src/config/options.ts, src-tauri/src/domain/cfg/rules.rs).
fn known_tweaks() -> Vec<TweakDef> {
    vec![
        TweakDef {
            key: "disableParasiticParams".to_string(),
            title: "Отключить все паразитные параметры".to_string(),
            description: "Функция отключает паразитные параметры игры, которые могут негативно влиять на производительность или мешать игровому процессу при этом не предоставляя ничего полезного".to_string(),
            section: "qol".to_string(),
            badge: Some("recommended".to_string()),
            backend_keys: group(&[
                ("global.showblood", "False", "True"),
                ("global.censorrecordings", "False", "True"),
                ("shoutcaststreamer.allowinternetstreams", "False", "True"),
                ("effects.hurtoverlay", "False", "True"),
                ("effects.hurtoverleyapplylighting", "False", "True"),
                ("effects.bloom", "False", "True"),
                ("effects.shafts", "False", "True"),
                ("effects.lensdirt", "False", "True"),
                ("graphics.branding", "False", "True"),
                ("gametip.showgametips", "False", "True"),
                ("ui.showbeltbarbinds", "False", "True"),
                ("effects.vignet", "False", "True"),
                ("global.processmidiinput", "False", "True"),
                ("player.cold_breath", "False", "True"),
                ("graphicssettings.billboardsfacecameraposition", "False", "True"),
                ("client.headbob", "False", "True"),
                ("client.hurtpunch", "False", "True"),
                ("graphicssettings.particleraycastbudget", "0", "100"),
                ("graphicssettings.pixellightcount", "0", "4"),
                ("water.quality", "0", "2"),
                ("render.instanced_rendering", "0", "1"),
                ("client.hascompletedtutorial", "True", "False"),
            ]),
            advanced_slider: None,
        },
        TweakDef {
            key: "reduceCameraShake".to_string(),
            title: "Уменьшить тряску камеры".to_string(),
            description: "Уменьшает тряску камеры при получении урона, взрывах и смене оружия".to_string(),
            section: "qol".to_string(),
            badge: Some("recommended".to_string()),
            backend_keys: group(&[
                ("client.clampscreenshake", "True", "False"),
                ("client.allowcameratiltondpv", "False", "True"),
                ("client.headbob", "False", "True"),
                ("client.hurtpunch", "False", "True"),
            ]),
            advanced_slider: None,
        },
        TweakDef {
            key: "accessibility.treemarkercolor".to_string(),
            title: "Улучшить видимость крестиков ночью".to_string(),
            description: "Улучшает видимость крестиков ночью, меняя их цвет на оранжевый".to_string(),
            section: "graphics".to_string(),
            badge: Some("recommended".to_string()),
            backend_keys: rule("accessibility.treemarkercolor", "2", "0"),
            advanced_slider: None,
        },
        TweakDef {
            key: "strobelight.forceoff".to_string(),
            title: "Отключить визуальные эффекты стробоскопов".to_string(),
            description: "Отключает визуальные эффекты стробоскопов, которые могут сильно влиять на производительность.".to_string(),
            section: "qol".to_string(),
            badge: Some("recommended".to_string()),
            backend_keys: rule("strobelight.forceoff", "1", "False"),
            advanced_slider: None,
        },
        TweakDef {
            key: "inventory.quickcraftdelay".to_string(),
            title: "Убрать задержку в меню быстрого крафта".to_string(),
            description: "Убирает надоедливую задержку между нажатием и началом крафта в меню быстрого крафта".to_string(),
            section: "interface".to_string(),
            badge: Some("recommended".to_string()),
            backend_keys: rule("inventory.quickcraftdelay", "0", "0.75"),
            advanced_slider: None,
        },
        TweakDef {
            key: "player.footik".to_string(),
            title: "Отключить деформацию ног".to_string(),
            description: "Отключает деформацию ног игрока относительно ландшафта. Может слегка повысить производительность.".to_string(),
            section: "graphics".to_string(),
            badge: None,
            backend_keys: rule("player.footik", "False", "True"),
            advanced_slider: None,
        },
        TweakDef {
            key: "hitnotify.notification_level".to_string(),
            title: "Серверные хитмаркеры попаданий".to_string(),
            description: "Переключает хитмаркеры в серверный режим: может появиться задержка, зато не будут отображаться неподтверждённые попадания.".to_string(),
            section: "interface".to_string(),
            badge: None,
            backend_keys: rule("hitnotify.notification_level", "2", "1"),
            advanced_slider: None,
        },
        TweakDef {
            key: "legs.enablelegs".to_string(),
            title: "Отключить отображение ног".to_string(),
            description: "Отключает отображение ног от первого лица, может помочь при PvP, стрельбе сверху вниз и слегка улучшить обзор.".to_string(),
            section: "graphics".to_string(),
            badge: None,
            backend_keys: rule("legs.enablelegs", "0", "1"),
            advanced_slider: None,
        },
        TweakDef {
            key: "client.bag_unclaim_duration".to_string(),
            title: "Ускорить удаление спальников".to_string(),
            description: "В несколько раз ускоряет удаление спальников на карте через крестик.".to_string(),
            section: "interface".to_string(),
            badge: None,
            backend_keys: rule("client.bag_unclaim_duration", "0", "2"),
            advanced_slider: None,
        },
        TweakDef {
            key: "effects.maxgibdist".to_string(),
            title: "Отключить обломки".to_string(),
            description: "Отключает обломки от сооружений, что может повысить производительность и помочь при рейде.".to_string(),
            section: "graphics".to_string(),
            badge: None,
            backend_keys: rule("effects.maxgibdist", "0", "150"),
            advanced_slider: None,
        },
        TweakDef {
            key: "sss.enabled".to_string(),
            title: "Отключить поверхностное рассеивание света".to_string(),
            description: "Отключает поверхностное рассеивание света на персонажах. Может повысить производительность.".to_string(),
            section: "graphics".to_string(),
            badge: None,
            backend_keys: rule("sss.enabled", "0", "1"),
            advanced_slider: None,
        },
        TweakDef {
            key: "gametip.server_event_tips".to_string(),
            title: "Включить уведомления об ивентах".to_string(),
            description: "Включает уведомления об ивентах. (Карго, аирдропы и т.д.)".to_string(),
            section: "interface".to_string(),
            badge: None,
            backend_keys: rule("gametip.server_event_tips", "True", "False"),
            advanced_slider: None,
        },
        TweakDef {
            key: "input.holdtime".to_string(),
            title: "Снизить задержку открытия радикального меню".to_string(),
            description: "Уменьшает задержку открытия радикальных меню.".to_string(),
            section: "interface".to_string(),
            badge: None,
            backend_keys: rule("input.holdtime", "0.1", "0.2"),
            advanced_slider: Some(AdvancedSlider {
                min: 0.05,
                max: 0.5,
                step: 0.05,
                default_value: 0.1,
                label: "Задержка (0.2 - стандартное значение, 0.1 - ускоренное)".to_string(),
                value_format: Some("{value}s".to_string()),
            }),
        },
        TweakDef {
            key: "console.erroroverlay".to_string(),
            title: "Отключить красные ошибки".to_string(),
            description: "Отключает красные ошибки в левом верхнем углу экрана.".to_string(),
            section: "interface".to_string(),
            badge: None,
            backend_keys: rule("console.erroroverlay", "0", "1"),
            advanced_slider: None,
        },
    ]
}

/// Rust cfg files store values quoted (`key "value"`); this strips the quotes.
fn parse_cfg(content: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with('#') {
            continue;
        }
        let Some(quote_start) = trimmed.find('"') else {
            continue;
        };
        let key = trimmed[..quote_start].trim();
        if key.is_empty() {
            continue;
        }
        let rest = &trimmed[quote_start + 1..];
        let Some(quote_end) = rest.find('"') else {
            continue;
        };
        map.insert(key.to_string(), rest[..quote_end].to_string());
    }
    map
}

fn read_cfg_file(path: &str) -> Result<String, String> {
    match std::fs::read_to_string(path) {
        Ok(c) => Ok(c),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

/// Writes `key "value"` into a cfg file, preserving other lines and indentation.
fn write_cfg_value(path: &str, key: &str, value: &str) -> Result<(), String> {
    let p = Path::new(path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let content = read_cfg_file(path)?;
    let mut found = false;
    let new_line = format!("{key} \"{value}\"");

    let mut lines: Vec<String> = content
        .lines()
        .map(|line| {
            if found {
                return line.to_string();
            }
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with('#') {
                return line.to_string();
            }
            let Some(quote_start) = trimmed.find('"') else {
                return line.to_string();
            };
            if trimmed[..quote_start].trim() == key {
                found = true;
                new_line.clone()
            } else {
                line.to_string()
            }
        })
        .collect();

    if !found {
        lines.push(new_line);
    }

    if p.exists() {
        let backup_path = format!("{path}.bak");
        std::fs::copy(path, &backup_path).map_err(|e| e.to_string())?;
    }

    std::fs::write(path, lines.join("\n") + "\n").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_known_tweaks() -> Vec<TweakDef> {
    known_tweaks()
}

/// A grouped tweak is considered "on" only if every backend key currently matches its on-value.
#[tauri::command]
pub fn read_client_cfg(path: String) -> Result<ClientCfgState, String> {
    let content = read_cfg_file(&path)?;
    let parsed = parse_cfg(&content);

    let mut states = HashMap::new();
    let mut raw_values = HashMap::new();

    for tweak in known_tweaks() {
        if tweak.backend_keys.is_empty() {
            continue;
        }

        let mut all_on = true;
        for bk in &tweak.backend_keys {
            match parsed.get(&bk.key) {
                Some(value) if value == &bk.on => {}
                _ => {
                    all_on = false;
                    break;
                }
            }
        }
        states.insert(tweak.key.clone(), all_on);

        if tweak.advanced_slider.is_some() {
            if let Some(first) = tweak.backend_keys.first() {
                if let Some(value) = parsed.get(&first.key) {
                    raw_values.insert(tweak.key.clone(), value.clone());
                }
            }
        }
    }

    Ok(ClientCfgState { states, raw_values })
}

#[tauri::command]
pub fn toggle_tweak(path: String, key: String, enabled: bool) -> Result<(), String> {
    let tweak = known_tweaks()
        .into_iter()
        .find(|t| t.key == key)
        .ok_or_else(|| format!("Неизвестный твик: {key}"))?;

    for bk in &tweak.backend_keys {
        let value = if enabled {
            match &tweak.advanced_slider {
                Some(slider) if bk.key == tweak.backend_keys[0].key => {
                    format!("{}", slider.default_value)
                }
                _ => bk.on.clone(),
            }
        } else {
            bk.off.clone()
        };
        write_cfg_value(&path, &bk.key, &value)?;
    }

    Ok(())
}

#[tauri::command]
pub fn set_tweak_slider(path: String, key: String, value: f64) -> Result<(), String> {
    let tweak = known_tweaks()
        .into_iter()
        .find(|t| t.key == key)
        .ok_or_else(|| format!("Неизвестный твик: {key}"))?;

    let Some(bk) = tweak.backend_keys.first() else {
        return Err(format!("У твика {key} нет backend-ключа"));
    };

    write_cfg_value(&path, &bk.key, &value.to_string())
}
