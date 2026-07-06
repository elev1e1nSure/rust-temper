use crate::client_cfg;
use crate::keys_cfg;
use crate::tweak_state::{self, ActiveTweak, StoredValue};
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::path::Path;
use std::sync::{Mutex, OnceLock};

static TWEAK_OPERATION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

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
pub struct BindTweak {
    pub default_key: String,
    pub command: String,
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
    pub bind: Option<BindTweak>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tier_values: Option<Vec<Vec<String>>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientCfgState {
    pub states: HashMap<String, bool>,
    pub managed_states: HashMap<String, bool>,
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
            bind: None,
            tier_values: None,
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
            bind: None,
            tier_values: None,
        },
        TweakDef {
            key: "accessibility.treemarkercolor".to_string(),
            title: "Улучшить видимость крестиков ночью".to_string(),
            description: "Улучшает видимость крестиков ночью, меняя их цвет на оранжевый".to_string(),
            section: "graphics".to_string(),
            badge: Some("recommended".to_string()),
            backend_keys: rule("accessibility.treemarkercolor", "2", "0"),
            advanced_slider: None,
            bind: None,
            tier_values: None,
        },
        TweakDef {
            key: "strobelight.forceoff".to_string(),
            title: "Отключить визуальные эффекты стробоскопов".to_string(),
            description: "Отключает визуальные эффекты стробоскопов, которые могут сильно влиять на производительность.".to_string(),
            section: "qol".to_string(),
            badge: Some("recommended".to_string()),
            backend_keys: rule("strobelight.forceoff", "1", "False"),
            advanced_slider: None,
            bind: None,
            tier_values: None,
        },
        TweakDef {
            key: "inventory.quickcraftdelay".to_string(),
            title: "Убрать задержку в меню быстрого крафта".to_string(),
            description: "Убирает надоедливую задержку между нажатием и началом крафта в меню быстрого крафта".to_string(),
            section: "interface".to_string(),
            badge: Some("recommended".to_string()),
            backend_keys: rule("inventory.quickcraftdelay", "0", "0.75"),
            advanced_slider: None,
            bind: None,
            tier_values: None,
        },
        TweakDef {
            key: "player.footik".to_string(),
            title: "Отключить деформацию ног".to_string(),
            description: "Отключает деформацию ног игрока относительно ландшафта. Может слегка повысить производительность.".to_string(),
            section: "graphics".to_string(),
            badge: None,
            backend_keys: rule("player.footik", "False", "True"),
            advanced_slider: None,
            bind: None,
            tier_values: None,
        },
        TweakDef {
            key: "hitnotify.notification_level".to_string(),
            title: "Серверные хитмаркеры попаданий".to_string(),
            description: "Переключает хитмаркеры в серверный режим: может появиться задержка, зато не будут отображаться неподтверждённые попадания.".to_string(),
            section: "interface".to_string(),
            badge: None,
            backend_keys: rule("hitnotify.notification_level", "2", "1"),
            advanced_slider: None,
            bind: None,
            tier_values: None,
        },
        TweakDef {
            key: "legs.enablelegs".to_string(),
            title: "Отключить отображение ног".to_string(),
            description: "Отключает отображение ног от первого лица, может помочь при PvP, стрельбе сверху вниз и слегка улучшить обзор.".to_string(),
            section: "graphics".to_string(),
            badge: None,
            backend_keys: rule("legs.enablelegs", "0", "1"),
            advanced_slider: None,
            bind: None,
            tier_values: None,
        },
        TweakDef {
            key: "client.bag_unclaim_duration".to_string(),
            title: "Ускорить удаление спальников".to_string(),
            description: "В несколько раз ускоряет удаление спальников на карте через крестик.".to_string(),
            section: "interface".to_string(),
            badge: None,
            backend_keys: rule("client.bag_unclaim_duration", "0", "2"),
            advanced_slider: None,
            bind: None,
            tier_values: None,
        },
        TweakDef {
            key: "effects.maxgibdist".to_string(),
            title: "Отключить обломки".to_string(),
            description: "Отключает обломки от сооружений, что может повысить производительность и помочь при рейде.".to_string(),
            section: "graphics".to_string(),
            badge: None,
            backend_keys: rule("effects.maxgibdist", "0", "150"),
            advanced_slider: None,
            bind: None,
            tier_values: None,
        },
        TweakDef {
            key: "sss.enabled".to_string(),
            title: "Отключить поверхностное рассеивание света".to_string(),
            description: "Отключает поверхностное рассеивание света на персонажах. Может повысить производительность.".to_string(),
            section: "graphics".to_string(),
            badge: None,
            backend_keys: rule("sss.enabled", "0", "1"),
            advanced_slider: None,
            bind: None,
            tier_values: None,
        },
        TweakDef {
            key: "gametip.server_event_tips".to_string(),
            title: "Включить уведомления об ивентах".to_string(),
            description: "Включает уведомления об ивентах. (Карго, аирдропы и т.д.)".to_string(),
            section: "interface".to_string(),
            badge: None,
            backend_keys: rule("gametip.server_event_tips", "True", "False"),
            advanced_slider: None,
            bind: None,
            tier_values: None,
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
            bind: None,
            tier_values: None,
        },
        TweakDef {
            key: "console.erroroverlay".to_string(),
            title: "Отключить красные ошибки".to_string(),
            description: "Отключает красные ошибки в левом верхнем углу экрана.".to_string(),
            section: "interface".to_string(),
            badge: None,
            backend_keys: rule("console.erroroverlay", "0", "1"),
            advanced_slider: None,
            bind: None,
            tier_values: None,
        },
        TweakDef {
            key: "graphics.tree_quality".to_string(),
            title: "Качество деревьев".to_string(),
            description: "Детализация моделей деревьев и дальность их прорисовки. Заметно влияет на FPS в лесистой местности.".to_string(),
            section: "graphics".to_string(),
            badge: None,
            backend_keys: group(&[
                ("tree.meshes", "100", "100"),
                ("tree.quality", "200", "100"),
            ]),
            advanced_slider: Some(AdvancedSlider {
                min: 0.0,
                max: 3.0,
                step: 1.0,
                default_value: 0.0,
                label: "Уровень качества".to_string(),
                value_format: None,
            }),
            bind: None,
            tier_values: Some(vec![
                vec!["10".to_string(), "30".to_string()],
                vec!["50".to_string(), "100".to_string()],
                vec!["100".to_string(), "150".to_string()],
                vec!["100".to_string(), "200".to_string()],
            ]),
        },
    ]
}

