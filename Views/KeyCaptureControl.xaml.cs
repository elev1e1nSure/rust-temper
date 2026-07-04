using System;
using Microsoft.UI.Input;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using RustPatch.Services;

namespace RustPatch.Views;

public sealed partial class KeyCaptureControl : UserControl
{
    public static readonly DependencyProperty KeyNameProperty = DependencyProperty.Register(
        nameof(KeyName), typeof(string), typeof(KeyCaptureControl),
        new PropertyMetadata(string.Empty, OnKeyNamePropertyChanged));

    private bool _isListening;

    public string KeyName
    {
        get => (string)GetValue(KeyNameProperty);
        set => SetValue(KeyNameProperty, value);
    }

    public KeyCaptureControl()
    {
        InitializeComponent();
        UpdateDisplay();
    }

    private static void OnKeyNamePropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        ((KeyCaptureControl)d).UpdateDisplay();
    }

    private void UpdateDisplay()
    {
        DisplayText.Text = _isListening
            ? "Press a key..."
            : string.IsNullOrEmpty(KeyName) ? "(unbound)" : KeyName;
    }

    private void OnClick(object sender, RoutedEventArgs e)
    {
        _isListening = true;
        UpdateDisplay();
    }

    private void OnKeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (!_isListening)
        {
            return;
        }

        KeyName = RustKeyNames.FromVirtualKey(e.Key);
        _isListening = false;
        UpdateDisplay();
        e.Handled = true;
    }

    private void OnPointerPressed(object sender, PointerRoutedEventArgs e)
    {
        if (!_isListening)
        {
            return;
        }

        var point = e.GetCurrentPoint(this);
        var button = GetMouseButtonIndex(point.Properties);
        if (button is null)
        {
            return;
        }

        KeyName = RustKeyNames.FromMouseButton(button.Value);
        _isListening = false;
        UpdateDisplay();
        e.Handled = true;
    }

    private void OnPointerWheelChanged(object sender, PointerRoutedEventArgs e)
    {
        if (!_isListening)
        {
            return;
        }

        var delta = e.GetCurrentPoint(this).Properties.MouseWheelDelta;
        if (delta == 0)
        {
            return;
        }

        KeyName = delta > 0 ? "mousewheelup" : "mousewheeldown";
        _isListening = false;
        UpdateDisplay();
        e.Handled = true;
    }

    private static int? GetMouseButtonIndex(PointerPointProperties props)
    {
        if (props.IsLeftButtonPressed) return 0;
        if (props.IsRightButtonPressed) return 1;
        if (props.IsMiddleButtonPressed) return 2;
        if (props.IsXButton1Pressed) return 3;
        if (props.IsXButton2Pressed) return 4;
        return null;
    }
}
