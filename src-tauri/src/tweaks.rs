use crate::client_cfg;
use crate::keys_cfg;
use crate::tweak_state::{self, ActiveTweak, ConfigState, StoredValue};
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::path::Path;

// ── Tweak operation transaction ──────────────────────────────────────────

struct TweakTx<'a> {
    app: &'a tauri::AppHandle,
    cfg_path: &'a Path,
    config_key: String,
    state: tweak_state::TweakState,
    previous_state: tweak_state::TweakState,
    content: String,
}

impl<'a> TweakTx<'a> {
    fn begin(app: &'a tauri::AppHandle, cfg_path: &'a Path) -> Result<Self, String> {
        let config_key = tweak_state::config_key(cfg_path)?;
        let content = client_cfg::read(cfg_path)?;
        let state = tweak_state::load(app)?;
        let previous_state = state.clone();
        Ok(Self { app, cfg_path, config_key, state, previous_state, content })
    }

    fn state_mut(&mut self) -> &mut tweak_state::TweakState {
        &mut self.state
    }

    fn commit(&mut self, changes: BTreeMap<String, Option<String>>) -> Result<(), String> {
        tweak_state::save(self.app, &self.state)?;
        let updated = client_cfg::apply_values(&self.content, &changes);
        if let Err(error) = client_cfg::write_atomic(self.cfg_path, &updated) {
            return Err(rollback_state(self.app, &self.previous_state, error));
        }
        Ok(())
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum TweakSection {
    Qol,
    Graphics,
    Interface,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum TweakBadge {
    Recommended,
}

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
    pub section: TweakSection,
    pub badge: Option<TweakBadge>,
    pub backend_keys: Vec<BackendKeyRule>,
    pub advanced_slider: Option<AdvancedSlider>,
    pub bind: Option<BindTweak>,
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
            section: TweakSection::Qol,
            badge: Some(TweakBadge::Recommended),
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
        },
        TweakDef {
            key: "reduceCameraShake".to_string(),
            title: "Уменьшить тряску камеры".to_string(),
            description: "Уменьшает тряску камеры при получении урона, взрывах и смене оружия".to_string(),
            section: TweakSection::Qol,
            badge: Some(TweakBadge::Recommended),
            backend_keys: group(&[
                ("client.clampscreenshake", "True", "False"),
                ("client.allowcameratiltondpv", "False", "True"),
                ("client.headbob", "False", "True"),
                ("client.hurtpunch", "False", "True"),
            ]),
            advanced_slider: None,
            bind: None,
        },
        TweakDef {
            key: "accessibility.treemarkercolor".to_string(),
            title: "Улучшить видимость крестиков ночью".to_string(),
            description: "Улучшает видимость крестиков ночью, меняя их цвет на оранжевый".to_string(),
            section: TweakSection::Graphics,
            badge: Some(TweakBadge::Recommended),
            backend_keys: rule("accessibility.treemarkercolor", "2", "0"),
            advanced_slider: None,
            bind: None,
        },
        TweakDef {
            key: "strobelight.forceoff".to_string(),
            title: "Отключить визуальные эффекты стробоскопов".to_string(),
            description: "Отключает визуальные эффекты стробоскопов, которые могут сильно влиять на производительность.".to_string(),
            section: TweakSection::Qol,
            badge: Some(TweakBadge::Recommended),
            backend_keys: rule("strobelight.forceoff", "1", "False"),
            advanced_slider: None,
            bind: None,
        },
        TweakDef {
            key: "inventory.quickcraftdelay".to_string(),
            title: "Убрать задержку в меню быстрого крафта".to_string(),
            description: "Убирает надоедливую задержку между нажатием и началом крафта в меню быстрого крафта".to_string(),
            section: TweakSection::Interface,
            badge: Some(TweakBadge::Recommended),
            backend_keys: rule("inventory.quickcraftdelay", "0", "0.75"),
            advanced_slider: None,
            bind: None,
        },
        TweakDef {
            key: "player.footik".to_string(),
            title: "Отключить деформацию ног".to_string(),
            description: "Отключает деформацию ног игрока относительно ландшафта. Может слегка повысить производительность.".to_string(),
            section: TweakSection::Graphics,
            badge: None,
            backend_keys: rule("player.footik", "False", "True"),
            advanced_slider: None,
            bind: None,
        },
        TweakDef {
            key: "hitnotify.notification_level".to_string(),
            title: "Серверные хитмаркеры попаданий".to_string(),
            description: "Переключает хитмаркеры в серверный режим: может появиться задержка, зато не будут отображаться неподтверждённые попадания.".to_string(),
            section: TweakSection::Interface,
            badge: None,
            backend_keys: rule("hitnotify.notification_level", "2", "1"),
            advanced_slider: None,
            bind: None,
        },
        TweakDef {
            key: "legs.enablelegs".to_string(),
            title: "Отключить отображение ног".to_string(),
            description: "Отключает отображение ног от первого лица, может помочь при PvP, стрельбе сверху вниз и слегка улучшить обзор.".to_string(),
            section: TweakSection::Graphics,
            badge: None,
            backend_keys: rule("legs.enablelegs", "0", "1"),
            advanced_slider: None,
            bind: None,
        },
        TweakDef {
            key: "client.bag_unclaim_duration".to_string(),
            title: "Ускорить удаление спальников".to_string(),
            description: "В несколько раз ускоряет удаление спальников на карте через крестик.".to_string(),
            section: TweakSection::Interface,
            badge: None,
            backend_keys: rule("client.bag_unclaim_duration", "0", "2"),
            advanced_slider: None,
            bind: None,
        },
        TweakDef {
            key: "effects.maxgibdist".to_string(),
            title: "Отключить обломки".to_string(),
            description: "Отключает обломки от сооружений, что может повысить производительность и помочь при рейде.".to_string(),
            section: TweakSection::Graphics,
            badge: None,
            backend_keys: rule("effects.maxgibdist", "0", "150"),
            advanced_slider: None,
            bind: None,
        },
        TweakDef {
            key: "sss.enabled".to_string(),
            title: "Отключить поверхностное рассеивание света".to_string(),
            description: "Отключает поверхностное рассеивание света на персонажах. Может повысить производительность.".to_string(),
            section: TweakSection::Graphics,
            badge: None,
            backend_keys: rule("sss.enabled", "0", "1"),
            advanced_slider: None,
            bind: None,
        },
        TweakDef {
            key: "gametip.server_event_tips".to_string(),
            title: "Включить уведомления об ивентах".to_string(),
            description: "Включает уведомления об ивентах. (Карго, аирдропы и т.д.)".to_string(),
            section: TweakSection::Interface,
            badge: None,
            backend_keys: rule("gametip.server_event_tips", "True", "False"),
            advanced_slider: None,
            bind: None,
        },
        TweakDef {
            key: "input.holdtime".to_string(),
            title: "Снизить задержку открытия радикального меню".to_string(),
            description: "Уменьшает задержку открытия радикальных меню.".to_string(),
            section: TweakSection::Interface,
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
        },
        TweakDef {
            key: "console.erroroverlay".to_string(),
            title: "Отключить красные ошибки".to_string(),
            description: "Отключает красные ошибки в левом верхнем углу экрана.".to_string(),
            section: TweakSection::Interface,
            badge: None,
            backend_keys: rule("console.erroroverlay", "0", "1"),
            advanced_slider: None,
            bind: None,
        },
    ]
}

