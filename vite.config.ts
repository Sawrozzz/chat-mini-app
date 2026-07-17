import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "classic",
    }),
    tailwindcss(),
  ],
  build: {
    target: "chrome89",
    manifest: 'manifest.json',
    outDir: "dist",
    cssCodeSplit: true,
    lib: {
      entry: "./src/main.tsx",
      name: "ChatMiniApp",
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        format: "es",

        globals: {
          react: "window.React",
          "react-dom": "window.ReactDOM",
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
      external: ["react", "react-dom", "react/jsx-runtime"],
    },
  },
  server: {
    host: "0.0.0.0",
    cors: true,
    headers: { "Access-Control-Allow-Origin": "*" },
  },
});
