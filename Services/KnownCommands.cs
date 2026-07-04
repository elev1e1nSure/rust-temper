using RustPatch.Models;

namespace RustPatch.Services;

/// <summary>
/// Curated list of common Rust binds shown by human-readable name — the
/// command picker only ever selects from this list, no raw command typing.
/// </summary>
public static class KnownCommands
{
    public static readonly CommandPreset[] Presets =
    [
        new("Приближение", "+graphics.fov 90; graphics.fov 60"),
        new("Вперёд", "+forward"),
        new("Назад", "+backward"),
        new("Влево", "+left"),
        new("Вправо", "+right"),
        new("Прыжок", "+jump"),
        new("Присесть", "+duck"),
        new("Бег", "+sprint"),
        new("Атака", "+attack"),
        new("Атака (вторичная)", "+attack2"),
        new("Использовать", "+use"),
        new("Перезарядка", "+reload"),
        new("Прицеливание", "+aimtoggle"),
        new("Голосовой чат", "+voice"),
        new("Инвентарь", "inventory.toggle"),
        new("Закрыть лут/инвентарь", "inventory.endloot"),
        new("Выбросить предмет", "inventory.drop.active"),
        new("Чат", "chat.toggle"),
        new("Написать в чат", "chat.say"),
        new("Карта", "map.toggle"),
        new("Крафт", "crafting.open"),
        new("Консоль", "console.toggle"),
        new("Таблица результатов", "score.toggle"),
        new("Лог боя", "combatlog"),
        new("Возродиться (спальник)", "respawn_sleepingbag"),
        new("Возродиться (кровать)", "respawn_bed"),
        new("Меню команды", "team.toggle"),
        new("Пригласить в команду", "team.invitecode"),
        new("Фонарик", "flashlight.toggle"),
        new("Ноуклип (админ)", "noclip"),
        new("Убить себя", "kill"),
        new("Выйти из игры", "quit"),
    ];
}
