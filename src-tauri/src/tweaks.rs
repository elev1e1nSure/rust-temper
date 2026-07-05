use crate::client_cfg;
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

#[tauri::command]
pub fn get_known_tweaks() -> Vec<TweakDef> {
    known_tweaks()
}

#[tauri::command]
pub fn read_client_cfg(app: tauri::AppHandle, path: String) -> Result<ClientCfgState, String> {
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

    let mut states = HashMap::new();
    let mut raw_values = HashMap::new();

    for tweak in known_tweaks() {
        let is_active = active_tweaks
            .map(|active| active.contains_key(&tweak.key))
            .unwrap_or(false);
        states.insert(tweak.key.clone(), is_active);

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
pub fn toggle_tweak(
    app: tauri::AppHandle,
    path: String,
    key: String,
    enabled: bool,
) -> Result<(), String> {
    let _guard = operation_lock()?;
    let tweak = known_tweaks()
        .into_iter()
        .find(|t| t.key == key)
        .ok_or_else(|| format!("Неизвестный твик: {key}"))?;
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
    if let Err(error) = client_cfg::write_atomic(cfg_path, &updated_content, true) {
        return Err(rollback_state(&app, &previous_state, error));
    }

    log::info!("Tweak slider updated: path={}, tweak={}", path, key);
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

    if config.active_tweaks.contains_key(&tweak.key) {
        log::info!(
            "Ignoring repeated tweak enable: path={}, tweak={}",
            cfg_path.display(),
            tweak.key
        );
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
    if let Err(error) = client_cfg::write_atomic(cfg_path, &updated_content, true) {
        return Err(rollback_state(app, &previous_state, error));
    }

    log::info!(
        "Tweak enabled: path={}, tweak={}",
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
    client_cfg::write_atomic(cfg_path, &updated_content, true).map_err(|error| {
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
        let restore_error = client_cfg::write_atomic(cfg_path, content, false).err();
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
