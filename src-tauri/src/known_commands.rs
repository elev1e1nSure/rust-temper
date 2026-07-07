use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum CommandKind {
    Single,
    Combination,
}

/// Human-readable dictionary of Rust bind commands — the command picker only
/// ever selects from this list, no raw command typing. Built from Rust's
/// common movement/UI commands plus every distinct command found in a real
/// keys.cfg (including server-specific chat.say macros and compound binds),
/// so nothing shows up as an unrecognized raw string.
#[derive(Serialize, Clone)]
pub struct CommandPreset {
    pub name: String,
    pub command: String,
    pub kind: CommandKind,
}

fn preset(name: &str, command: &str) -> CommandPreset {
    let kind = if command.contains(';') || command.starts_with("+meta.") {
        CommandKind::Combination
    } else {
        CommandKind::Single
    };
    CommandPreset {
        name: name.to_string(),
        command: command.to_string(),
        kind,
    }
}

pub fn presets() -> Vec<CommandPreset> {
    vec![
        // Движение
        preset("Вперёд", "+forward"),
        preset("Назад", "+backward"),
        preset("Влево", "+left"),
        preset("Вправо", "+right"),
        preset("Прыжок", "+jump"),
        preset("Присесть", "+duck"),
        preset("Бег", "+sprint"),
        preset(
            "Свободный обзор",
            "+altlook",
        ),
        preset("Автобег", "+autowalk"),
        // Бой и оружие
        preset("Атака", "+attack"),
        preset(
            "Автоатака",
            "~attack",
        ),
        preset(
            "Атака (вторичная)",
            "+attack2",
        ),
        preset(
            "Режим стрельбы",
            "+firemode",
        ),
        preset("Перезарядка", "+reload"),
        preset(
            "Уменьшить зум прицела",
            "+zoomdecrease",
        ),
        preset(
            "Увеличить зум прицела",
            "+zoomincrease",
        ),
        preset("Убить себя", "kill"),
        // Взаимодействие и предметы
        preset(
            "Использовать",
            "+use",
        ),
        preset(
            "Осмотреть предмет в руке",
            "examineheld",
        ),
        preset(
            "Быстрый лут",
            "+hoverloot",
        ),
        preset(
            "Убрать в кобуру",
            "+holsteritem",
        ),
        preset(
            "Ноуклип",
            "noclip",
        ),
        preset("Выйти из игры", "quit"),
        // Инвентарь и крафт
        preset("Инвентарь", "inventory.toggle"),
        preset(
            "Выбросить один предмет",
            "+dropitemsingle",
        ),
        preset(
            "Выбросить стак",
            "+dropitemstack",
        ),
        preset(
            "Пред. слот в инвентаре",
            "+invprev",
        ),
        preset(
            "След. слот в инвентаре",
            "+invnext",
        ),
        preset(
            "Пред. скин",
            "+prevskin",
        ),
        preset(
            "След. скин",
            "+nextskin",
        ),
        preset("Меню крафта", "inventory.togglecrafting"),
        // Слоты пояса
        preset("Слот 1", "+slot1"),
        preset("Слот 2", "+slot2"),
        preset("Слот 3", "+slot3"),
        preset("Слот 4", "+slot4"),
        preset("Слот 5", "+slot5"),
        preset("Слот 6", "+slot6"),
        // UI и чат
        preset("Открыть чат", "chat.open"),
        preset("Написать в чат", "chat.say"),
        preset(
            "Голосовой чат",
            "+voice",
        ),
        preset(
            "Пинг (метка)",
            "+ping",
        ),
        preset(
            "Карта (удержание)",
            "+map",
        ),
        preset(
            "Карта — по центру игрока",
            "+focusmap",
        ),
        preset("Компас", "+compass"),
        preset("Консоль", "consoletoggle"),
        preset(
            "Меню жестов",
            "+gestures",
        ),
        preset(
            "Меню питомцев (Зачем?)",
            "+pets",
        ),
        preset(
            "Переключить мод на оружии",
            "lighttoggle",
        ),
        // Команда, транспорт, база
        preset(
            "Поменять место в транспорте",
            "swapseats",
        ),
        preset(
            "Увеличить провис провода",
            "+wireslackup",
        ),
        preset(
            "Уменьшить провис провода",
            "+wireslackdown",
        ),
        // Отладка
        preset(
            "Принудительная сборка мусора (GC)",
            "gc.collect",
        ),
        preset(
            "Приближение",
            "+meta.if_true \"graphics.fov 70\";+meta.if_false \"graphics.fov 90\"",
        ),
        // `~` cycles the flip on each press; a plain `a;b` chain would run both
        // every press and always settle on `1`, never toggling.
        preset(
            "Смена рук",
            "~graphics.vm_horizontal_flip 0;graphics.vm_horizontal_flip 1",
        ),
        preset(
            "Радиус взаимодействия",
            "~meta.exec \"client.lookatradius 0\" \"chat.add 0 0 MIN\";meta.exec \"client.lookatradius 0.2\" \"chat.add 0 0 DEFAULT\";meta.exec \"client.lookatradius 10\" \"chat.add 0 0 MAX\"",
        ),
        preset(
            "Быстрое переодевание",
            "inventory.toggle;inventory.container1 0;inventory.container1 1;inventory.container1 2;inventory.container1 3;inventory.toggle",
        ),

        // Транспорт: пересадка по местам
        preset(
            "Пересесть на место 1",
            "swaptoseat 0",
        ),
        preset(
            "Пересесть на место 2",
            "swaptoseat 1",
        ),
        preset(
            "Пересесть на место 3",
            "swaptoseat 2",
        ),
        preset(
            "Пересесть на место 4",
            "swaptoseat 3",
        ),
        preset(
            "Пересесть на место 5",
            "swaptoseat 4",
        ),
        preset(
            "Пересесть на место 6",
            "swaptoseat 5",
        ),
        preset(
            "Пересесть на место 7",
            "swaptoseat 6",
        ),
        preset(
            "Пересесть на место 8",
            "swaptoseat 7",
        ),
        // Debug-камера (cinematic/admin layer)
        preset(
            "Debug-камера: привязка к цели",
            "+debugcamera_targetbind",
        ),
        preset(
            "Debug-камера: приблизить",
            "+debugcamera_dollyforward",
        ),
        preset(
            "Debug-камера: отдалить",
            "+debugcamera_dollyback",
        ),
        preset(
            "Debug-камера: сменить кость",
            "+debugcamera_cyclebone",
        ),
    ]
}

