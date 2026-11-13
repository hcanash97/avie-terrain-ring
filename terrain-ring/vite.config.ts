import { mkdirSync, writeFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  build: {
    assetsInlineLimit: 100000,
    // The single-file review page (scripts/make-artifact.mjs) inlines one script,
    // so that build keeps lazily loaded views in the same bundle.
    rollupOptions: process.env.ARTIFACT ? { output: { inlineDynamicImports: true } } : {}
  },
  plugins: [
    react(),
    {
      // Dev-only endpoint: POST a PNG data URL to /__capture?name=… to save it in ../captures.
      name: "capture-endpoint",
      configureServer(server) {
        server.middlewares.use("/__capture", (req, res) => {
          const name = new URL(req.url ?? "", "http://x").searchParams.get("name")!.replace(/[^a-z0-9_-]/gi, "");
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            mkdirSync("../captures", { recursive: true });
            writeFileSync(`../captures/${name}.png`, Buffer.from(body.split(",")[1]!, "base64"));
            res.end("ok");
          });
        });
      }
    }
  ],
  server: { port: 5173 },
  test: { environment: "node" }
} as never);
