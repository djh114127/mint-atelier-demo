import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveCliInvocation } from "./resolveCommand.mjs";

test("Windows npm command shims resolve to a shell-free Node invocation", {
  skip: process.platform !== "win32",
}, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "mint-cli-resolver-"));
  const scriptPath = path.join(directory, "tool.js");
  const shimPath = path.join(directory, "fake-cli.cmd");

  try {
    writeFileSync(scriptPath, "console.log('ok');\n");
    writeFileSync(shimPath, '@ECHO off\r\n"%_prog%" "%dp0%\\tool.js" %*\r\n');

    const invocation = resolveCliInvocation("fake-cli", {
      Path: directory,
      PATHEXT: ".CMD",
    });

    assert.equal(invocation.command, process.execPath);
    assert.deepEqual(invocation.prefixArgs, [scriptPath]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("missing commands remain unchanged so spawn can report ENOENT", () => {
  const invocation = resolveCliInvocation("definitely-missing-cli", {
    Path: "",
    PATHEXT: ".EXE;.CMD",
  });

  assert.deepEqual(invocation, {
    command: "definitely-missing-cli",
    prefixArgs: [],
  });
});
