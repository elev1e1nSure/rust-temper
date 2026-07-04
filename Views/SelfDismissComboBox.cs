using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;

namespace RustPatch.Views;

// Stock ComboBox only closes its dropdown when SelectionChanged fires, so tapping the
// already-selected item does nothing. This re-wires container taps to close it regardless.
public sealed class SelfDismissComboBox : ComboBox
{
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
