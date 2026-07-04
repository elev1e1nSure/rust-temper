namespace RustPatch.Models;

/// <summary>
/// A human-readable label for a raw Rust console command, used to populate
/// the bind command picker so users never have to type raw commands.
/// </summary>
public sealed class CommandPreset(string name, string command)
{
    public string Name { get; } = name;

    public string Command { get; } = command;
}
