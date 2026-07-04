using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace RustPatch.Views;

// ComboBox whose dropdown popup (see Styles/BindComboBoxStyle.xaml) has a close button.
// TemplatedParent isn't exposed to managed code in WinUI, so GetTemplateChild is the only
// way to wire the button back to the control that owns the template.
public sealed class ClosableComboBox : ComboBox
{
    protected override void OnApplyTemplate()
    {
        base.OnApplyTemplate();

        if (GetTemplateChild("ClosePopupButton") is Button closeButton)
        {
            closeButton.Click -= OnClosePopupButtonClick;
            closeButton.Click += OnClosePopupButtonClick;
        }
    }

    private void OnClosePopupButtonClick(object sender, RoutedEventArgs e) => IsDropDownOpen = false;
}
