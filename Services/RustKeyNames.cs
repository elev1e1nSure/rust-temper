using System.Collections.Generic;
using Windows.System;

namespace RustPatch.Services;

/// <summary>
/// Maps WinUI VirtualKey values to the key names Rust's keys.cfg expects.
/// Covers the keys a player would realistically bind; anything unmapped
/// falls back to the lowercased enum name.
/// </summary>
public static class RustKeyNames
{
    private static readonly Dictionary<VirtualKey, string> Map = new()
    {
        [VirtualKey.Space] = "space",
        [VirtualKey.Tab] = "tab",
        [VirtualKey.CapitalLock] = "capslock",
        [VirtualKey.LeftShift] = "leftshift",
        [VirtualKey.RightShift] = "rightshift",
        [VirtualKey.Shift] = "leftshift",
        [VirtualKey.LeftControl] = "leftctrl",
        [VirtualKey.RightControl] = "rightctrl",
        [VirtualKey.Control] = "leftctrl",
        [VirtualKey.LeftMenu] = "leftalt",
        [VirtualKey.RightMenu] = "rightalt",
        [VirtualKey.Menu] = "leftalt",
        [VirtualKey.Escape] = "escape",
        [VirtualKey.Enter] = "enter",
        [VirtualKey.Back] = "backspace",
        [VirtualKey.Up] = "uparrow",
        [VirtualKey.Down] = "downarrow",
        [VirtualKey.Left] = "leftarrow",
        [VirtualKey.Right] = "rightarrow",
        [VirtualKey.F1] = "f1",
        [VirtualKey.F2] = "f2",
        [VirtualKey.F3] = "f3",
        [VirtualKey.F4] = "f4",
        [VirtualKey.F5] = "f5",
        [VirtualKey.F6] = "f6",
        [VirtualKey.F7] = "f7",
        [VirtualKey.F8] = "f8",
        [VirtualKey.F9] = "f9",
        [VirtualKey.F10] = "f10",
        [VirtualKey.F11] = "f11",
        [VirtualKey.F12] = "f12",
        [VirtualKey.Insert] = "insert",
        [VirtualKey.Delete] = "delete",
        [VirtualKey.Home] = "home",
        [VirtualKey.End] = "end",
        [VirtualKey.PageUp] = "pageup",
        [VirtualKey.PageDown] = "pagedown",
        [VirtualKey.Number0] = "0",
        [VirtualKey.Number1] = "1",
        [VirtualKey.Number2] = "2",
        [VirtualKey.Number3] = "3",
        [VirtualKey.Number4] = "4",
        [VirtualKey.Number5] = "5",
        [VirtualKey.Number6] = "6",
        [VirtualKey.Number7] = "7",
        [VirtualKey.Number8] = "8",
        [VirtualKey.Number9] = "9",
        [VirtualKey.NumberPad0] = "numpad0",
        [VirtualKey.NumberPad1] = "numpad1",
        [VirtualKey.NumberPad2] = "numpad2",
        [VirtualKey.NumberPad3] = "numpad3",
        [VirtualKey.NumberPad4] = "numpad4",
        [VirtualKey.NumberPad5] = "numpad5",
        [VirtualKey.NumberPad6] = "numpad6",
        [VirtualKey.NumberPad7] = "numpad7",
        [VirtualKey.NumberPad8] = "numpad8",
        [VirtualKey.NumberPad9] = "numpad9",
        [VirtualKey.Add] = "numpadplus",
        [VirtualKey.Subtract] = "numpadminus",
        [VirtualKey.Multiply] = "numpadmultiply",
        [VirtualKey.Divide] = "numpaddivide",
        [VirtualKey.Decimal] = "numpaddecimal",
    };

    public static string FromVirtualKey(VirtualKey key)
    {
        if (Map.TryGetValue(key, out var name))
        {
            return name;
        }

        // Letter keys (A-Z) map 1:1 to their lowercase name in Rust's cfg format.
        if (key is >= VirtualKey.A and <= VirtualKey.Z)
        {
            return key.ToString().ToLowerInvariant();
        }

        return key.ToString().ToLowerInvariant();
    }

    public static string FromMouseButton(int button) => button switch
    {
        0 => "mouse0", // left
        1 => "mouse1", // right
        2 => "mouse2", // middle
        3 => "mouse3",
        4 => "mouse4",
        _ => $"mouse{button}",
    };
}
