# @fxyz/money-flow-demo

Minimal Vite + React 19 app that mounts [`@fxyz/money-flow`](../../packages/money-flow)
with its bundled `EXAMPLE_MEMBER_POINTS` dataset — no backend, no real data.
This exists so a reviewer can run one command and see the globe, and so a
hero screenshot can be captured for the root README.

## Run it

From the repository root:

```sh
pnpm install
pnpm --filter @fxyz/money-flow-demo dev
```

Then open the printed `localhost` URL. `Ctrl/Cmd+click` the canvas to orbit;
press `?` to toggle the HUD if you hide it.

## Build

```sh
pnpm --filter @fxyz/money-flow-demo build
pnpm --filter @fxyz/money-flow-demo preview
```

`vite build` writes to `dist/`. The build sets `base: "/fxyz-money-flow/"`
to match the GitHub Pages project path (see `vite.config.ts`) — dev/preview
stay at `/`.

## What's wired

- `src/App.tsx` imports `MoneyFlowClient` (not `MoneyFlowMount` — that
  wrapper's `next/dynamic` `ssr: false` shim is only needed inside Next.js;
  a plain Vite SPA doesn't have a server-render step to opt out of) and
  mounts it with `mode="lab"` so the full HUD is visible.
- No `members` prop is passed, so the package falls back to its own bundled
  `EXAMPLE_MEMBER_POINTS` (20 fabricated points, no real people or accounts).
- Tailwind CSS v4 (`@tailwindcss/vite`) is wired in `src/index.css` purely
  because the package's HUD (`src/hud/hud-overlay.tsx`) is styled with
  Tailwind utility classes — per the package README's integration notes, a
  host app without Tailwind gets an *unstyled but functional* HUD. This
  demo adds the one-line plugin so the HUD renders as designed.
- `showBorders` is left at the package's own default (`false`) — the
  Natural Earth `/borders-110m.json` asset isn't bundled with the package,
  and this demo doesn't add it.
- `useRealData` is left at the package's own default (`false`) — nothing
  in this demo ever fetches `/api/fx/bilateral` or any other endpoint. All
  visuals come from the bundled gravity model + BIS Triennial 2025 table +
  the example member points.
