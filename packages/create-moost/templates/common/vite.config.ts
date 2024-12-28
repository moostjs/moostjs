import { defineConfig, type Plugin } from "vite";
import swc from 'unplugin-swc';
import { moostViteDev } from "@moostjs/vite";

export default defineConfig({
  plugins: [
    moostViteDev({
      entry: "/src/main.ts",
    }),
    swc.vite(), 
  ],
});