#[tauri::command]
pub fn get_known_tweaks() -> Vec<TweakDef> {
    known_tweaks()
}

#[tauri::command]
pub fn read_client_cfg(app: tauri::AppHandle, path: String, keys_cfg_path: Option<String>) -> Result<ClientCfgState, String> {
    let _guard = operation_lock()?;
    let cfg_path = Path::new(&path);
    let content = client_cfg::read(cfg_path)?;
    let parsed = client_cfg::parse(&content);
    let state = tweak_state::load(&app)?;
    let config_key = tweak_state::config_key(cfg_path)?;
    let active_tweaks = state
        .configs
        .get(&config_key)
        .map(|config| &config.active_tweaks);

    let mut bind_map = BTreeMap::new();
    if let Some(ref keys_path) = keys_cfg_path {
        let keys_cfg_path = Path::new(keys_path);
        if keys_cfg_path.exists() {
            if let Ok(binds) = keys_cfg::load_binds(keys_cfg_path) {
                for bind in binds {
                    bind_map.insert(bind.key, bind.command);
                }
            }
        }
    }

    let mut states = HashMap::new();
    let mut managed_states = HashMap::new();
    let mut raw_values = HashMap::new();

    for tweak in known_tweaks() {
        if tweak.bind.is_some() {
            let bind_tweak = tweak.bind.as_ref().unwrap();
            let is_on = bind_map
                .get(&bind_tweak.default_key)
                .map(|cmd| cmd == &bind_tweak.command)
                .unwrap_or(false);
            states.insert(tweak.key.clone(), is_on);
            managed_states.insert(tweak.key.clone(), is_on);
        } else {
            let managed_tweak = active_tweaks.and_then(|active| active.get(&tweak.key));
            let expected_values = managed_tweak
                .map(|active| active.desired_values.clone())
                .unwrap_or_else(|| desired_values(&tweak));
            let is_on = !expected_values.is_empty()
                && expected_values
                    .iter()
                    .all(|(key, value)| parsed.get(key) == Some(value));
            states.insert(tweak.key.clone(), is_on);
            managed_states.insert(tweak.key.clone(), managed_tweak.is_some());

            if tweak.advanced_slider.is_some() {
                if let Some(ref tiers) = tweak.tier_values {
                    let tier_idx = tiers.iter().position(|tier| {
                        tweak
                            .backend_keys
                            .iter()
                            .enumerate()
                            .all(|(i, bk)| {
                                tier.get(i)
                                    .map_or(true, |expected| parsed.get(&bk.key) == Some(expected))
                            })
                    });
                    if let Some(idx) = tier_idx {
                        raw_values.insert(tweak.key.clone(), idx.to_string());
                    }
                } else if let Some(first) = tweak.backend_keys.first() {
                    if let Some(value) = parsed.get(&first.key) {
                        raw_values.insert(tweak.key.clone(), value.clone());
                    }
                }
            }
        }
    }

    Ok(ClientCfgState {
        states,
        managed_states,
        raw_values,
    })
}