#[tauri::command]
pub fn get_known_commands() -> Vec<CommandPreset> {
    presets()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presets_non_empty() {
        let p = presets();
        assert!(!p.is_empty());
        assert!(p.len() > 50);
    }

    #[test]
    fn presets_has_essential_commands() {
        let p = presets();
        let names: Vec<&str> = p.iter().map(|c| c.name.as_str()).collect();
        assert!(names.contains(&"Вперёд"));
        assert!(names.contains(&"Прыжок"));
        assert!(names.contains(&"Атака"));
        assert!(names.contains(&"Инвентарь"));
        assert!(names.contains(&"Консоль"));
    }

    #[test]
    fn presets_contains_single_and_combination() {
        let p = presets();
        let has_single = p.iter().any(|c| matches!(c.kind, CommandKind::Single));
        let has_combo = p.iter().any(|c| matches!(c.kind, CommandKind::Combination));
        assert!(has_single);
        assert!(has_combo);
    }

    #[test]
    fn preset_single_command() {
        let cp = preset("Тест", "+forward");
        assert_eq!(cp.name, "Тест");
        assert_eq!(cp.command, "+forward");
        assert!(matches!(cp.kind, CommandKind::Single));
    }

    #[test]
    fn preset_combination_with_semicolon() {
        let cp = preset("Авто", "+attack;+forward");
        assert!(matches!(cp.kind, CommandKind::Combination));
    }

    #[test]
    fn preset_combination_with_meta() {
        let cp = preset("Зум", "+meta.if_true \"fov 70\"");
        assert!(matches!(cp.kind, CommandKind::Combination));
    }

    #[test]
    fn preset_untoggleable_attack() {
        let cp = preset("Автоатака", "~attack");
        assert!(matches!(cp.kind, CommandKind::Single));
    }

    #[test]
    fn preset_unique_names() {
        let p = presets();
        let mut names: Vec<&str> = p.iter().map(|c| c.name.as_str()).collect();
        names.sort();
        let original_len = names.len();
        names.dedup();
        assert_eq!(names.len(), original_len);
    }
}
