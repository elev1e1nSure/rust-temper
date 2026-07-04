using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace RustPatch.Services;

public static class RustPathLocator
{
    private const string RustRelativeCfgPath = @"steamapps\common\Rust\cfg\keys.cfg";

    /// <summary>
    /// Looks for keys.cfg under the main Steam install and any additional
    /// library folders declared in libraryfolders.vdf.
    /// </summary>
    public static string? FindKeysCfg()
    {
        foreach (var steamPath in GetSteamInstallPaths())
        {
            foreach (var libraryPath in GetLibraryFolders(steamPath))
            {
                var candidate = Path.Combine(libraryPath, RustRelativeCfgPath);
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }
        }

        return null;
    }

    private static IEnumerable<string> GetSteamInstallPaths()
    {
        string?[] registryKeys =
        [
            GetRegistryValue(Registry.CurrentUser, @"Software\Valve\Steam", "SteamPath"),
            GetRegistryValue(Registry.LocalMachine, @"SOFTWARE\WOW6432Node\Valve\Steam", "InstallPath"),
            GetRegistryValue(Registry.LocalMachine, @"SOFTWARE\Valve\Steam", "InstallPath"),
        ];

        foreach (var path in registryKeys)
        {
            if (!string.IsNullOrEmpty(path))
            {
                yield return path.Replace('/', '\\');
            }
        }
    }

    private static string? GetRegistryValue(RegistryKey root, string subKey, string valueName)
    {
        using var key = root.OpenSubKey(subKey);
        return key?.GetValue(valueName) as string;
    }

    private static IEnumerable<string> GetLibraryFolders(string steamPath)
    {
        yield return steamPath;

        var vdfPath = Path.Combine(steamPath, "steamapps", "libraryfolders.vdf");
        if (!File.Exists(vdfPath))
        {
            yield break;
        }

        var content = File.ReadAllText(vdfPath);
        foreach (Match match in Regex.Matches(content, "\"path\"\\s*\"([^\"]+)\""))
        {
            yield return match.Groups[1].Value.Replace(@"\\", "\\");
        }
    }
}