#[tauri::command]
pub fn toggle_tweak(
    app: tauri::AppHandle,
    path: String,
    key: String,
    enabled: bool,
    force_unmanaged: bool,
    keys_cfg_path: Option<String>,
) -> Result<(), String> {
    let _guard = operation_lock()?;
    let tweak = known_tweaks()
        .into_iter()
        .find(|t| t.key == key)
        .ok_or_else(|| format!("Неизвестный твик: {key}"))?;

    if let Some(bind_tweak) = &tweak.bind {
        return toggle_bind_tweak(app, &tweak, bind_tweak, enabled, keys_cfg_path);
    }

    let cfg_path = Path::new(&path);
    let config_key = tweak_state::config_key(cfg_path)?;
    let content = client_cfg::read(cfg_path)?;
    let current_values = client_cfg::parse(&content);
    let mut state = tweak_state::load(&app)?;

    if enabled {
        enable_tweak(
            &app,
            cfg_path,
            &config_key,
            &content,
            &current_values,
            &mut state,
            &tweak,
        )
    } else {
        let is_managed = state
            .configs
            .get(&config_key)
            .map(|config| config.active_tweaks.contains_key(&tweak.key))
            .unwrap_or(false);
        if !is_managed {
            if force_unmanaged {
                return force_disable_unmanaged_tweak(cfg_path, &content, &tweak);
            }
            return Err(format!(
                "Твик {} включён вручную; требуется подтверждение перезаписи",
                tweak.key
            ));
        }
        disable_tweak(
            &app,
            cfg_path,
            &config_key,
            &content,
            &mut state,
            &tweak.key,
        )
    }
}

fn toggle_bind_tweak(
    _app: tauri::AppHandle,
    tweak: &TweakDef,
    bind_tweak: &BindTweak,
    enabled: bool,
    keys_cfg_path: Option<String>,
) -> Result<(), String> {
    let keys_path = keys_cfg_path
        .as_ref()
        .ok_or_else(|| "Не указан путь к keys.cfg".to_string())?;
    let keys_cfg_path = Path::new(keys_path);

    let mut binds = if keys_cfg_path.exists() {
        keys_cfg::load_binds(keys_cfg_path)?
    } else {
        Vec::new()
    };

    if enabled {
        binds.retain(|b| b.key != bind_tweak.default_key);
        binds.push(keys_cfg::KeyBind {
            key: bind_tweak.default_key.clone(),
            command: bind_tweak.command.clone(),
        });
        let mut content = String::new();
        for bind in &binds {
            content.push_str(&format!("bind {} {}\n", bind.key, bind.command));
        }
        client_cfg::write_atomic(keys_cfg_path, &content)?;
        log::info!("Bind tweak enabled: tweak={}, key={}", tweak.key, bind_tweak.default_key);
    } else {
        binds.retain(|b| b.key != bind_tweak.default_key);
        let mut content = String::new();
        for bind in &binds {
            content.push_str(&format!("bind {} {}\n", bind.key, bind.command));
        }
        client_cfg::write_atomic(keys_cfg_path, &content)?;
        log::info!("Bind tweak disabled: tweak={}, key={}", tweak.key, bind_tweak.default_key);
    }

    Ok(())
}

