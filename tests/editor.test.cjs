const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { readRepositoryFile, writeRepositoryFile, resolveRepositoryPath } = require("../dist-electron/electron/fileService.js");
const { GitService } = require("../dist-electron/electron/gitService.js");
const { EditorService } = require("../dist-electron/electron/editorService.js");
let root;
before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), "gitpilot-editor-tests-")); });
after(async () => {
  const resolved = await fs.realpath(root);
  const temporaryRoot = await fs.realpath(os.tmpdir());
  assert.equal(path.dirname(resolved), temporaryRoot);
  assert.ok(path.basename(resolved).startsWith("gitpilot-editor-tests-"));
  await fs.rm(resolved, { recursive: true, force: true });
});

test("create and save UTF-8 code, reject overwriting an existing new file", async () => {
  const created = await writeRepositoryFile(root, "hello.py", "print('你好')\n");
  assert.equal(created.encoding, "UTF-8");
  assert.equal(created.content, "print('你好')\n");
  const saved = await writeRepositoryFile(root, "hello.py", "print('edited')\n", created.revision);
  assert.equal(saved.content, "print('edited')\n");
  await assert.rejects(writeRepositoryFile(root, "hello.py", "replaced"), { code: "EEXIST" });
});

test("save preserves UTF-8 BOM and CRLF", async () => {
  await fs.writeFile(path.join(root, "crlf.cpp"), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("int main() {\r\n  return 0;\r\n}\r\n")]));
  const original = await readRepositoryFile(root, "crlf.cpp");
  assert.equal(original.lineEnding, "CRLF");
  assert.ok(!original.content.includes("\r"));
  await writeRepositoryFile(root, "crlf.cpp", original.content.replace("return 0", "return 1"), original.revision);
  const saved = await fs.readFile(path.join(root, "crlf.cpp"));
  assert.deepEqual([...saved.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(saved.subarray(3).toString(), "int main() {\r\n  return 1;\r\n}\r\n");
});

for (const bigEndian of [false, true]) test(`save preserves UTF-16 ${bigEndian ? "BE" : "LE"}`, async () => {
  const filename = bigEndian ? "utf16be.ps1" : "utf16le.ps1";
  const body = Buffer.from("Write-Host '你好'\r\n", "utf16le");
  if (bigEndian) body.swap16();
  await fs.writeFile(path.join(root, filename), Buffer.concat([Buffer.from(bigEndian ? [0xfe, 0xff] : [0xff, 0xfe]), body]));
  const original = await readRepositoryFile(root, filename);
  assert.equal(original.encoding, bigEndian ? "UTF-16 BE" : "UTF-16 LE");
  const saved = await writeRepositoryFile(root, filename, original.content + "# edited\n", original.revision);
  assert.equal(saved.encoding, original.encoding);
  assert.equal(saved.lineEnding, "CRLF");
  assert.equal(saved.content, "Write-Host '你好'\n# edited\n");
});

test("GB18030 can be viewed without being silently converted on save", async () => {
  await fs.writeFile(path.join(root, "legacy.c"), Buffer.from([0x2f, 0x2f, 0x20, 0xc4, 0xe3, 0xba, 0xc3, 0x0a]));
  const document = await readRepositoryFile(root, "legacy.c");
  assert.equal(document.content, "// 你好\n");
  assert.equal(document.readOnly, true);
  await assert.rejects(writeRepositoryFile(root, "legacy.c", "change", document.revision), /external editor/);
});

test("external modifications refuse a stale save and leave the disk untouched", async () => {
  const original = await writeRepositoryFile(root, "external.sh", "echo original\n");
  await fs.writeFile(path.join(root, "external.sh"), "echo external\n");
  await assert.rejects(writeRepositoryFile(root, "external.sh", "echo stale\n", original.revision), /changed on disk/);
  assert.equal(await fs.readFile(path.join(root, "external.sh"), "utf8"), "echo external\n");
});

test("refuse binary and oversized files", async () => {
  await fs.writeFile(path.join(root, "binary.bin"), Buffer.from([0, 1, 2, 3]));
  await assert.rejects(readRepositoryFile(root, "binary.bin"), /Binary files/);
  await fs.writeFile(path.join(root, "large.txt"), Buffer.alloc(4 * 1024 * 1024 + 1, 65));
  await assert.rejects(readRepositoryFile(root, "large.txt"), /4 MB/);
  await assert.rejects(writeRepositoryFile(root, "large-new.txt", "a".repeat(4 * 1024 * 1024 + 1)), /4 MB/);
});

test("refuse traversal, absolute paths, Git metadata, and Windows alternate streams", async () => {
  for (const filename of ["../outside", "folder/../../outside", path.join(root, "hello.py"), ".git/config", ".GIT/config", "hello.py:stream", "hello.py\0x", "folder/../hello.py"]) {
    await assert.rejects(resolveRepositoryPath(root, filename));
  }
});

test("refuse directory symlinks escaping the repository", async () => {
  const inside = path.join(root, "repo");
  const outside = path.join(root, "outside");
  await fs.mkdir(inside); await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, "secret.py"), "private");
  await fs.symlink(outside, path.join(inside, "escape"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(readRepositoryFile(inside, "escape/secret.py"), /inside the repository/);
  await assert.rejects(writeRepositoryFile(inside, "escape/new.py", "bad"), /inside the repository/);
});

test("repository list includes tracked and untracked files and excludes ignored and deleted paths", async () => {
  const repository = path.join(root, "listing");
  await fs.mkdir(repository);
  execFileSync("git", ["init", repository], { stdio: "ignore", windowsHide: true });
  await fs.writeFile(path.join(repository, ".gitignore"), "ignored/\n");
  await fs.writeFile(path.join(repository, "tracked.py"), "print(1)");
  await fs.writeFile(path.join(repository, "deleted.py"), "print(2)");
  execFileSync("git", ["-C", repository, "add", "--", "tracked.py", "deleted.py"], { stdio: "ignore", windowsHide: true });
  await fs.unlink(path.join(repository, "deleted.py"));
  await fs.writeFile(path.join(repository, "untracked.sh"), "echo 1");
  await fs.mkdir(path.join(repository, "ignored"));
  await fs.writeFile(path.join(repository, "ignored", "hidden.py"), "hidden");
  const files = await new GitService(() => {}).getRepositoryFiles(repository);
  assert.ok(files.includes("tracked.py")); assert.ok(files.includes("untracked.sh"));
  assert.ok(!files.includes("deleted.py")); assert.ok(!files.includes("ignored/hidden.py"));
});

test("custom editor launch passes an exact file argument with spaces and shell characters", async () => {
  const service = new EditorService();
  const editor = await service.add(process.execPath);
  const filename = "launch & $ file.js";
  await fs.writeFile(path.join(root, filename), `require('node:fs').writeFileSync('editor-launch-result.txt', process.argv[1]);`);
  await service.open(root, editor.id, filename);
  const marker = path.join(root, "editor-launch-result.txt");
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await fs.stat(marker).catch(() => false)) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(await fs.readFile(marker, "utf8"), path.join(root, filename));
  await assert.rejects(service.open(root, "missing-editor", filename), /Rescan/);
  await assert.rejects(service.open(root, editor.id, "../outside.js"), /Invalid file path/);
});
