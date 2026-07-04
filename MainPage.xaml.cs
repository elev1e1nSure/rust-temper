using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using RustPatch.Models;
using RustPatch.Services;
using RustPatch.ViewModels;

namespace RustPatch;

public sealed partial class MainPage : Page
{
    public static Models.CommandPreset[] KnownCommands => Services.KnownCommands.Presets;

    public MainViewModel ViewModel { get; } = new();

    private RustProcessWatcher? _rustWatcher;

    public MainPage()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _rustWatcher = new RustProcessWatcher(DispatcherQueue);
        _rustWatcher.RunningStateChanged += (_, isRunning) => ViewModel.IsRustRunning = isRunning;
        _rustWatcher.Start();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        _rustWatcher?.Dispose();
    }

    private void OnAddBindClick(object sender, RoutedEventArgs e)
    {
        ViewModel.AddBindCommand.Execute(null);
    }

    private void OnRemoveBindClick(object sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: KeyBind bind })
        {
            ViewModel.RemoveBindCommand.Execute(bind);
        }
    }

    private void OnCommandSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (sender is ComboBox { Tag: KeyBind bind, SelectedItem: CommandPreset preset })
        {
            bind.Command = preset.Command;
        }
    }

    private void OnNavigationSelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
    }
}
