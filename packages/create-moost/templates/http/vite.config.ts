import { defineConfig  } from "vite";
import swc from 'unplugin-swc';
import { moostVite } from "@moostjs/vite";

export default defineConfig({
  plugins: [
    moostVite({
      entry: "/src/main.ts",
    }),
    swc.vite(), 
  ],
});

