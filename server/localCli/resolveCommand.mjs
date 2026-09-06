import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const WINDOWS_EXECUTABLE_EXTENSIONS = [".com", ".exe", ".bat", ".cmd"];
const NODE_SCRIPT_EXTENSIONS = new Set([".js", ".cjs", ".mjs"]);

function findOnWindowsPath(command, environment) {
  const pathValue = environment.Path || environment.PATH || "";
  const directories = pathValue
    .split(path.delimiter)
    .map((directory) => directory.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
  const hasExtension = Boolean(path.extname(command));
  const extensions = hasExtension
    ? [""]
    : (environment.PATHEXT || WINDOWS_EXECUTABLE_EXTENSIONS.join(";"))
        .split(";")
        .map((extension) => extension.trim().toLowerCase())
        .filter(Boolean);

  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${command}${extension}`);
      if (existsSync(candidate)) return candidate;
    }
  }

  return "";
}

function resolveNpmCommandShim(shimPath) {
  let content = "";
  try {
    content = readFileSync(shimPath, "utf8");
  } catch {
    return null;
  }

  const match = content.match(/%dp0%[\\/]([^"\r\n]+?\.(?:[cm]?js))"?\s+%\*/i);
  if (!match) return null;

  const scriptPath = path.resolve(
    path.dirname(shimPath),
    match[1].replace(/[\\/]+/g, path.sep),
  );
  if (!existsSync(scriptPath)) return null;

  return {
    command: process.execPath,
    prefixArgs: [scriptPath],
  };
}

export function resolveCliInvocation(command, environment = process.env) {
  const value = String(command ?? "").trim();
  if (process.platform !== "win32" || !value) {
    return { command: value, prefixArgs: [] };
  }

  const resolvedPath = path.isAbsolute(value)
    ? value
    : findOnWindowsPath(value, environment);
  if (!resolvedPath) {
    return { command: value, prefixArgs: [] };
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  if (NODE_SCRIPT_EXTENSIONS.has(extension)) {
    return { command: process.execPath, prefixArgs: [resolvedPath] };
  }

  if (extension === ".cmd" || extension === ".bat") {
    const npmShim = resolveNpmCommandShim(resolvedPath);
    if (npmShim) return npmShim;
    return { command: resolvedPath, prefixArgs: [] };
  }

  return { command: resolvedPath, prefixArgs: [] };
}
