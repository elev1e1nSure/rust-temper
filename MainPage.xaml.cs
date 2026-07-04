using System;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Animation;
using RustPatch.Models;
using RustPatch.Services;
using RustPatch.ViewModels;
using RustPatch.Views;
using Windows.Storage.Pickers;
using Windows.Storage;
using WinRT.Interop;

namespace RustPatch;

public sealed partial class MainPage : Page
{
    public static Models.CommandPreset[] KnownCommands => Services.KnownCommands.Presets;

    public MainViewModel ViewModel { get; } = new();

    private RustProcessWatcher? _rustWatcher;
    private bool _isNavigating;

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

    private async void OnNavigationSelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        if (_isNavigating) return;

        var tag = (args.SelectedItemContainer?.Tag as string) ?? "binds";
        var incoming = tag switch
        {
            "binds" => BindsPanel,
            "presets" => PresetsPanel,
            "settings" => SettingsPanel,
            _ => BindsPanel
        };
        var outgoing = GetVisiblePanel();

        if (outgoing == incoming) return;
        _isNavigating = true;

        if (outgoing is not null)
        {
            await CarouselSwitch(outgoing, incoming);
        }
        else
        {
            BindsPanel.Visibility = Visibility.Collapsed;
            PresetsPanel.Visibility = Visibility.Collapsed;
            SettingsPanel.Visibility = Visibility.Collapsed;
            incoming.Visibility = Visibility.Visible;
            incoming.Opacity = 0;
            await AnimateAsync(incoming, "Opacity", 0, 1, 200);
        }

        _isNavigating = false;
    }

    private UIElement? GetVisiblePanel()
    {
        if (BindsPanel.Visibility == Visibility.Visible) return BindsPanel;
        if (PresetsPanel.Visibility == Visibility.Visible) return PresetsPanel;
        if (SettingsPanel.Visibility == Visibility.Visible) return SettingsPanel;
        return null;
    }

    private Task CarouselSwitch(UIElement outgoing, UIElement incoming)
    {
        var tcs = new TaskCompletionSource();
        var offset = 48.0;
        var duration = TimeSpan.FromMilliseconds(300);

        outgoing.RenderTransform = new TranslateTransform();
        incoming.RenderTransform = new TranslateTransform { Y = offset };
        incoming.Visibility = Visibility.Visible;
        incoming.Opacity = 0;

        var sb = new Storyboard();

        sb.Children.Add(MakeAnim(outgoing.RenderTransform, "Y", 0, -offset, duration));
        sb.Children.Add(MakeAnim(outgoing, "Opacity", 1, 0, duration));
        sb.Children.Add(MakeAnim(incoming.RenderTransform, "Y", offset, 0, duration));
        sb.Children.Add(MakeAnim(incoming, "Opacity", 0, 1, duration));

        sb.Completed += (_, _) =>
        {
            outgoing.Visibility = Visibility.Collapsed;
            outgoing.RenderTransform = null;
            outgoing.Opacity = 1;
            incoming.RenderTransform = null;
            tcs.TrySetResult();
        };
        sb.Begin();
        return tcs.Task;
    }

    private static DoubleAnimation MakeAnim(DependencyObject target, string path, double from, double to, Duration duration)
    {
        var anim = new DoubleAnimation
        {
            From = from,
            To = to,
            Duration = duration,
            EnableDependentAnimation = true,
            EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
        };
        Storyboard.SetTarget(anim, target);
        Storyboard.SetTargetProperty(anim, path);
        return anim;
    }

    private static Task AnimateAsync(DependencyObject target, string path, double from, double to, int durationMs)
    {
        var tcs = new TaskCompletionSource();
        var sb = new Storyboard();
        sb.Children.Add(MakeAnim(target, path, from, to, TimeSpan.FromMilliseconds(durationMs)));
        sb.Completed += (_, _) => tcs.TrySetResult();
        sb.Begin();
        return tcs.Task;
    }

    private async void OnBrowseCfgClick(object sender, RoutedEventArgs e)
    {
        var picker = new FileOpenPicker();
        picker.FileTypeFilter.Add(".cfg");
        picker.FileTypeFilter.Add(".txt");
        picker.SuggestedStartLocation = PickerLocationId.ComputerFolder;

        var hwnd = WindowNative.GetWindowHandle(App.CurrentWindow);
        InitializeWithWindow.Initialize(picker, hwnd);

        var file = await picker.PickSingleFileAsync();
        if (file is not null)
        {
            var path = file.Path;
            if (System.IO.File.Exists(path))
            {
                ViewModel.LoadFromPathCommand.Execute(path);
            }
        }
    }
}
