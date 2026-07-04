using System.Collections.ObjectModel;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using RustPatch.Models;

namespace RustPatch.Services;

/// <summary>
/// keys.cfg only ever contains bind lines in this game, so the file is
/// fully regenerated from the in-memory bind list on every save.
/// Rust does not quote the key token; the command is the raw remainder of
/// the line and may itself contain quotes, ";" (multi-commands) or a
/// leading "~" (toggle binds) — it is kept verbatim, never re-parsed.
/// </summary>
public static class KeysCfgService
{
    private static readonly Regex BindLinePattern = new("^bind\\s+(\\S+)\\s+(.*)$");

    public static ObservableCollection<KeyBind> Load(string path)
    {
        var binds = new ObservableCollection<KeyBind>();

        foreach (var line in File.ReadAllLines(path))
        {
            var match = BindLinePattern.Match(line.Trim());
            if (match.Success)
            {
                binds.Add(new KeyBind(match.Groups[1].Value, match.Groups[2].Value));
            }
        }

        return binds;
    }

    public static void Save(string path, ObservableCollection<KeyBind> binds)
    {
        if (binds.Count == 0)
        {
            return;
        }

        var backupPath = path + ".bak";
        if (!File.Exists(backupPath))
        {
            File.Copy(path, backupPath, overwrite: false);
        }

        var sb = new StringBuilder();
        foreach (var bind in binds)
        {
            sb.Append("bind ").Append(bind.Key).Append(' ').Append(bind.Command).Append('\n');
        }

        File.WriteAllText(path, sb.ToString());
    }
}
