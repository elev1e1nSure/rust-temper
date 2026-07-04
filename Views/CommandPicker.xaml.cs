using System;
using System.Collections;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using RustPatch.Models;
using RustPatch.Services;

namespace RustPatch.Views;

// Replaces a retemplated ComboBox: WinUI's ComboBox popup insists on centering itself on the
// selected item (picker-style, overlapping the control) and reasserts that positioning no
// matter what gets overridden in the template or in code. A Button + Flyout gets correct
// below-the-control placement and single-open-at-a-time behavior for free.
public sealed partial class CommandPicker : UserControl
{
    public static readonly DependencyProperty ItemsSourceProperty = DependencyProperty.Register(
        nameof(ItemsSource), typeof(IEnumerable), typeof(CommandPicker),
        new PropertyMetadata(null));

    public static readonly DependencyProperty SelectedItemProperty = DependencyProperty.Register(
        nameof(SelectedItem), typeof(CommandPreset), typeof(CommandPicker),
        new PropertyMetadata(null, OnSelectedItemChanged));

    public event EventHandler<CommandPreset?>? SelectionChanged;

    public CommandPicker()
    {
        InitializeComponent();
        ItemsFlyout.Opening += (_, _) => ItemsList.ItemsSource = Services.KnownCommands.Presets;
    }

    public IEnumerable ItemsSource
    {
        get => (IEnumerable)GetValue(ItemsSourceProperty);
        set => SetValue(ItemsSourceProperty, value);
    }

    public CommandPreset? SelectedItem
    {
        get => (CommandPreset?)GetValue(SelectedItemProperty);
        set => SetValue(SelectedItemProperty, value);
    }

    private static void OnSelectedItemChanged(DependencyObject d, DependencyPropertyChangedEventArgs e) =>
        ((CommandPicker)d).UpdateDisplay();

    private void UpdateDisplay()
    {
        SelectedText.Text = SelectedItem?.Name ?? string.Empty;
        if (ItemsList is not null)
            ItemsList.SelectedItem = SelectedItem;
        ToolTipService.SetToolTip(ToggleButton, SelectedItem?.Description);
    }

    private void OnItemClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is CommandPreset preset)
        {
            SelectedItem = preset;
            SelectionChanged?.Invoke(this, preset);
        }

        ItemsFlyout.Hide();
    }
}
