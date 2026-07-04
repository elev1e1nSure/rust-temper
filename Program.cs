using Microsoft.UI.Xaml;

namespace RustPatch;

public static class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        Application.Start(_ =>
        {
            new App();
        });
    }
}
