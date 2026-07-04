using System;
using System.Diagnostics;
using Microsoft.UI.Dispatching;

namespace RustPatch.Services;

public sealed class RustProcessWatcher : IDisposable
{
    private const string RustProcessName = "RustClient";
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(3);

    private readonly DispatcherQueueTimer _timer;

    public event EventHandler<bool>? RunningStateChanged;

    public bool IsRunning { get; private set; }

    public RustProcessWatcher(DispatcherQueue dispatcherQueue)
    {
        _timer = dispatcherQueue.CreateTimer();
        _timer.Interval = PollInterval;
        _timer.Tick += (_, _) => Poll();
    }

    public void Start()
    {
        Poll();
        _timer.Start();
    }

    private void Poll()
    {
        var isRunning = Process.GetProcessesByName(RustProcessName).Length > 0;
        if (isRunning == IsRunning)
        {
            return;
        }

        IsRunning = isRunning;
        RunningStateChanged?.Invoke(this, isRunning);
    }

    public void Dispose()
    {
        _timer.Stop();
    }
}
