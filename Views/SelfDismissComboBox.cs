using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;

namespace RustPatch.Views;

// Stock ComboBox only closes its dropdown when SelectionChanged fires, so tapping the
// already-selected item does nothing. This re-wires container taps to close it regardless,
// and makes sure opening one instance's dropdown closes whichever other instance was open
// (they're separate ComboBox instances per row, so nothing does this by default).
public sealed class SelfDismissComboBox : ComboBox
{
    private static SelfDismissComboBox? _currentlyOpen;

    public SelfDismissComboBox()
    {
        DropDownOpened += OnDropDownOpened;
        DropDownClosed += OnDropDownClosed;
    }

    private void OnDropDownOpened(object? sender, object e)
    {
        if (_currentlyOpen is { } other && !ReferenceEquals(other, this))
        {
            other.IsDropDownOpen = false;
        }

        _currentlyOpen = this;
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
