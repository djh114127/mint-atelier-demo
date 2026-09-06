import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const CHANNELS = new Set(["text", "image"]);
let writeQueue = Promise.resolve();

function dataDirectory() {
  const configured = String(process.env.MINT_ATELIER_DATA_DIR ?? "").trim();
  return configured ? path.resolve(configured) : path.join(homedir(), ".mint-atelier");
}

function secretsPath() {
  return path.join(dataDirectory(), "secrets.json");
}

function assertChannel(channel) {
  if (!CHANNELS.has(channel)) {
    throw new Error(`Unsupported cloud credential channel: ${channel}`);
  }
}

async function readSecrets() {
  try {
    const parsed = JSON.parse(await readFile(secretsPath(), "utf8"));
    return {
      version: 1,
      channels: {
        text: { apiKey: String(parsed?.channels?.text?.apiKey ?? "") },
        image: { apiKey: String(parsed?.channels?.image?.apiKey ?? "") },
      },
      updatedAt: String(parsed?.updatedAt ?? ""),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        version: 1,
        channels: { text: { apiKey: "" }, image: { apiKey: "" } },
        updatedAt: "",
      };
    }
    throw error;
  }
}

async function writeSecrets(value) {
  const directory = dataDirectory();
  const targetPath = secretsPath();
  const temporaryPath = path.join(directory, `.secrets-${process.pid}-${Date.now()}.tmp`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, targetPath);
  try {
    await chmod(targetPath, 0o600);
  } catch {
    // Windows does not always expose POSIX permission changes. The file remains local to the user profile.
  }
}

export async function getCloudSecretStatus() {
  const secrets = await readSecrets();
  return {
    text: { hasApiKey: Boolean(secrets.channels.text.apiKey.trim()) },
    image: { hasApiKey: Boolean(secrets.channels.image.apiKey.trim()) },
    updatedAt: secrets.updatedAt,
  };
}

export async function saveCloudApiKey(channel, apiKey) {
  assertChannel(channel);
  const normalizedKey = String(apiKey ?? "").trim();
  if (normalizedKey.length < 8 || normalizedKey.length > 4096) {
    throw new Error("API Key must contain between 8 and 4096 characters.");
  }

  const operation = writeQueue.then(async () => {
    const secrets = await readSecrets();
    const updatedAt = new Date().toISOString();
    const nextValue = {
      ...secrets,
      version: 1,
      channels: {
        ...secrets.channels,
        [channel]: { apiKey: normalizedKey },
      },
      updatedAt,
    };
    await writeSecrets(nextValue);
    return { channel, hasApiKey: true, updatedAt };
  });

  writeQueue = operation.catch(() => {});
  return operation;
}

export async function resolveCloudApiKey(channel, suppliedKey = "") {
  assertChannel(channel);
  const requestKey = String(suppliedKey ?? "").trim();
  if (requestKey) return requestKey;
  const secrets = await readSecrets();
  return secrets.channels[channel].apiKey.trim();
}

export function getMintAtelierDataDirectory() {
  return dataDirectory();
}