#[tauri::command]
pub fn get_known_tweaks() -> Vec<TweakDef> {
    known_tweaks()
}

pub(crate) fn compute_tweak_states(
    tweaks: &[TweakDef],
    parsed: &BTreeMap<String, String>,
    active_tweaks: Option<&BTreeMap<String, ActiveTweak>>,
    bind_map: &BTreeMap<String, String>,
    keys_state_tweaks: Option<&BTreeMap<String, ActiveTweak>>,
) -> ClientCfgState {
    let mut states = HashMap::new();
    let mut managed_states = HashMap::new();
    let mut raw_values = HashMap::new();

    for tweak in tweaks {
        if let Some(bind_tweak) = &tweak.bind {
            let is_on = bind_map
                .get(&bind_tweak.default_key)
                .map(|cmd| cmd == &bind_tweak.command)
                .unwrap_or(false);
            let managed = keys_state_tweaks
                .and_then(|active| active.get(&tweak.key))
                .is_some();
            states.insert(tweak.key.clone(), is_on);
            managed_states.insert(tweak.key.clone(), managed);
        } else {
            let managed_tweak = active_tweaks.and_then(|active| active.get(&tweak.key));
            let expected_values = managed_tweak
                .map(|active| active.desired_values.clone())
                .unwrap_or_else(|| desired_values(tweak));
            let is_on = !expected_values.is_empty()
                && expected_values
                    .iter()
                    .all(|(key, value)| parsed.get(key) == Some(value));
            states.insert(tweak.key.clone(), is_on);
            managed_states.insert(tweak.key.clone(), managed_tweak.is_some());

            if tweak.advanced_slider.is_some() {
                if let Some(first) = tweak.backend_keys.first() {
                    if let Some(value) = parsed.get(&first.key) {
                        raw_values.insert(tweak.key.clone(), value.clone());
                    }
                }
            }
        }
    }

    ClientCfgState {
        states,
        managed_states,
        raw_values,
    }
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

    let bind_map = load_bind_map(keys_cfg_path.as_deref());
    let keys_state_ref = if let Some(ref keys_path) = keys_cfg_path {
        let kp = Path::new(keys_path);
        tweak_state::config_key(kp)
            .ok()
            .and_then(|ck| state.configs.get(&ck).map(|c| &c.active_tweaks))
    } else {
        None
    };

    Ok(compute_tweak_states(&known_tweaks(), &parsed, active_tweaks, &bind_map, keys_state_ref))
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
        return toggle_bind_tweak(&app, &tweak, bind_tweak, enabled, keys_cfg_path);
    }

    let cfg_path = Path::new(&path);
    let current_values = client_cfg::parse(&client_cfg::read(cfg_path)?);
    let mut tx = TweakTx::begin(&app, cfg_path)?;

    if enabled {
        let ck = tx.config_key.clone();
        let config = tx.state_mut().configs.entry(ck).or_default();
        let changes = compute_enable_changes(&tweak, config, &current_values);
        log::info!(
            "Enabling tweak: path={}, tweak={}, applying={:?}",
            cfg_path.display(), tweak.key, changes
        );
        tx.commit(changes)
    } else {
        let ck = tx.config_key.clone();
        let is_managed = tx
            .state_mut()
            .configs
            .get(&ck)
            .map(|c| c.active_tweaks.contains_key(&tweak.key))
            .unwrap_or(false);
        if !is_managed {
            if force_unmanaged {
                let changes = compute_force_off_changes(&tweak);
                log::warn!(
                    "Force-disabling unmanaged tweak: path={}, tweak={}, applying={:?}",
                    cfg_path.display(), tweak.key, changes
                );
                let updated = client_cfg::apply_values(&tx.content, &changes);
                return client_cfg::write_atomic(cfg_path, &updated).map(|_| {
                    log::info!("Unmanaged tweak force-disabled: path={}, tweak={}", cfg_path.display(), tweak.key);
                });
            }
            return Err(format!(
                "Твик {} включён вручную; требуется подтверждение перезаписи",
                tweak.key
            ));
        }

        let ck = tx.config_key.clone();
        let config = tx
            .state_mut()
            .configs
            .get_mut(&ck)
            .ok_or_else(|| format!("Твик {0} не включён", tweak.key))?;
        let changes = compute_disable_changes(&tweak.key, config)?;

        log::info!(
            "Disabling tweak: path={}, tweak={}, restoring={:?}",
            cfg_path.display(), tweak.key, changes
        );
        if config.active_tweaks.is_empty() {
            let ck = tx.config_key.clone();
            tx.state_mut().configs.remove(&ck);
        }
        tx.commit(changes)
    }
}

