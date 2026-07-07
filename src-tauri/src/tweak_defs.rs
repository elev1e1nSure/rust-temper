//! Static tweak catalogue: DTOs, helper constructors, and the
//! known_tweaks() registry. Split from `tweaks.rs` so the operation logic stays
//! focused on state mutation while this module owns the declarative data.

use serde::Serialize;
use std::sync::OnceLock;
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

pub fn rule(key: &str, on: &str, off: &str) -> Vec<BackendKeyRule> {
    vec![BackendKeyRule {
        key: key.to_string(),
        on: on.to_string(),
        off: off.to_string(),
    }]
}

pub fn group(pairs: &[(&str, &str, &str)]) -> Vec<BackendKeyRule> {
    pairs
        .iter()
        .map(|(key, on, off)| BackendKeyRule {
            key: key.to_string(),
            on: on.to_string(),
            off: off.to_string(),
        })
        .collect()
}

fn build_registry() -> Vec<TweakDef> {
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

static REGISTRY: OnceLock<Vec<TweakDef>> = OnceLock::new();

pub fn known_tweaks_ref() -> &'static [TweakDef] {
    REGISTRY.get_or_init(build_registry)
}

pub fn known_tweaks() -> Vec<TweakDef> {
    known_tweaks_ref().to_vec()
}