const fs = require("node:fs/promises");
const path = require("node:path");
const { load } = require("resedit/cjs");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const executableName = `${context.packager.appInfo.productFilename}.exe`;
  const executablePath = path.join(context.appOutDir, executableName);
  const iconPath = path.join(context.packager.projectDir, "build", "icon.ico");
  const [executableData, iconData, ResEdit] = await Promise.all([
    fs.readFile(executablePath),
    fs.readFile(iconPath),
    load()
  ]);

  const executable = ResEdit.NtExecutable.from(executableData);
  const resources = ResEdit.NtExecutableResource.from(executable);
  const iconGroups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);

  if (iconGroups.length === 0) {
    throw new Error(`No icon group was found in ${executableName}`);
  }

  const icons = ResEdit.Data.IconFile.from(iconData).icons.map((item) => item.data);
  for (const iconGroup of iconGroups) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      resources.entries,
      iconGroup.id,
      iconGroup.lang,
      icons
    );
  }

  resources.outputResource(executable);
  await fs.writeFile(executablePath, Buffer.from(executable.generate()));
  console.log(`Applied build/icon.ico to ${executableName}`);
};