#[tauri::command]
pub fn set_tweak_slider(
    app: tauri::AppHandle,
    path: String,
    key: String,
    value: f64,
) -> Result<(), String> {
    let _guard = operation_lock()?;
    let tweak = known_tweaks()
        .into_iter()
        .find(|t| t.key == key)
        .ok_or_else(|| format!("Неизвестный твик: {key}"))?;
    let slider = tweak
        .advanced_slider
        .as_ref()
        .ok_or_else(|| format!("У твика {key} нет настраиваемого значения"))?;

    if !value.is_finite() || value < slider.min || value > slider.max {
        return Err(format!(
            "Значение {value} вне диапазона {}..{}",
            slider.min, slider.max
        ));
    }

    if let Some(tiers) = &tweak.tier_values {
        return set_tiered_slider(&app, &path, &key, value, &tweak, tiers);
    }

    let Some(bk) = tweak.backend_keys.first() else {
        return Err(format!("У твика {key} нет backend-ключа"));
    };

    let cfg_path = Path::new(&path);
    let config_key = tweak_state::config_key(cfg_path)?;
    let content = client_cfg::read(cfg_path)?;
    let mut state = tweak_state::load(&app)?;
    let previous_state = state.clone();
    let desired_value = value.to_string();

    let active_tweak = state
        .configs
        .get_mut(&config_key)
        .and_then(|config| config.active_tweaks.get_mut(&key))
        .ok_or_else(|| format!("Твик {key} не включён"))?;
    active_tweak
        .desired_values
        .insert(bk.key.clone(), desired_value.clone());

    log::info!(
        "Updating tweak slider: path={}, tweak={}, backend_key={}, value={}",
        path,
        key,
        bk.key,
        desired_value
    );
    tweak_state::save(&app, &state)?;

    let mut changes = BTreeMap::new();
    changes.insert(bk.key.clone(), Some(desired_value));
    let updated_content = client_cfg::apply_values(&content, &changes);
    if let Err(error) = client_cfg::write_atomic(cfg_path, &updated_content) {
        return Err(rollback_state(&app, &previous_state, error));
    }

    log::info!("Tweak slider updated: path={}, tweak={}", path, key);
    Ok(())
}

fn set_tiered_slider(
    app: &tauri::AppHandle,
    path: &str,
    key: &str,
    value: f64,
    tweak: &TweakDef,
    tiers: &[Vec<String>],
) -> Result<(), String> {
    let tier_idx = value as usize;
    let tier = tiers
        .get(tier_idx)
        .ok_or_else(|| format!("Индекс уровня {tier_idx} вне диапазона 0..{}", tiers.len()))?;

    let cfg_path = Path::new(path);
    let config_key = tweak_state::config_key(cfg_path)?;
    let content = client_cfg::read(cfg_path)?;
    let mut state = tweak_state::load(app)?;
    let previous_state = state.clone();

    {
        let active_tweak = state
            .configs
            .get_mut(&config_key)
            .and_then(|config| config.active_tweaks.get_mut(key))
            .ok_or_else(|| format!("Твик {key} не включён"))?;

        let mut applied_keys = Vec::new();
        for (i, bk) in tweak.backend_keys.iter().enumerate() {
            if let Some(tier_val) = tier.get(i) {
                active_tweak
                    .desired_values
                    .insert(bk.key.clone(), tier_val.clone());
                applied_keys.push(format!("{}={}", bk.key, tier_val));
            }
        }

        log::info!(
            "Updating tiered slider: path={}, tweak={}, tier={}, values=[{}]",
            path,
            key,
            tier_idx,
            applied_keys.join(", ")
        );
    }

    tweak_state::save(app, &state)?;

    let active_tweak = state
        .configs
        .get(&config_key)
        .and_then(|config| config.active_tweaks.get(key))
        .ok_or_else(|| format!("Твик {key} не включён"))?;

    let changes: BTreeMap<String, Option<String>> = active_tweak
        .desired_values
        .iter()
        .map(|(k, v)| (k.clone(), Some(v.clone())))
        .collect();
    let updated_content = client_cfg::apply_values(&content, &changes);
    if let Err(error) = client_cfg::write_atomic(cfg_path, &updated_content) {
        return Err(rollback_state(app, &previous_state, error));
    }

    log::info!("Tiered slider updated: path={}, tweak={}", path, key);
    Ok(())
}

