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
// the popup on the selected item (picker-style, overlapping the control) by setting the
// popup's VerticalOffset itself when it opens, which stomps over any offset set in XAML —
// so it has to be reapplied here, after the fact, once the dropdown is actually open.
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

        if (_popup is not null)
        {
            _popup.VerticalOffset = ActualHeight;
        }
    }

    private void OnDropDownClosed(object? sender, object e)
    {
        if (ReferenceEquals(_currentlyOpen, this))
        {
            _currentlyOpen = null;
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
