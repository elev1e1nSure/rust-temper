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
    pub description: String,
    pub kind: String,
}

fn preset(name: &str, command: &str, description: &str) -> CommandPreset {
    let kind = if command.contains(';') || command.contains('~') || command.starts_with("+meta.") {
        String::from("combination")
    } else {
        String::from("single")
    };
    CommandPreset {
        name: name.to_string(),
        command: command.to_string(),
        description: description.to_string(),
        kind,
    }
}

pub fn presets() -> Vec<CommandPreset> {
    vec![
        // Движение
        preset("Вперёд", "+forward", "Движение вперёд."),
        preset("Назад", "+backward", "Движение назад."),
        preset("Влево", "+left", "Движение влево."),
        preset("Вправо", "+right", "Движение вправо."),
        preset("Прыжок", "+jump", "Прыжок."),
        preset("Присесть", "+duck", "Присесть."),
        preset("Бег", "+sprint", "Ускоренный бег."),
        preset(
            "Свободный обзор",
            "+altlook",
            "Обзор по сторонам без поворота корпуса персонажа.",
        ),
        preset(
            "Автобег",
            "+prevskin;+autowalk",
            "Включает автоматический бег вперёд.",
        ),
        // Бой и оружие
        preset("Атака", "+attack", "Основная атака/выстрел."),
        preset(
            "Атака (вторичная)",
            "+attack2",
            "Вторичное действие оружия, обычно прицеливание.",
        ),
        preset(
            "Режим стрельбы",
            "+firemode",
            "Открывает выбор режима стрельбы (одиночный/очередь/авто).",
        ),
        preset("Перезарядка", "+reload", "Перезаряжает текущее оружие."),
        preset(
            "Уменьшить зум прицела",
            "+zoomdecrease",
            "Уменьшает зум прицела.",
        ),
        preset(
            "Увеличить зум прицела",
            "+zoomincrease",
            "Увеличивает зум прицела.",
        ),
        preset("Убить себя", "kill", "Убивает вашего персонажа."),
        // Взаимодействие и предметы
        preset(
            "Использовать",
            "+use",
            "Взаимодействие с объектом, например открытие ящика.",
        ),
        preset(
            "Осмотреть предмет в руке",
            "examineheld",
            "Показывает анимацию осмотра предмета в руках.",
        ),
        preset(
            "Быстрый лут",
            "+hoverloot",
            "Позволяет лутать предметы, водя курсором по ним.",
        ),
        preset(
            "Ноуклип",
            "noclip",
            "Отключает столкновения и позволяет летать сквозь объекты. Только для админов.",
        ),
        preset("Выйти из игры", "quit", "Закрывает игру."),
        // Инвентарь и крафт
        preset("Инвентарь", "inventory.toggle", "Открывает/закрывает окно инвентаря."),
        preset(
            "Выбросить предмет",
            "inventory.drop.active",
            "Выбрасывает предмет из активного слота на землю.",
        ),
        preset(
            "Пред. слот в инвентаре",
            "+invprev",
            "Прокручивает активный слот на предыдущий.",
        ),
        preset(
            "След. слот в инвентаре",
            "+invnext",
            "Прокручивает активный слот на следующий.",
        ),
        preset("Меню крафта", "crafting.open", "Открывает окно крафта."),
        // Слоты пояса
        preset("Слот 1", "+slot1", "Выбрать предмет в 1-м слоте."),
        preset("Слот 2", "+slot2", "Выбрать предмет в 2-м слоте."),
        preset("Слот 3", "+slot3", "Выбрать предмет в 3-м слоте."),
        preset("Слот 4", "+slot4", "Выбрать предмет в 4-м слоте."),
        preset("Слот 5", "+slot5", "Выбрать предмет в 5-м слоте."),
        preset("Слот 6", "+slot6", "Выбрать предмет в 6-м слоте."),
        // UI и чат
        preset("Открыть чат", "chat.open", "Открывает чат для ввода сообщения."),
        preset("Написать в чат", "chat.say", "Печатает заданный текст в общий чат."),
        preset(
            "Карта (полноэкранная)",
            "map.toggle",
            "Открывает/закрывает полноэкранную карту.",
        ),
        preset("Карта (удержание)", "+map", "Показывает карту."),
        preset("Консоль", "consoletoggle", "Открывает/закрывает игровую консоль."),
        preset(
            "Меню жестов",
            "+gestures",
            "Открывает колесо игровых жестов/эмоций.",
        ),
        preset(
            "Меню питомцев (Зачем?)",
            "+pets",
            "Открывает меню питомцев. На самом деле не работает.",
        ),
        preset("Фонарик", "flashlight.toggle", "Включает/выключает фонарик на оружии."),
        preset(
            "Переключить мод на оружии",
            "lighttoggle",
            "Переключает модификацию на оружии.",
        ),
        // Команда, транспорт, база
        preset(
            "Поменять место в транспорте",
            "swapseats",
            "Меняет ваше посадочное место в транспорте.",
        ),
        preset(
            "Увеличить провис провода",
            "+wireslackup",
            "Увеличивает провисание провода при редактировании.",
        ),
        preset(
            "Уменьшить провис провода",
            "+wireslackdown",
            "Уменьшает провисание провода при редактировании.",
        ),
        // Отладка
        preset(
            "Принудительная сборка мусора (GC)",
            "gc.collect",
            "Запускает сборщик мусора: может кратковременно подвесить игру, но поднять FPS в долгих сессиях.",
        ),
        preset(
            "Приближение",
            "+meta.if_true \"graphics.fov 70\";+meta.if_false \"graphics.fov 90\"",
            "Удерживая клавишу, камера слегка приближается.",
        ),
        preset(
            "Смена рук",
            "graphics.vm_horizontal_flip 0; graphics.vm_horizontal_flip 1",
            "Переключает положение модели оружия (левая/правая рука).",
        ),
        preset(
            "Радиус взаимодействия",
            "~meta.exec \"client.lookatradius 0\" \"chat.add 0 0 MIN\";meta.exec \"client.lookatradius 0.2\" \"chat.add 0 0 DEFAULT\";meta.exec \"client.lookatradius 10\" \"chat.add 0 0 MAX\"",
            "По кругу переключает радиус, на котором персонаж может смотреть/взаимодействовать с объектами.",
        ),
        preset(
            "Быстрое переодевание",
            "inventory.toggle;inventory.container1 0;inventory.container1 1;inventory.container1 2;inventory.container1 3;inventory.toggle",
            "Мгновенно надевает снаряжение из первых четырёх слотов одежды в инвентаре.",
        ),

        // Транспорт: пересадка по местам
        preset(
            "Пересесть на место 1",
            "swaptoseat 0",
            "Пересаживает на посадочное место №1 (обычно водитель).",
        ),
        preset(
            "Пересесть на место 2",
            "swaptoseat 1",
            "Пересаживает на посадочное место №2 в текущем транспорте.",
        ),
        preset(
            "Пересесть на место 3",
            "swaptoseat 2",
            "Пересаживает на посадочное место №3 в текущем транспорте.",
        ),
        preset(
            "Пересесть на место 4",
            "swaptoseat 3",
            "Пересаживает на посадочное место №4 в текущем транспорте.",
        ),
        preset(
            "Пересесть на место 5",
            "swaptoseat 4",
            "Пересаживает на посадочное место №5 в текущем транспорте.",
        ),
        preset(
            "Пересесть на место 6",
            "swaptoseat 5",
            "Пересаживает на посадочное место №6 в текущем транспорте.",
        ),
        preset(
            "Пересесть на место 7",
            "swaptoseat 6",
            "Пересаживает на посадочное место №7 в текущем транспорте.",
        ),
        preset(
            "Пересесть на место 8",
            "swaptoseat 7",
            "Пересаживает на посадочное место №8 в текущем транспорте.",
        ),
    ]
}

#[tauri::command]
pub fn get_known_commands() -> Vec<CommandPreset> {
    presets()
}
