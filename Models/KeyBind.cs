using CommunityToolkit.Mvvm.ComponentModel;

namespace RustPatch.Models;

public partial class KeyBind : ObservableObject
{
    [ObservableProperty]
    private string key;

    [ObservableProperty]
    private string command;

    [ObservableProperty]
    private bool hasConflict;

    public KeyBind(string key, string command)
    {
        this.key = key;
        this.command = command;
    }
}
