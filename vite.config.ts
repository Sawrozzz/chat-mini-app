import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";

// 1. Define a tiny custom plugin to mutate manifest.json
function addFrameworkToManifest(frameworkName: string): Plugin {
  return {
    name: "framework",
    // writeBundle runs right after Vite writes all dist files to disk
    async writeBundle(options) {
      const outDir = options.dir || "dist";
      // Vite 5+ defaults manifest to dist/manifest.json or dist/.vite/manifest.json
      const possibleManifestPaths = [
        path.resolve(outDir, "manifest.json"),
        path.resolve(outDir, ".vite/manifest.json"),
      ];

      const manifestPath = possibleManifestPaths.find((p) => fs.existsSync(p));

      if (manifestPath) {
        const manifestContent = JSON.parse(
          fs.readFileSync(manifestPath, "utf-8")
        );

        // Loop through all chunks in the manifest and inject the field
        Object.keys(manifestContent).forEach((key) => {
          manifestContent[key].framework = frameworkName;
        });

        // Save updated manifest.json back to disk
        fs.writeFileSync(
          manifestPath,
          JSON.stringify(manifestContent, null, 2)
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "classic",
    }),
    tailwindcss(),
    addFrameworkToManifest("react"), 
  ],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    target: "chrome89",
    manifest: "manifest.json",
    outDir: "dist",
    cssCodeSplit: true,
    lib: {
      entry: "./src/main.tsx",
      name: "ChatMiniApp",
      formats: ["es"],
      fileName: () => "[name][hash].js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        format: "es",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    host: "0.0.0.0",
    cors: true,
    headers: { "Access-Control-Allow-Origin": "*" },
  },
});