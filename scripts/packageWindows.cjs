const { spawn } = require("node:child_process");

const targets = process.argv.slice(2);
if (targets.length === 0) {
  targets.push("nsis", "portable");
}

const env = {
  ...process.env,
  ELECTRON_BUILDER_BINARIES_MIRROR:
    process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
    "https://npmmirror.com/mirrors/electron-builder-binaries/"
};

const builderCli = require.resolve("electron-builder/out/cli/cli.js");
const child = spawn(process.execPath, [builderCli, "--win", ...targets], {
  cwd: process.cwd(),
  env,
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error(`Unable to start electron-builder: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
