import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";

app.whenReady().then(() => {
  const window = new BrowserWindow({ width: 800, height: 600 });
  window.loadFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "index.html"));
});

app.on("window-all-closed", () => app.quit());
