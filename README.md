# @fxyz/money-flow (standalone)

[![CI](https://github.com/fxyznetwork/fxyz-money-flow/actions/workflows/ci.yml/badge.svg)](https://github.com/fxyznetwork/fxyz-money-flow/actions/workflows/ci.yml)

A gravity-model (Tinbergen) bilateral trade-flow globe, transaction-particle
system, and member-point cloud, built on three.js / React Three Fiber.

Extracted from the [ƒxyz](https://fxyz.network) network's internal
`money-flow` visualization package as a general-purpose, dependency-light
component. Visualization only, no personal data by design — see
[`packages/money-flow/README.md`](./packages/money-flow/README.md) for full
usage.

## Layout

This is a pnpm workspace with a single package:

| Package | What it is |
|---|---|
| `packages/money-flow` | The visualization package (`@fxyz/money-flow`). |

## The gravity model

Bilateral corridor weight follows Tinbergen's gravity model of trade:

```
flow ∝ (mass_i · mass_j) / (distance + ε)²
```

`mass` is each country's GDP tier; `distance` is great-circle distance between
centroids; `ε` is a small floor (100km in this implementation) added to the
denominator so near-adjacent centroid pairs (e.g. Singapore–Kuala Lumpur)
don't blow up toward infinity. Tinbergen (1962) showed bilateral trade
follows the same inverse-square form as Newtonian gravity — larger, closer
economies trade proportionally more.

Citations already present in the source docblocks:

- **Tinbergen (1962)** — origin of the gravity model of trade
  (`src/data/gravity-bilateral.ts`).
- **Soramäki, Bech, Arnold, Glass, Beyeler, "The Topology of Interbank
  Payment Flows," Physica A 379 (2007)** — eigenvector centrality, used to
  surface "money-center" hub countries (`src/data/centrality.ts`).
- **Battiston, Puliga, Kaushik, Tasca, Caldarelli, "DebtRank: Too Central to
  Fail? Financial Networks, the FED and Systemic Risk," Scientific Reports
  2:541 (2012)** — DebtRank systemic-importance ranking
  (`src/data/debt-rank.ts`).
- **Šavrič, Patterson, Jenny (2019), Cartographic Journal 56(3)** — Equal
  Earth projection, the "flat" pole of the sphere⇄flat globe morph
  (`src/scene/projection.ts`).

## Integration notes

- The component renders full-viewport: `position: fixed; inset: 0` (see the
  root `<div>` in `src/money-flow-client.tsx`). It is not meant to be
  embedded inline in a normal document flow without wrapping it yourself.
- The HUD (`src/hud/hud-overlay.tsx`) is styled with Tailwind utility
  classes. A host application without Tailwind configured will get an
  unstyled HUD — the controls still function, they just won't look right.
- `/borders-110m.json` is an OPTIONAL Natural Earth 110m country-outline
  asset. It is not bundled with this package. If you enable `showBorders`,
  you need to generate and ship this file yourself at your app's public
  root — see `src/scene/country-borders.tsx` for the exact format and
  source. Left disabled, the graticule and country markers still provide
  geographic structure.

## Development

```sh
pnpm install
pnpm typecheck   # pnpm -r exec tsc --noEmit
pnpm test        # pnpm -r exec vitest run
```

## Provenance

ƒxyz grew out of [Lagrange](https://github.com/Lagrange-fi), a Solana
forex/DeFi project — its predecessor, whose repositories remain archived as
history. This repository contains ƒxyz's own general-purpose code, not
Lagrange's.

## Contributing

Issues and pull requests are welcome — see
[CONTRIBUTING.md](./CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). For security reports, see
[SECURITY.md](./SECURITY.md).

## License

[Apache License 2.0](./LICENSE) — see also [NOTICE](./NOTICE).
