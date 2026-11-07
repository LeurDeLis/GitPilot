import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";
import type { RepositoryFile } from "../src/types/git";

const MAX_FILE_SIZE = 4 * 1024 * 1024;

/** Canonicalize both ends so a symlink cannot escape the repository. */
export async function resolveRepositoryPath(repoPath: string, filePath?: string): Promise<string> {
  if (typeof repoPath !== "string" || !path.isAbsolute(repoPath)) throw new Error("Invalid repository path / 仓库路径无效");
  const root = await fs.realpath(repoPath);
  if (!(await fs.stat(root)).isDirectory()) throw new Error("Repository is not a directory / 仓库目录无效");
  if (filePath === undefined) return root;
  if (typeof filePath !== "string" || !filePath || filePath.includes("\0") || path.isAbsolute(filePath)) {
    throw new Error("Invalid file path / 文件路径无效");
  }
  const parts = filePath.replace(/\\/g, "/").split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git" || /[:]/.test(part)
    || (process.platform === "win32" && (/[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))))) {
    throw new Error("Invalid file path / 文件路径无效");
  }
  const target = path.resolve(root, ...parts);
  const parent = await fs.realpath(path.dirname(target));
  assertInside(root, parent);
  const canonical = await fs.realpath(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return path.join(parent, path.basename(target));
    throw error;
  });
  assertInside(root, canonical);
  return canonical;
}

function assertInside(root: string, target: string): void {
  const relative = path.relative(root, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
    || relative.split(path.sep).some((part) => part.toLowerCase() === ".git")) {
    throw new Error("File must be inside the repository / 文件必须位于当前仓库内");
  }
}

function decodeFile(filePath: string, bytes: Buffer): RepositoryFile {
  let encoding: RepositoryFile["encoding"] = "UTF-8";
  let content: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "UTF-16 LE";
    content = new TextDecoder("utf-16le", { fatal: true }).decode(bytes.subarray(2));
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = "UTF-16 BE";
    content = new TextDecoder("utf-16be", { fatal: true }).decode(bytes.subarray(2));
  } else {
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      encoding = "GB18030";
      content = new TextDecoder("gb18030", { fatal: true }).decode(bytes);
    }
  }
  if (/[\x00-\x08\x0e-\x1f]/.test(content)) {
    throw new Error("Binary files cannot be edited / 不支持编辑二进制文件，请使用外部应用打开");
  }
  return {
    path: filePath,
    content: content.replace(/\r\n/g, "\n"),
    revision: createHash("sha256").update(bytes).digest("hex"),
    encoding,
    lineEnding: content.includes("\r\n") ? "CRLF" : "LF",
    readOnly: encoding === "GB18030"
  };
}

async function readBytes(target: string): Promise<Buffer> {
  const handle = await fs.open(target, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_FILE_SIZE) throw new Error("Only text files up to 4 MB can be edited / 仅支持编辑 4 MB 以内的文本文件");
    const bytes = await handle.readFile();
    if (bytes.length > MAX_FILE_SIZE) throw new Error("File exceeds 4 MB / 文件超过 4 MB");
    return bytes;
  } finally {
    await handle.close();
  }
}

export async function readRepositoryFile(repoPath: string, filePath: string): Promise<RepositoryFile> {
  return decodeFile(filePath, await readBytes(await resolveRepositoryPath(repoPath, filePath)));
}

export async function writeRepositoryFile(repoPath: string, filePath: string, content: string, revision?: string): Promise<RepositoryFile> {
  if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE) throw new Error("File exceeds 4 MB / 文件超过 4 MB");
  const target = await resolveRepositoryPath(repoPath, filePath);
  if (revision === undefined) {
    // Exclusive creation never replaces an existing file, including a broken symlink.
    await fs.writeFile(target, content, { encoding: "utf8", flag: "wx" });
  } else {
    const original = await readBytes(target);
    const document = decodeFile(filePath, original);
    if (document.revision !== revision) throw new Error("File changed on disk. Reload before saving / 文件已被其他程序修改，请重新加载后再保存");
    if (document.readOnly) throw new Error("Use an external editor for this encoding / 请使用外部编辑器保存此编码的文件");
    const normalized = content.replace(/\r\n/g, "\n");
    const text = document.lineEnding === "CRLF" ? normalized.replace(/\n/g, "\r\n") : normalized;
    let bytes: Buffer;
    if (document.encoding.startsWith("UTF-16")) {
      bytes = Buffer.from(text, "utf16le");
      if (document.encoding === "UTF-16 BE") bytes.swap16();
      bytes = Buffer.concat([Buffer.from(document.encoding === "UTF-16 BE" ? [0xfe, 0xff] : [0xff, 0xfe]), bytes]);
    } else {
      bytes = Buffer.from(text, "utf8");
      if (original[0] === 0xef && original[1] === 0xbb && original[2] === 0xbf) bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]);
    }
    if (bytes.length > MAX_FILE_SIZE) throw new Error("File exceeds 4 MB / 文件超过 4 MB");
    const temporary = path.join(path.dirname(target), `.gitpilot-save-${randomUUID()}`);
    try {
      await fs.writeFile(temporary, bytes, { flag: "wx", mode: (await fs.stat(target)).mode });
      if (createHash("sha256").update(await readBytes(target)).digest("hex") !== revision) {
        throw new Error("File changed on disk. Reload before saving / 文件已被其他程序修改，请重新加载后再保存");
      }
      await fs.rename(temporary, target);
    } finally {
      await fs.unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
    }
  }
  return readRepositoryFile(repoPath, filePath);
}