fn enable_tweak(
    app: &tauri::AppHandle,
    cfg_path: &Path,
    config_key: &str,
    content: &str,
    current_values: &BTreeMap<String, String>,
    state: &mut tweak_state::TweakState,
    tweak: &TweakDef,
) -> Result<(), String> {
    let previous_state = state.clone();
    let desired_values = desired_values(tweak);
    let captured_values = desired_values
        .keys()
        .map(|backend_key| {
            (
                backend_key.clone(),
                StoredValue {
                    value: current_values.get(backend_key).cloned(),
                },
            )
        })
        .collect::<BTreeMap<_, _>>();
    let config = state.configs.entry(config_key.to_string()).or_default();

    if let Some(active_tweak) = config.active_tweaks.get(&tweak.key) {
        let desired_values = active_tweak.desired_values.clone();
        config.activation_order.retain(|key| key != &tweak.key);
        config.activation_order.push(tweak.key.clone());
        log::info!(
            "Reapplying managed tweak: path={}, tweak={}, applying={:?}",
            cfg_path.display(),
            tweak.key,
            desired_values
        );
        tweak_state::save(app, state)?;
        let changes = desired_values
            .into_iter()
            .map(|(key, value)| (key, Some(value)))
            .collect();
        let updated_content = client_cfg::apply_values(content, &changes);
        if let Err(error) = client_cfg::write_atomic(cfg_path, &updated_content) {
            return Err(rollback_state(app, &previous_state, error));
        }
        return Ok(());
    }

    // Shared keys keep the first untouched value until their final owner is disabled.
    for backend_key in desired_values.keys() {
        let already_owned = config
            .active_tweaks
            .values()
            .any(|active| active.desired_values.contains_key(backend_key));
        if !already_owned {
            config.baselines.insert(
                backend_key.clone(),
                StoredValue {
                    value: current_values.get(backend_key).cloned(),
                },
            );
        }
    }

    log::info!(
        "Enabling tweak: path={}, tweak={}, captured={:?}, applying={:?}",
        cfg_path.display(),
        tweak.key,
        captured_values,
        desired_values
    );
    config.active_tweaks.insert(
        tweak.key.clone(),
        ActiveTweak {
            captured_values,
            desired_values: desired_values.clone(),
        },
    );
    config.activation_order.push(tweak.key.clone());

    // Restore data must reach disk before any user configuration is changed.
    tweak_state::save(app, state)?;
    let changes = desired_values
        .into_iter()
        .map(|(key, value)| (key, Some(value)))
        .collect();
    let updated_content = client_cfg::apply_values(content, &changes);
    if let Err(error) = client_cfg::write_atomic(cfg_path, &updated_content) {
        return Err(rollback_state(app, &previous_state, error));
    }

    log::info!(
        "Tweak enabled: path={}, tweak={}",
        cfg_path.display(),
        tweak.key
    );
    Ok(())
}

fn force_disable_unmanaged_tweak(
    cfg_path: &Path,
    content: &str,
    tweak: &TweakDef,
) -> Result<(), String> {
    let changes = tweak
        .backend_keys
        .iter()
        .map(|backend_key| (backend_key.key.clone(), Some(backend_key.off.clone())))
        .collect();
    log::warn!(
        "Force-disabling unmanaged tweak with hardcoded values: path={}, tweak={}, applying={:?}",
        cfg_path.display(),
        tweak.key,
        changes
    );
    let updated_content = client_cfg::apply_values(content, &changes);
    client_cfg::write_atomic(cfg_path, &updated_content)?;
    log::info!(
        "Unmanaged tweak force-disabled: path={}, tweak={}",
        cfg_path.display(),
        tweak.key
    );
    Ok(())
}

