namespace RustPatch.Services;

/// <summary>
/// Curated subset of commonly bound Rust console commands. Not exhaustive —
/// the command combobox is editable so users can type anything not listed here.
/// </summary>
public static class KnownCommands
{
    public static readonly string[] All =
    [
        "+forward",
        "+backward",
        "+left",
        "+right",
        "+jump",
        "+duck",
        "+sprint",
        "+attack",
        "+attack2",
        "+use",
        "+reload",
        "+aimtoggle",
        "+leftHand",
        "+voice",
        "inventory.toggle",
        "inventory.endloot",
        "inventory.drop.active",
        "chat.toggle",
        "chat.say",
        "map.toggle",
        "crafting.open",
        "console.toggle",
        "score.toggle",
        "combatlog",
        "respawn_sleepingbag",
        "respawn_bed",
        "team.toggle",
        "team.invitecode",
        "flashlight.toggle",
        "streamerkit.toggle",
        "graphics.fov 90",
        "cam.distance 2",
        "noclip",
        "kill",
        "quit",
    ];
}
