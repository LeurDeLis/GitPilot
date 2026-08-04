const path = require("node:path");
const { spawn } = require("node:child_process");
const waitOn = require("wait-on");

const electronPath = require("electron");
const rendererPort = Number(process.env.GITPILOT_RENDERER_PORT) || 5173;
const rendererUrl = `http://127.0.0.1:${rendererPort}`;
const electronMain = path.resolve(process.cwd(), "dist-electron/electron/main.js");
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;

waitOn({
  resources: [electronMain, rendererUrl],
  interval: 100,
  timeout: 300000
})
  .then(() => {
    const child = spawn(electronPath, ["."], {
      cwd: process.cwd(),
      env: environment,
      stdio: "inherit",
      windowsHide: false
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 0);
    });
  })
  .catch((error) => {
    console.error("Unable to start GitPilot:", error);
    process.exit(1);
  });
