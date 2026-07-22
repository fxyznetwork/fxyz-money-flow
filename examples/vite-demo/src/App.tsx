/**
 * Minimal demo shell for @fxyz/money-flow.
 *
 * This is a plain Vite + React app, not Next.js, so it imports
 * `MoneyFlowClient` directly (the `"use client"` component) rather than
 * `MoneyFlowMount` — that wrapper exists only to satisfy Next.js's
 * `ssr: false` + Server Components constraint and pulls in `next/dynamic`
 * as a peer, which a Vite app has no use for.
 *
 * No `members` prop is passed, so the package renders its own bundled
 * `EXAMPLE_MEMBER_POINTS` (20 fabricated points) — see
 * ../../../packages/money-flow/src/data/example-members.ts.
 */

import { MoneyFlowClient } from "@fxyz/money-flow";

export function App() {
	return <MoneyFlowClient mode="lab" />;
}
