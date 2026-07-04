using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using RustPatch.Models;
using RustPatch.Services;

namespace RustPatch.ViewModels;

public partial class MainViewModel : ObservableObject
{
    [ObservableProperty]
    private string? cfgPath;

    [ObservableProperty]
    private string statusMessage = string.Empty;

    [ObservableProperty]
    private bool isRustRunning;

    public ObservableCollection<KeyBind> Binds { get; } = [];

    public MainViewModel()
    {
        Binds.CollectionChanged += OnBindsCollectionChanged;
        LoadFromDisk();
    }

    private void LoadFromDisk()
    {
        var path = RustPathLocator.FindKeysCfg();
        if (path is null)
        {
            StatusMessage = "Could not find Rust's keys.cfg under the default Steam install.";
            return;
        }

        LoadFromPathInternal(path);
    }

    private void LoadFromPathInternal(string path)
    {
        _isReloading = true;
        CfgPath = path;
        var loaded = KeysCfgService.Load(path);
        Binds.Clear();
        foreach (var bind in loaded)
        {
            Binds.Add(bind);
        }

        RefreshConflicts();
        _isReloading = false;
    }

    [RelayCommand]
    private void DetectPath()
    {
        var path = RustPathLocator.FindKeysCfg();
        if (path is not null)
        {
            LoadFromPathInternal(path);
            StatusMessage = $"Loaded {Binds.Count} binds from {path}";
        }
        else
        {
            StatusMessage = "Could not find Rust's keys.cfg automatically.";
        }
    }

    [RelayCommand]
    private void LoadFromPath(string path)
    {
        _isReloading = true;
        CfgPath = path;
        var loaded = KeysCfgService.Load(path);
        Binds.Clear();
        foreach (var bind in loaded)
        {
            Binds.Add(bind);
        }

        RefreshConflicts();
        _isReloading = false;
    }

    private bool _isReloading;

    partial void OnCfgPathChanged(string? value)
    {
        if (!_isReloading && value is not null && System.IO.File.Exists(value))
        {
            LoadFromPathInternal(value);
        }
    }

    [RelayCommand]
    private void AddBind()
    {
        Binds.Add(new KeyBind(string.Empty, string.Empty));
    }

    [RelayCommand]
    private void RemoveBind(KeyBind bind)
    {
        Binds.Remove(bind);
    }

    partial void OnIsRustRunningChanged(bool value)
    {
        StatusMessage = value
            ? "Rust is running — changes may not apply until you restart the game."
            : $"{Binds.Count} binds loaded.";
    }

    private void OnBindsCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (e.NewItems is not null)
        {
            foreach (KeyBind bind in e.NewItems)
            {
                bind.PropertyChanged += OnBindPropertyChanged;
            }
        }

        if (e.OldItems is not null)
        {
            foreach (KeyBind bind in e.OldItems)
            {
                bind.PropertyChanged -= OnBindPropertyChanged;
            }
        }

        RefreshConflicts();
        if (!_isReloading)
        {
            SaveToDisk();
        }
    }

    private void OnBindPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(KeyBind.HasConflict) || _isReloading)
        {
            return;
        }

        RefreshConflicts();
        SaveToDisk();
    }

    private void RefreshConflicts()
    {
        var keyCounts = Binds
            .Where(b => !string.IsNullOrWhiteSpace(b.Key))
            .GroupBy(b => b.Key)
            .ToDictionary(g => g.Key, g => g.Count());

        foreach (var bind in Binds)
        {
            bind.HasConflict = !string.IsNullOrWhiteSpace(bind.Key) && keyCounts[bind.Key] > 1;
        }
    }

    private void SaveToDisk()
    {
        if (CfgPath is not null)
        {
            KeysCfgService.Save(CfgPath, Binds);
        }
    }
}
