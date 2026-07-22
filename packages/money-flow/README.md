# @fxyz/money-flow

A gravity-model (Tinbergen) bilateral trade-flow globe, transaction-particle
system, and member-point cloud, built on [three.js](https://threejs.org) /
[React Three Fiber](https://docs.pmnd.rs/react-three-fiber).

Renders a plain dataset you give it — no backend required. Ships with a
fabricated 20-point example dataset so the member-point cloud has something
to show out of the box.

## What it does

- **World globe** — Earth substrate with a day/night terminator, atmosphere
  glow, and country markers at 86 capital-city centroids. Morphs between a
  sphere and an [Equal Earth](https://doi.org/10.1080/00087041.2018.1483585)
  (Šavrič, Patterson, Jenny 2019) flat map.
- **Bilateral corridors** — bezier-arc line segments between country pairs,
  weighted by a [Tinbergen gravity model](https://en.wikipedia.org/wiki/Gravity_model_of_trade)
  (economic mass × 1/distance²), optionally blended with a bundled BIS
  Triennial Survey 2025 currency-pair-share table.
- **Transaction particles** — up to 100K instanced particles flowing along
  the corridors, state packed into a `BigUint64Array` per particle.
- **Member-point cloud** — an optional `MemberPoint[]` overlay (id +
  classification bucket + ISO country code), positioned at country
  centroids or a deterministic Fibonacci-sphere fallback.
- **Network analysis** — eigenvector centrality
  ([Soramäki et al. 2007](https://doi.org/10.1016/j.physa.2006.11.093)) and
  DebtRank ([Battiston et al. 2012](https://doi.org/10.1038/srep00541))
  computed client-side on the bilateral matrix.
- **HUD overlay** — live FPS/drawcall stats, layer toggles, particle/speed
  controls (only rendered in `mode="lab"` by default).

## Data — no backend required

Every data source in this package is either bundled (BIS Triennial shares,
country centroids) or computed client-side (the gravity model, centrality,
DebtRank). Nothing is fetched by default.

The member-point cloud renders whatever `MemberPoint[]` you pass in, or a
small fabricated example dataset when you pass nothing:

```ts
export interface MemberPoint {
	id: string;
	magnitudeClass?: string | null; // classification bucket, drives color
	homeCountry?: string | null; // ISO 3166-1 alpha-2, drives position
}
```

That's the entire contract — there is no field here that can carry personal
data.

There is one OPTIONAL escape hatch: flip `useRealData` on in the HUD (or
pre-seed the controls) to attempt a fetch to `/api/fx/bilateral` for live
bilateral-flow data. This is off by default. If you enable it without a
matching backend, the fetch fails and the component silently falls back to
the synthetic gravity/Triennial matrix — see
[`src/data/use-bilateral-matrix.ts`](./src/data/use-bilateral-matrix.ts) for
the exact request/response shape if you want to implement it yourself.

## Install

This package is not yet published to a registry. Copy `packages/money-flow`
into your own project and add its dependencies:

```sh
pnpm add three @react-three/fiber @react-three/drei react
```

`next` is an optional peer — only needed if you use `MoneyFlowMount` (its
`next/dynamic` `ssr: false` wrapper). Drop that file and import
`MoneyFlowClient` directly if you're not on Next.js.

## Usage

```tsx
import { MoneyFlowMount } from "@fxyz/money-flow";

export default function FlowPage() {
	return <MoneyFlowMount mode="lab" />;
}
```

`mode="lab"` (default) shows the full HUD — every control exposed, good for
a demo page. `mode="prod"` renders with sealed defaults and hides the HUD
(toggle it back on with the `?` key).

### Bringing your own member-point data

```tsx
import { MoneyFlowMount, type MemberPoint } from "@fxyz/money-flow";

const points: MemberPoint[] = [
	{ id: "1", magnitudeClass: "G", homeCountry: "US" },
	{ id: "2", magnitudeClass: "K", homeCountry: "DE" },
	// ...
];

<MoneyFlowMount members={points} />;
```

Omit `members` and the package renders `EXAMPLE_MEMBER_POINTS` (also
exported) — 20 fabricated points, not real data.

## Package layout

| Path | Purpose |
|---|---|
| `src/index.ts` | Public exports |
| `src/money-flow-client.tsx` | Top-level client component (`"use client"`) |
| `src/money-flow-mount.tsx` | `next/dynamic` `ssr: false` wrapper |
| `src/hooks/use-reduced-motion.ts` | Standalone `prefers-reduced-motion` hook |
| `src/data/` | Bilateral matrix, gravity model, centrality/DebtRank, member-point data source |
| `src/scene/` | three.js scene primitives (globe, corridors, particles, graticule, borders, probe) |
| `src/hud/` | HUD overlay |

## Testing

```sh
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
```

## License

Apache-2.0 — see [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) at the
repository root.
