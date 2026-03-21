import { defineConfig } from "vite";
import { moostVite } from "@moostjs/vite";

export default defineConfig({
  plugins: [
    moostVite({
      entry: "/src/main.ts",
    }),
  ],
});
