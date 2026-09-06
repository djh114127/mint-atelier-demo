import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  getCloudSecretStatus,
  resolveCloudApiKey,
  saveCloudApiKey,
} from "./cloudSecrets.mjs";

test("cloud API keys persist locally without being exposed by the status response", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mint-atelier-secrets-test-"));
  const previousDirectory = process.env.MINT_ATELIER_DATA_DIR;
  process.env.MINT_ATELIER_DATA_DIR = directory;

  try {
    await saveCloudApiKey("text", "sk-test-text-123456");
    await saveCloudApiKey("image", "sk-test-image-654321");

    const status = await getCloudSecretStatus();
    assert.equal(status.text.hasApiKey, true);
    assert.equal(status.image.hasApiKey, true);
    assert.equal(JSON.stringify(status).includes("sk-test"), false);
    assert.equal(await resolveCloudApiKey("text"), "sk-test-text-123456");
    assert.equal(await resolveCloudApiKey("image", "request-only-key"), "request-only-key");

    const stored = JSON.parse(await readFile(path.join(directory, "secrets.json"), "utf8"));
    assert.equal(stored.channels.text.apiKey, "sk-test-text-123456");
    assert.equal(stored.channels.image.apiKey, "sk-test-image-654321");
  } finally {
    if (previousDirectory === undefined) delete process.env.MINT_ATELIER_DATA_DIR;
    else process.env.MINT_ATELIER_DATA_DIR = previousDirectory;
    await rm(directory, { force: true, recursive: true });
  }
});
