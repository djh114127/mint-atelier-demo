import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sites } from "@openai/sites-vite-plugin";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { codexGenerateMiddleware } from "./server/codex/api.mjs";

function localGenerationApiPlugin() {
  return {
    name: "local-generation-api",
    configureServer(server) {
      server.middlewares.use(codexGenerateMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(codexGenerateMiddleware());
    },
  };
}

function sitesStaticWorkerPlugin() {
  return {
    name: "remove-unused-cloud-assets",
    apply: "build",
    async closeBundle() {
      await Promise.all(
        ["avatar-creator.png", "notebook-pencil.png", "spring-outfit.png"].map((filename) =>
          unlink(resolve("dist/client/assets", filename)).catch((error) => {
            if (error?.code !== "ENOENT") throw error;
          }),
        ),
      );
    },
  };
}

export default defineConfig(async () => {
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    optimizeDeps: {
      include: ["react", "react-dom/client"],
    },
    server: {
      warmup: {
        clientFiles: ["./src/main.jsx"],
      },
    },
    plugins: [
      localGenerationApiPlugin(),
      react(),
      sites(),
      cloudflare({ viteEnvironment: { name: "server" } }),
      sitesStaticWorkerPlugin(),
    ],
  };
});
