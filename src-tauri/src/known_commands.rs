use serde::Serialize;

/// Human-readable dictionary of Rust bind commands — the command picker only
/// ever selects from this list, no raw command typing. Built from Rust's
/// common movement/UI commands plus every distinct command found in a real
/// keys.cfg (including server-specific chat.say macros and compound binds),
/// so nothing shows up as an unrecognized raw string.
#[derive(Serialize, Clone)]
pub struct CommandPreset {
    pub name: String,
    pub command: String,
    pub kind: String,
}

fn preset(name: &str, command: &str) -> CommandPreset {
    let kind = if command.contains(';') || command.starts_with("+meta.") {
        String::from("combination")
    } else {
        String::from("single")
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
        preset(
            "Автобег",
            "+prevskin;+autowalk",
        ),
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
            "Ноуклип",
            "noclip",
        ),
        preset("Выйти из игры", "quit"),
        // Инвентарь и крафт
        preset("Инвентарь", "inventory.toggle"),
        preset(
            "Выбросить предмет",
            "inventory.drop.active",
        ),
        preset(
            "Пред. слот в инвентаре",
            "+invprev",
        ),
        preset(
            "След. слот в инвентаре",
            "+invnext",
        ),
        preset("Меню крафта", "crafting.open"),
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
            "Карта (полноэкранная)",
            "map.toggle",
        ),
        preset("Карта (удержание)", "+map"),
        preset("Консоль", "consoletoggle"),
        preset(
            "Меню жестов",
            "+gestures",
        ),
        preset(
            "Меню питомцев (Зачем?)",
            "+pets",
        ),
        preset("Фонарик", "flashlight.toggle"),
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
        preset(
            "Смена рук",
            "graphics.vm_horizontal_flip 0; graphics.vm_horizontal_flip 1",
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
    ]
}

#[tauri::command]
pub fn get_known_commands() -> Vec<CommandPreset> {
    presets()
}