pub(crate) fn compute_bind_content(
    config: &mut ConfigState,
    tweak: &TweakDef,
    bind_tweak: &BindTweak,
    existing: &str,
    prior_command: Option<String>,
    enabled: bool,
) -> String {
    if enabled {
        let captured = std::iter::once((
            bind_tweak.default_key.clone(),
            StoredValue { value: prior_command },
        ))
        .collect();
        let desired = std::iter::once((
            bind_tweak.default_key.clone(),
            bind_tweak.command.clone(),
        ))
        .collect();
        config.active_tweaks.insert(
            tweak.key.clone(),
            ActiveTweak {
                captured_values: captured,
                desired_values: desired,
            },
        );
        config.activation_order.retain(|k| k != &tweak.key);
        config.activation_order.push(tweak.key.clone());
        keys_cfg::apply_bind(existing, &bind_tweak.default_key, Some(&bind_tweak.command))
    } else {
        let removed = config.active_tweaks.remove(&tweak.key);
        config.activation_order.retain(|k| k != &tweak.key);
        let restore = removed.and_then(|a| {
            a.captured_values
                .get(&bind_tweak.default_key)
                .and_then(|v| v.value.clone())
        });
        match restore {
            Some(cmd) => keys_cfg::apply_bind(existing, &bind_tweak.default_key, Some(&cmd)),
            None => keys_cfg::apply_bind(existing, &bind_tweak.default_key, None),
        }
    }
}

fn toggle_bind_tweak(
    app: &tauri::AppHandle,
    tweak: &TweakDef,
    bind_tweak: &BindTweak,
    enabled: bool,
    keys_cfg_path: Option<String>,
) -> Result<(), String> {
    let keys_path = keys_cfg_path
        .as_ref()
        .ok_or_else(|| "Не указан путь к keys.cfg".to_string())?;
    let keys_cfg_path = Path::new(keys_path);

    let existing = if keys_cfg_path.exists() {
        std::fs::read_to_string(keys_cfg_path).unwrap_or_default()
    } else {
        String::new()
    };
    let prior_command = keys_cfg::load_binds(keys_cfg_path)
        .ok()
        .and_then(|binds| {
            binds
                .into_iter()
                .find(|b| b.key == bind_tweak.default_key)
                .map(|c| c.command)
        });

    let config_key = tweak_state::config_key(keys_cfg_path)?;
    let mut state = tweak_state::load(app)?;
    let previous_state = state.clone();
    let config = state.configs.entry(config_key.clone()).or_default();

    let new_content = compute_bind_content(config, tweak, bind_tweak, &existing, prior_command, enabled);

    if config.active_tweaks.is_empty() {
        state.configs.remove(&config_key);
    }

    tweak_state::save(app, &state)?;
    if let Err(write_error) = client_cfg::write_atomic(keys_cfg_path, &new_content) {
        match tweak_state::save(app, &previous_state) {
            Ok(()) => return Err(write_error),
            Err(rollback_error) => {
                return Err(format!("{write_error}; откат состояния не удался: {rollback_error}"))
            }
        }
    }
    log::info!(
        "Bind tweak {}: tweak={}, key={}",
        if enabled { "enabled" } else { "disabled" },
        tweak.key,
        bind_tweak.default_key
    );
    Ok(())
}

pub(crate) fn compute_slider_changes(
    config: &mut ConfigState,
    tweak_key: &str,
    backend_key: &str,
    desired_value: String,
) -> Result<BTreeMap<String, Option<String>>, String> {
    let active_tweak = config
        .active_tweaks
        .get_mut(tweak_key)
        .ok_or_else(|| format!("Твик {tweak_key} не включён"))?;
    active_tweak.desired_values.insert(backend_key.to_string(), desired_value.clone());
    let mut changes = BTreeMap::new();
    changes.insert(backend_key.to_string(), Some(desired_value));
    Ok(changes)
}