fn disable_tweak(
    app: &tauri::AppHandle,
    cfg_path: &Path,
    config_key: &str,
    content: &str,
    state: &mut tweak_state::TweakState,
    tweak_key: &str,
) -> Result<(), String> {
    let previous_state = state.clone();
    let Some(config) = state.configs.get_mut(config_key) else {
        log::info!(
            "Ignoring repeated tweak disable: path={}, tweak={}",
            cfg_path.display(),
            tweak_key
        );
        return Ok(());
    };
    let Some(removed_tweak) = config.active_tweaks.remove(tweak_key) else {
        log::info!(
            "Ignoring repeated tweak disable: path={}, tweak={}",
            cfg_path.display(),
            tweak_key
        );
        return Ok(());
    };
    config.activation_order.retain(|key| key != tweak_key);

    let mut changes = BTreeMap::new();
    for backend_key in removed_tweak.desired_values.keys() {
        let remaining_value = config.activation_order.iter().rev().find_map(|active_key| {
            config
                .active_tweaks
                .get(active_key)
                .and_then(|active| active.desired_values.get(backend_key))
                .cloned()
        });

        if let Some(value) = remaining_value {
            changes.insert(backend_key.clone(), Some(value));
        } else {
            let baseline = config
                .baselines
                .remove(backend_key)
                .ok_or_else(|| format!("Нет сохранённого значения для {backend_key}"))?;
            changes.insert(backend_key.clone(), baseline.value);
        }
    }

    log::info!(
        "Disabling tweak: path={}, tweak={}, restoring={:?}",
        cfg_path.display(),
        tweak_key,
        changes
    );
    let updated_content = client_cfg::apply_values(content, &changes);
    client_cfg::write_atomic(cfg_path, &updated_content).map_err(|error| {
        log::error!(
            "Failed to disable tweak: path={}, tweak={}, error={}",
            cfg_path.display(),
            tweak_key,
            error
        );
        error
    })?;

    let config_is_empty = config.active_tweaks.is_empty();
    if config_is_empty {
        state.configs.remove(config_key);
    }

    if let Err(state_error) = tweak_state::save(app, state) {
        let restore_error = client_cfg::write_atomic(cfg_path, content).err();
        *state = previous_state;
        return Err(match restore_error {
            Some(error) => format!("{state_error}; также не удалось откатить client.cfg: {error}"),
            None => state_error,
        });
    }

    log::info!(
        "Tweak disabled: path={}, tweak={}",
        cfg_path.display(),
        tweak_key
    );
    Ok(())
}

fn desired_values(tweak: &TweakDef) -> BTreeMap<String, String> {
    if let Some(tiers) = &tweak.tier_values {
        if let Some(tier) = tiers.first() {
            return tweak
                .backend_keys
                .iter()
                .enumerate()
                .filter_map(|(i, bk)| {
                    tier.get(i)
                        .map(|val| (bk.key.clone(), val.clone()))
                })
                .collect();
        }
    }

    tweak
        .backend_keys
        .iter()
        .enumerate()
        .map(|(index, backend_key)| {
            let value = match &tweak.advanced_slider {
                Some(slider) if index == 0 => slider.default_value.to_string(),
                _ => backend_key.on.clone(),
            };
            (backend_key.key.clone(), value)
        })
        .collect()
}

fn rollback_state(
    app: &tauri::AppHandle,
    previous_state: &tweak_state::TweakState,
    operation_error: String,
) -> String {
    log::error!("Tweak operation failed: {operation_error}");
    match tweak_state::save(app, previous_state) {
        Ok(()) => operation_error,
        Err(rollback_error) => format!(
            "{operation_error}; также не удалось откатить состояние твиков: {rollback_error}"
        ),
    }
}

fn operation_lock() -> Result<std::sync::MutexGuard<'static, ()>, String> {
    TWEAK_OPERATION_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| "Внутренняя блокировка твиков повреждена".to_string())
}
