import { defineConfig } from "vite";

export default defineConfig({
  base: "/sim-enviroment/",
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "assets/index.css";
          }
          return "assets/[name][extname]";
        }
      }
    }
  }
});
