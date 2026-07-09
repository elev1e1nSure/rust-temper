// Webview defaults to Chromium browser behavior (context menu, reload, devtools,
// find-in-page). Strip it in production builds so the app reads as native, not a webpage.
export function installNativeAppGuard(): void {
  window.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("keydown", (event) => {
    const key = event.key;
    const ctrlOrCmd = event.ctrlKey || event.metaKey;

    const blocked =
      key === "F5" ||
      key === "F12" ||
      (ctrlOrCmd && key.toLowerCase() === "r") ||
      (ctrlOrCmd && key.toLowerCase() === "f") ||
      (ctrlOrCmd && key.toLowerCase() === "g") ||
      (ctrlOrCmd && key.toLowerCase() === "p") ||
      (ctrlOrCmd && key.toLowerCase() === "u") ||
      (ctrlOrCmd && key.toLowerCase() === "s") ||
      (ctrlOrCmd &&
        event.shiftKey &&
        ["i", "j", "c"].includes(key.toLowerCase()));

    if (blocked) {
      event.preventDefault();
    }
  });
}
