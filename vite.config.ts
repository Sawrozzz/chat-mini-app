import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {createManifest} from "./src/utils/createManifest.ts";

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",
    }),
    tailwindcss(),
      createManifest(),
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
      name: "RevenueMiniApp",
      formats: ["es"],
      fileName: () => "[name][hash].js",
    },
    rollupOptions: {
      output: {
        codeSplitting: false,
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
