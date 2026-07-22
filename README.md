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
