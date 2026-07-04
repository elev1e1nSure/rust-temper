using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Input;

namespace RustPatch.Views;

// Stock ComboBox only closes its dropdown when SelectionChanged fires, so tapping the
// already-selected item does nothing. This re-wires container taps to close it regardless,
// and makes sure opening one instance's dropdown closes whichever other instance was open
// (they're separate ComboBox instances per row, so nothing does this by default).
//
// It also forces the popup to open flush below the control. Stock ComboBox instead centers
// the popup on the selected item (picker-style, overlapping the control), and keeps
// reasserting that offset (e.g. when it scrolls the selected item into view) even after
// DropDownOpened fires and even with the reveal animation removed from the template — a
// single correction gets clobbered. Reapplying it on every LayoutUpdated while open wins
// the fight regardless of when the internal recentering happens.
public sealed class SelfDismissComboBox : ComboBox
{
    private static SelfDismissComboBox? _currentlyOpen;
    private Popup? _popup;

    public SelfDismissComboBox()
    {
        DropDownOpened += OnDropDownOpened;
        DropDownClosed += OnDropDownClosed;
    }

    protected override void OnApplyTemplate()
    {
        base.OnApplyTemplate();
        _popup = GetTemplateChild("Popup") as Popup;
    }

    private void OnDropDownOpened(object? sender, object e)
    {
        if (_currentlyOpen is { } other && !ReferenceEquals(other, this))
        {
            other.IsDropDownOpen = false;
        }

        _currentlyOpen = this;

        ForcePopupOffset();
        LayoutUpdated += OnLayoutUpdatedWhileOpen;
    }

    private void OnDropDownClosed(object? sender, object e)
    {
        LayoutUpdated -= OnLayoutUpdatedWhileOpen;

        if (ReferenceEquals(_currentlyOpen, this))
        {
            _currentlyOpen = null;
        }
    }

    private void OnLayoutUpdatedWhileOpen(object? sender, object e) => ForcePopupOffset();

    private void ForcePopupOffset()
    {
        if (_popup is null)
        {
            return;
        }

        var desired = ActualHeight;
        if (_popup.VerticalOffset != desired)
        {
            _popup.VerticalOffset = desired;
        }
    }

    protected override void PrepareContainerForItemOverride(DependencyObject element, object item)
    {
        base.PrepareContainerForItemOverride(element, item);

        if (element is ComboBoxItem comboBoxItem)
        {
            comboBoxItem.Tapped -= OnItemTapped;
            comboBoxItem.Tapped += OnItemTapped;
        }
    }

    private void OnItemTapped(object sender, TappedRoutedEventArgs e)
    {
        if (sender is ComboBoxItem { Content: { } content } && Equals(content, SelectedItem))
        {
            IsDropDownOpen = false;
        }
    }
}