pub(crate) fn validate_slider_value(tweak: &TweakDef, value: f64) -> Result<String, String> {
    let slider = tweak
        .advanced_slider
        .as_ref()
        .ok_or_else(|| format!("У твика {} нет настраиваемого значения", tweak.key))?;
    if !value.is_finite() || value < slider.min || value > slider.max {
        return Err(format!(
            "Значение {value} вне диапазона {}..{}",
            slider.min, slider.max
        ));
    }
    let bk = tweak.backend_keys.first().ok_or_else(|| {
        format!("У твика {} нет backend-ключа", tweak.key)
    })?;
    Ok(bk.key.clone())
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
    let backend_key = validate_slider_value(&tweak, value)?;

    let cfg_path = Path::new(&path);
    let desired_value = value.to_string();
    let mut tx = TweakTx::begin(&app, cfg_path)?;
    let ck = tx.config_key.clone();
    let config = tx.state_mut().configs.get_mut(&ck)
        .ok_or_else(|| format!("Твик {key} не включён"))?;
    let changes = compute_slider_changes(config, &key, &backend_key, desired_value)?;

    log::info!("Updating tweak slider: path={path}, tweak={key}, backend_key={backend_key}");

    tx.commit(changes)?;

    log::info!("Tweak slider updated: path={path}, tweak={key}");
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

pub(crate) fn compute_force_off_changes(tweak: &TweakDef) -> BTreeMap<String, Option<String>> {
    tweak.backend_keys
        .iter()
        .map(|bk| (bk.key.clone(), Some(bk.off.clone())))
        .collect()
}

pub(crate) fn load_bind_map(keys_cfg_path: Option<&str>) -> BTreeMap<String, String> {
    let mut bind_map = BTreeMap::new();
    if let Some(keys_path) = keys_cfg_path {
        let path = Path::new(keys_path);
        if path.exists() {
            if let Ok(binds) = keys_cfg::load_binds(path) {
                for bind in binds {
                    bind_map.insert(bind.key, bind.command);
                }
            }
        }
    }
    bind_map
}

pub(crate) fn compute_enable_changes(
    tweak: &TweakDef,
    config: &mut ConfigState,
    current_values: &BTreeMap<String, String>,
) -> BTreeMap<String, Option<String>> {
    let desired_values = desired_values(tweak);
    let captured_values: BTreeMap<_, _> = desired_values
        .keys()
        .map(|bk| {
            (bk.clone(), StoredValue { value: current_values.get(bk).cloned() })
        })
        .collect();

    if let Some(active) = config.active_tweaks.get(&tweak.key) {
        let dv = active.desired_values.clone();
        config.activation_order.retain(|k| k != &tweak.key);
        config.activation_order.push(tweak.key.clone());
        dv.into_iter().map(|(k, v)| (k, Some(v))).collect()
    } else {
        for backend_key in desired_values.keys() {
            let already_owned = config
                .active_tweaks
                .values()
                .any(|active| active.desired_values.contains_key(backend_key));
            if !already_owned {
                config.baselines.insert(
                    backend_key.clone(),
                    StoredValue { value: current_values.get(backend_key).cloned() },
                );
            }
        }
        config.active_tweaks.insert(
            tweak.key.clone(),
            ActiveTweak { captured_values, desired_values: desired_values.clone() },
        );
        config.activation_order.push(tweak.key.clone());
        desired_values.into_iter().map(|(k, v)| (k, Some(v))).collect()
    }
}

pub(crate) fn compute_disable_changes(
    tweak_key: &str,
    config: &mut ConfigState,
) -> Result<BTreeMap<String, Option<String>>, String> {
    let removed = config
        .active_tweaks
        .remove(tweak_key)
        .ok_or_else(|| format!("Твик {0} не включён", tweak_key))?;
    config.activation_order.retain(|k| k != tweak_key);

    let mut changes = BTreeMap::new();
    for backend_key in removed.desired_values.keys() {
        let remaining = config
            .activation_order
            .iter()
            .rev()
            .find_map(|active_key| {
                config.active_tweaks.get(active_key)?.desired_values.get(backend_key).cloned()
            });
        if let Some(value) = remaining {
            changes.insert(backend_key.clone(), Some(value));
        } else {
            let baseline = config.baselines.remove(backend_key).ok_or_else(|| {
                format!("Нет сохранённого значения для {backend_key}")
            })?;
            changes.insert(backend_key.clone(), baseline.value);
        }
    }
    Ok(changes)
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
    client_cfg::operation_lock()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── rule ──────────────────────────────────────────────────────────────────

    #[test]
    fn get_known_tweaks_wrapper() {
        let result = get_known_tweaks();
        assert!(!result.is_empty());
        assert_eq!(result.len(), known_tweaks().len());
    }

    #[test]
    fn rule_creates_single_entry() {
        let result = rule("key", "on_value", "off_value");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].key, "key");
        assert_eq!(result[0].on, "on_value");
        assert_eq!(result[0].off, "off_value");
    }

    // ── group ─────────────────────────────────────────────────────────────────

    #[test]
    fn group_creates_multiple_entries() {
        let result = group(&[
            ("k1", "on1", "off1"),
            ("k2", "on2", "off2"),
            ("k3", "on3", "off3"),
        ]);
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].key, "k1");
        assert_eq!(result[1].key, "k2");
        assert_eq!(result[2].key, "k3");
        assert_eq!(result[2].on, "on3");
    }

    #[test]
    fn group_empty() {
        let result: Vec<BackendKeyRule> = group(&[]);
        assert!(result.is_empty());
    }

    // ── known_tweaks ─────────────────────────────────────────────────────────

    #[test]
    fn known_tweaks_non_empty() {
        let tweaks = known_tweaks();
        assert!(!tweaks.is_empty());
    }

    #[test]
    fn known_tweaks_has_disable_parasitic() {
        let tweaks = known_tweaks();
        let has = tweaks.iter().any(|t| t.key == "disableParasiticParams");
        assert!(has);
    }

    #[test]
    fn known_tweaks_has_recommended_badge() {
        let tweaks = known_tweaks();
        let recommended: Vec<_> = tweaks.iter().filter(|t| t.badge.is_some()).collect();
        assert!(!recommended.is_empty());
    }

    #[test]
    fn known_tweaks_input_holdtime_has_slider() {
        let tweaks = known_tweaks();
        let slider_tweak = tweaks.iter().find(|t| t.key == "input.holdtime").unwrap();
        assert!(slider_tweak.advanced_slider.is_some());
        let slider = slider_tweak.advanced_slider.as_ref().unwrap();
        assert!((slider.min - 0.05).abs() < f64::EPSILON);
        assert!((slider.max - 0.5).abs() < f64::EPSILON);
        assert!((slider.step - 0.05).abs() < f64::EPSILON);
    }

    #[test]
    fn known_tweaks_no_tweak_has_bind() {
        // currently none of the built-in tweaks define a bind
        let tweaks = known_tweaks();
        let has_bind = tweaks.iter().any(|t| t.bind.is_some());
        assert!(!has_bind);
    }

    #[test]
    fn known_tweaks_unique_keys() {
        let tweaks = known_tweaks();
        let mut keys: Vec<&str> = tweaks.iter().map(|t| t.key.as_str()).collect();
        keys.sort();
        keys.dedup();
        assert_eq!(keys.len(), tweaks.len());
    }

    // ── desired_values ────────────────────────────────────────────────────────

    #[test]
    fn desired_values_from_static_tweak() {
        let tweak = known_tweaks()
            .into_iter()
            .find(|t| t.key == "disableParasiticParams")
            .unwrap();
        let dv = desired_values(&tweak);
        // should have the first key's "on" value
        assert_eq!(dv.get("global.showblood").unwrap(), "False");
        assert!(!dv.is_empty());
    }

    #[test]
    fn desired_values_with_slider_uses_default() {
        let tweak = known_tweaks()
            .into_iter()
            .find(|t| t.key == "input.holdtime")
            .unwrap();
        let dv = desired_values(&tweak);
        // slider tweak: first key gets slider default_value as string
        let first_key = &tweak.backend_keys[0].key;
        assert_eq!(dv.get(first_key).unwrap(), "0.1");
    }

    // ── TweakDef serialization ────────────────────────────────────────────────

    #[test]
    fn tweak_def_serialization_snake_case_section() {
        let def = &known_tweaks()[0];
        let json = serde_json::to_value(def).unwrap();
        assert_eq!(json["section"], "qol");
    }

    #[test]
    fn tweet_section_serialization() {
        assert_eq!(
            serde_json::to_value(TweakSection::Qol).unwrap(),
            serde_json::json!("qol")
        );
        assert_eq!(
            serde_json::to_value(TweakSection::Graphics).unwrap(),
            serde_json::json!("graphics")
        );
        assert_eq!(
            serde_json::to_value(TweakSection::Interface).unwrap(),
            serde_json::json!("interface")
        );
    }

    #[test]
    fn tweak_badge_serialization() {
        assert_eq!(
            serde_json::to_value(TweakBadge::Recommended).unwrap(),
            serde_json::json!("recommended")
        );
    }

    #[test]
    fn client_cfg_state_serialization() {
        let state = ClientCfgState {
            states: [("tweak1".into(), true)].into(),
            managed_states: [("tweak1".into(), false)].into(),
            raw_values: [("tweak1".into(), "50".into())].into(),
        };
        let json = serde_json::to_value(&state).unwrap();
        assert_eq!(json["states"]["tweak1"], true);
        assert_eq!(json["managedStates"]["tweak1"], false);
        assert_eq!(json["rawValues"]["tweak1"], "50");
    }

    #[test]
    fn advanced_slider_serialization() {
        let slider = AdvancedSlider {
            min: 0.05,
            max: 0.5,
            step: 0.05,
            default_value: 0.1,
            label: "test".into(),
            value_format: Some("{value}s".into()),
        };
        let json = serde_json::to_value(&slider).unwrap();
        assert_eq!(json["min"], 0.05);
        assert_eq!(json["valueFormat"], "{value}s");
    }

    // ── backend_key_rule_and_bind_tweak ──────────────────────────────────────

    // ── compute_tweak_states ─────────────────────────────────────────────────

    fn single_key_tweak() -> TweakDef {
        // Uses the tree marker tweak which has exactly 1 backend key
        known_tweaks().into_iter().find(|t| t.key == "accessibility.treemarkercolor").unwrap()
    }

    fn multi_key_tweak() -> TweakDef {
        known_tweaks().into_iter().find(|t| t.key == "disableParasiticParams").unwrap()
    }

    #[test]
    fn compute_tweak_states_tweak_on_when_values_match() {
        let tw = single_key_tweak();
        let mut parsed = BTreeMap::new();
        parsed.insert(tw.backend_keys[0].key.clone(), tw.backend_keys[0].on.clone());
        let result = compute_tweak_states(&[tw], &parsed, None, &BTreeMap::new(), None);
        assert_eq!(result.states.get("accessibility.treemarkercolor").unwrap(), &true);
    }

    #[test]
    fn compute_tweak_states_tweak_off_when_values_dont_match() {
        let tw = single_key_tweak();
        let mut parsed = BTreeMap::new();
        parsed.insert(tw.backend_keys[0].key.clone(), tw.backend_keys[0].off.clone());
        let result = compute_tweak_states(&[tw], &parsed, None, &BTreeMap::new(), None);
        assert_eq!(result.states.get("accessibility.treemarkercolor").unwrap(), &false);
    }

    #[test]
    fn compute_tweak_states_managed_when_in_active_tweaks() {
        let tw = single_key_tweak();
        let mut active = BTreeMap::new();
        active.insert(tw.key.clone(), ActiveTweak {
            captured_values: BTreeMap::new(),
            desired_values: BTreeMap::new(),
        });
        let result = compute_tweak_states(&[tw], &BTreeMap::new(), Some(&active), &BTreeMap::new(), None);
        assert_eq!(result.managed_states.get("accessibility.treemarkercolor").unwrap(), &true);
    }

    #[test]
    fn compute_tweak_states_multi_key_all_match_turns_on() {
        let tw = multi_key_tweak();
        let mut parsed = BTreeMap::new();
        for bk in &tw.backend_keys {
            parsed.insert(bk.key.clone(), bk.on.clone());
        }
        let result = compute_tweak_states(&[tw], &parsed, None, &BTreeMap::new(), None);
        assert_eq!(result.states.get("disableParasiticParams").unwrap(), &true);
    }

    #[test]
    fn compute_tweak_states_multi_key_partial_match_stays_off() {
        let tw = multi_key_tweak();
        let mut parsed = BTreeMap::new();
        // Only set the first key to its ON value
        parsed.insert(tw.backend_keys[0].key.clone(), tw.backend_keys[0].on.clone());
        let result = compute_tweak_states(&[tw], &parsed, None, &BTreeMap::new(), None);
        assert_eq!(result.states.get("disableParasiticParams").unwrap(), &false);
    }

    #[test]
    fn compute_tweak_states_raw_value_for_slider() {
        let tw = known_tweaks().into_iter().find(|t| t.key == "input.holdtime").unwrap();
        let mut parsed = BTreeMap::new();
        parsed.insert("input.holdtime".into(), "0.15".into());
        let result = compute_tweak_states(&[tw], &parsed, None, &BTreeMap::new(), None);
        assert_eq!(result.raw_values.get("input.holdtime").unwrap(), "0.15");
    }

    #[test]
    fn compute_tweak_states_no_raw_value_when_missing() {
        let tw = known_tweaks().into_iter().find(|t| t.key == "input.holdtime").unwrap();
        let result = compute_tweak_states(&[tw], &BTreeMap::new(), None, &BTreeMap::new(), None);
        assert!(result.raw_values.is_empty());
    }

    #[test]
    fn compute_tweak_states_non_slider_no_raw_values() {
        let tw = single_key_tweak();
        let result = compute_tweak_states(&[tw], &BTreeMap::new(), None, &BTreeMap::new(), None);
        assert!(result.raw_values.is_empty());
    }

    #[test]
    fn compute_tweak_states_no_tweaks_returns_empty_state() {
        let result = compute_tweak_states(&[], &BTreeMap::new(), None, &BTreeMap::new(), None);
        assert!(result.states.is_empty());
        assert!(result.managed_states.is_empty());
        assert!(result.raw_values.is_empty());
    }

    #[test]
    fn compute_tweak_states_tweak_on_via_managed_desired() {
        let tw = single_key_tweak();
        let mut active = BTreeMap::new();
        let mut desired = BTreeMap::new();
        desired.insert(tw.backend_keys[0].key.clone(), tw.backend_keys[0].on.clone());
        active.insert(tw.key.clone(), ActiveTweak {
            captured_values: BTreeMap::new(),
            desired_values: desired,
        });
        let mut parsed = BTreeMap::new();
        parsed.insert(tw.backend_keys[0].key.clone(), tw.backend_keys[0].on.clone());
        let result = compute_tweak_states(&[tw], &parsed, Some(&active), &BTreeMap::new(), None);
        assert_eq!(result.states.get("accessibility.treemarkercolor").unwrap(), &true);
        assert_eq!(result.managed_states.get("accessibility.treemarkercolor").unwrap(), &true);
    }

    // ── compute_enable_changes ────────────────────────────────────────────────

    #[test]
    fn enable_changes_new_tweak_sets_baselines_and_inserts_active() {
        let tw = single_key_tweak();
        let mut config = ConfigState::default();
        let mut current = BTreeMap::new();
        current.insert(tw.backend_keys[0].key.clone(), "0".into());

        let changes = compute_enable_changes(&tw, &mut config, &current);

        // Should contain the ON value
        assert_eq!(changes.len(), 1);
        assert_eq!(
            changes.get(&tw.backend_keys[0].key).unwrap(),
            &Some(tw.backend_keys[0].on.clone())
        );
        // Baseline should be captured
        assert_eq!(
            config.baselines.get(&tw.backend_keys[0].key).unwrap().value,
            Some("0".into())
        );
        // Active tweak should be set
        assert!(config.active_tweaks.contains_key("accessibility.treemarkercolor"));
        assert_eq!(config.activation_order.len(), 1);
    }

    #[test]
    fn enable_changes_reapply_existing_tweak_reuses_desired() {
        let tw = single_key_tweak();
        let mut config = ConfigState::default();
        let original_desired: BTreeMap<_, _> = [(
            tw.backend_keys[0].key.clone(),
            "overridden".into(),
        )]
        .into();
        config.active_tweaks.insert(
            tw.key.clone(),
            ActiveTweak {
                captured_values: BTreeMap::new(),
                desired_values: original_desired.clone(),
            },
        );
        config.activation_order.push(tw.key.clone());

        let changes = compute_enable_changes(&tw, &mut config, &BTreeMap::new());

        // Reapply uses existing desired_values, not the original ON value
        assert_eq!(
            changes.get(&tw.backend_keys[0].key).unwrap(),
            &Some("overridden".into())
        );
    }

    #[test]
    fn enable_changes_skips_baseline_for_already_owned_key() {
        let tw = single_key_tweak();
        let mut config = ConfigState::default();
        // Simulate another tweak already owning this backend key
        let mut other = ActiveTweak {
            captured_values: BTreeMap::new(),
            desired_values: BTreeMap::new(),
        };
        other.desired_values.insert(tw.backend_keys[0].key.clone(), "owned".into());
        config.active_tweaks.insert("other_tweak".into(), other);
        config.activation_order.push("other_tweak".into());

        let changes = compute_enable_changes(&tw, &mut config, &BTreeMap::new());

        // Baseline should NOT be set because key is already owned
        assert!(config.baselines.is_empty());
        assert!(changes.contains_key(&tw.backend_keys[0].key));
    }

    // ── compute_disable_changes ───────────────────────────────────────────────

    #[test]
    fn disable_changes_restores_baseline() {
        let tw = single_key_tweak();
        let mut config = ConfigState::default();
        config.baselines.insert(
            tw.backend_keys[0].key.clone(),
            StoredValue { value: Some("original".into()) },
        );
        config.active_tweaks.insert(
            tw.key.clone(),
            ActiveTweak {
                captured_values: [(
                    tw.backend_keys[0].key.clone(),
                    StoredValue { value: Some("original".into()) },
                )]
                .into(),
                desired_values: [(tw.backend_keys[0].key.clone(), tw.backend_keys[0].on.clone())]
                    .into(),
            },
        );
        config.activation_order.push(tw.key.clone());

        let changes = compute_disable_changes(&tw.key, &mut config).unwrap();

        assert_eq!(changes.len(), 1);
        assert_eq!(
            changes.get(&tw.backend_keys[0].key).unwrap(),
            &Some("original".into())
        );
        assert!(!config.active_tweaks.contains_key(&tw.key));
    }

    #[test]
    fn disable_changes_passes_ownership_to_previous_tweak() {
        let tw = single_key_tweak();
        let bk_key = &tw.backend_keys[0].key;
        let mut config = ConfigState::default();
        // Add another tweak that also wants this key
        let mut previous = ActiveTweak {
            captured_values: BTreeMap::new(),
            desired_values: BTreeMap::new(),
        };
        previous.desired_values.insert(bk_key.clone(), "from_other".into());
        config.active_tweaks.insert("other".into(), previous);
        config.active_tweaks.insert(
            tw.key.clone(),
            ActiveTweak {
                captured_values: BTreeMap::new(),
                desired_values: [(bk_key.clone(), tw.backend_keys[0].on.clone())].into(),
            },
        );
        config.activation_order.push("other".into());
        config.activation_order.push(tw.key.clone());

        let changes = compute_disable_changes(&tw.key, &mut config).unwrap();

        // Should restore to the previous tweak's desired value
        assert_eq!(changes.get(bk_key).unwrap(), &Some("from_other".into()));
        // Baseline should NOT be consumed
        assert!(config.baselines.is_empty());
    }

    #[test]
    fn disable_changes_nonexistent_tweak_returns_error() {
        let mut config = ConfigState::default();
        let result = compute_disable_changes("nonexistent", &mut config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("не включён"));
    }

    // ── backend_key_rule_and_bind_tweak ──────────────────────────────────────

    // ── compute_force_off_changes ────────────────────────────────────────────

    #[test]
    fn force_off_changes_returns_off_values() {
        let tw = single_key_tweak();
        let changes = compute_force_off_changes(&tw);
        assert_eq!(changes.len(), 1);
        assert_eq!(
            changes.get(&tw.backend_keys[0].key).unwrap(),
            &Some(tw.backend_keys[0].off.clone())
        );
    }

    // ── compute_slider_changes ───────────────────────────────────────────────

    #[test]
    fn slider_changes_updates_active_tweak() {
        let mut config = ConfigState::default();
        config.active_tweaks.insert("test".into(), ActiveTweak {
            captured_values: BTreeMap::new(),
            desired_values: BTreeMap::new(),
        });
        config.activation_order.push("test".into());
        let changes = compute_slider_changes(&mut config, "test", "graphics.fov", "70.0".into()).unwrap();
        assert_eq!(changes.get("graphics.fov").unwrap(), &Some("70.0".into()));
        assert_eq!(
            config.active_tweaks.get("test").unwrap().desired_values.get("graphics.fov").unwrap(),
            "70.0"
        );
    }

    #[test]
    fn slider_changes_nonexistent_tweak_error() {
        let mut config = ConfigState::default();
        let result = compute_slider_changes(&mut config, "nope", "key", "val".into());
        assert!(result.is_err());
    }

    // ── validate_slider_value ────────────────────────────────────────────────

    #[test]
    fn validate_slider_valid_returns_backend_key() {
        let tw = known_tweaks().into_iter().find(|t| t.key == "input.holdtime").unwrap();
        let bk = validate_slider_value(&tw, 0.2).unwrap();
        assert_eq!(bk, "input.holdtime");
    }

    #[test]
    fn validate_slider_below_min() {
        let tw = known_tweaks().into_iter().find(|t| t.key == "input.holdtime").unwrap();
        let result = validate_slider_value(&tw, 0.01);
        assert!(result.is_err());
    }

    #[test]
    fn validate_slider_above_max() {
        let tw = known_tweaks().into_iter().find(|t| t.key == "input.holdtime").unwrap();
        let result = validate_slider_value(&tw, 1.0);
        assert!(result.is_err());
    }

    #[test]
    fn validate_slider_nan() {
        let tw = known_tweaks().into_iter().find(|t| t.key == "input.holdtime").unwrap();
        let result = validate_slider_value(&tw, f64::NAN);
        assert!(result.is_err());
    }

    #[test]
    fn validate_slider_infinite() {
        let tw = known_tweaks().into_iter().find(|t| t.key == "input.holdtime").unwrap();
        let result = validate_slider_value(&tw, f64::INFINITY);
        assert!(result.is_err());
    }

    #[test]
    fn validate_slider_non_slider_tweak() {
        let tw = single_key_tweak();
        let result = validate_slider_value(&tw, 1.0);
        assert!(result.is_err());
    }

    #[test]
    fn validate_slider_no_backend_keys() {
        let tw = TweakDef {
            key: "test.no_bk".into(),
            title: String::new(),
            description: String::new(),
            section: TweakSection::Qol,
            badge: None,
            backend_keys: vec![],
            advanced_slider: Some(AdvancedSlider {
                min: 0.0,
                max: 1.0,
                step: 0.1,
                default_value: 0.5,
                label: String::new(),
                value_format: None,
            }),
            bind: None,
        };
        let result = validate_slider_value(&tw, 0.5);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("нет backend-ключа"));
    }

    // ── load_bind_map ────────────────────────────────────────────────────────

    #[test]
    fn load_bind_map_none_path() {
        let result = load_bind_map(None);
        assert!(result.is_empty());
    }

    #[test]
    fn load_bind_map_missing_file() {
        let result = load_bind_map(Some(r"C:\nonexistent\file.cfg"));
        assert!(result.is_empty());
    }

    #[test]
    fn load_bind_map_existing_file() {
        let dir = std::env::temp_dir().join(format!("bind_map_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("keys.cfg");
        std::fs::write(&path, b"bind p jump\nbind f attack\n").unwrap();
        let result = load_bind_map(Some(path.to_str().unwrap()));
        assert_eq!(result.len(), 2);
        assert_eq!(result.get("p").unwrap(), "jump");
        assert_eq!(result.get("f").unwrap(), "attack");
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── compute_tweak_states with bind tweaks ────────────────────────────────

    #[test]
    fn compute_tweak_states_bind_tweak_on_when_bind_map_matches() {
        let tw = make_bind_tweak();
        let bind_map = [("p".into(), "jump".into())].into();
        let result = compute_tweak_states(&[tw], &BTreeMap::new(), None, &bind_map, None);
        assert!(result.states.get("test.bind") == Some(&true));
        assert!(result.managed_states.get("test.bind") == Some(&false));
    }

    #[test]
    fn compute_tweak_states_bind_tweak_off_when_bind_map_mismatch() {
        let tw = make_bind_tweak();
        let bind_map = [("p".into(), "kill".into())].into();
        let result = compute_tweak_states(&[tw], &BTreeMap::new(), None, &bind_map, None);
        assert!(result.states.get("test.bind") == Some(&false));
    }

    #[test]
    fn compute_tweak_states_bind_tweak_off_when_not_in_bind_map() {
        let tw = make_bind_tweak();
        let result = compute_tweak_states(&[tw], &BTreeMap::new(), None, &BTreeMap::new(), None);
        assert!(result.states.get("test.bind") == Some(&false));
    }

    #[test]
    fn compute_tweak_states_bind_tweak_managed_when_in_keys_state() {
        let tw = make_bind_tweak();
        let keys_state = [("test.bind".into(), ActiveTweak {
            captured_values: BTreeMap::new(),
            desired_values: BTreeMap::new(),
        })].into();
        let result = compute_tweak_states(&[tw], &BTreeMap::new(), None, &BTreeMap::new(), Some(&keys_state));
        assert!(result.managed_states.get("test.bind") == Some(&true));
    }

    // ── compute_bind_content ─────────────────────────────────────────────────

    fn make_bind_tweak() -> TweakDef {
        TweakDef {
            key: "test.bind".into(),
            title: String::new(),
            description: String::new(),
            section: TweakSection::Qol,
            badge: None,
            backend_keys: vec![],
            advanced_slider: None,
            bind: Some(BindTweak {
                default_key: "p".into(),
                command: "jump".into(),
            }),
        }
    }

    #[test]
    fn bind_content_enable_sets_bind() {
        let tw = make_bind_tweak();
        let bt = tw.bind.as_ref().unwrap();
        let mut config = ConfigState::default();
        let result = compute_bind_content(&mut config, &tw, bt, "// comment", None, true);
        assert_eq!(result, "// comment\nbind p jump\n");
        assert!(config.active_tweaks.contains_key("test.bind"));
        assert_eq!(config.activation_order.len(), 1);
    }

    #[test]
    fn bind_content_disable_removes_bind_when_no_prior() {
        let tw = make_bind_tweak();
        let bt = tw.bind.as_ref().unwrap();
        let mut config = ConfigState::default();
        config.active_tweaks.insert(
            "test.bind".into(),
            ActiveTweak {
                captured_values: [(
                    "p".into(),
                    StoredValue { value: None },
                )]
                .into(),
                desired_values: [("p".into(), "jump".into())].into(),
            },
        );
        config.activation_order.push("test.bind".into());
        let result = compute_bind_content(&mut config, &tw, bt, "bind p jump", None, false);
        // No prior command → bind is removed
        assert_eq!(result, "");
        assert!(!config.active_tweaks.contains_key("test.bind"));
    }

    #[test]
    fn bind_content_disable_restores_prior_command() {
        let tw = make_bind_tweak();
        let bt = tw.bind.as_ref().unwrap();
        let mut config = ConfigState::default();
        config.active_tweaks.insert(
            "test.bind".into(),
            ActiveTweak {
                captured_values: [(
                    "p".into(),
                    StoredValue { value: Some("kill".into()) },
                )]
                .into(),
                desired_values: [("p".into(), "jump".into())].into(),
            },
        );
        config.activation_order.push("test.bind".into());
        let result = compute_bind_content(&mut config, &tw, bt, "bind p jump", Some("kill".into()), false);
        assert!(result.contains("bind p kill"));
        assert!(!config.active_tweaks.contains_key("test.bind"));
    }

    // ── backend_key_rule_and_bind_tweak ──────────────────────────────────────

    #[test]
    fn backend_key_rule_serialization() {
        let rule = BackendKeyRule {
            key: "test.key".into(),
            on: "1".into(),
            off: "0".into(),
        };
        let json = serde_json::to_value(&rule).unwrap();
        assert_eq!(json["key"], "test.key");
        assert_eq!(json["on"], "1");
        assert_eq!(json["off"], "0");
    }

    #[test]
    fn bind_tweak_serialization() {
        let bt = BindTweak {
            default_key: "p".into(),
            command: "jump".into(),
        };
        let json = serde_json::to_value(&bt).unwrap();
        assert_eq!(json["defaultKey"], "p");
        assert_eq!(json["command"], "jump");
    }
}
