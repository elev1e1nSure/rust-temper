using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;
using System.Diagnostics;

namespace RustPatch;

public sealed partial class MainPage : Page
{
    public MainPage()
    {
        InitializeComponent();
    }

    private void OnButton1Click(object sender, RoutedEventArgs e)
    {
        Debug.WriteLine("Button 1 clicked");
    }

    private void OnButton2Click(object sender, RoutedEventArgs e)
    {
        Debug.WriteLine("Button 2 clicked");
    }
}
