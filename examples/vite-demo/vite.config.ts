import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// "base" only matters for `vite build` — it must match the GitHub Pages
// project path (repo: fxyz-money-flow). Dev/preview stay at "/" so
// `pnpm --filter @fxyz/money-flow-demo dev` serves from localhost root.
export default defineConfig(({ command }) => ({
	base: command === "build" ? "/fxyz-money-flow/" : "/",
	plugins: [react(), tailwindcss()],
}));
