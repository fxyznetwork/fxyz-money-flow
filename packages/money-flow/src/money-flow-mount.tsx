"use client";

/**
 * Thin client wrapper that does the `ssr: false` dynamic import. Required
 * because Next.js 16 disallows `ssr: false` on `next/dynamic` calls inside
 * Server Components.
 *
 * `mode` matches the underlying MoneyFlowClient — see its docs for details.
 */

import nextDynamic from "next/dynamic";
import type { MoneyFlowClientProps } from "./money-flow-client";

const MoneyFlowClient = nextDynamic(
	() => import("./money-flow-client").then((m) => m.MoneyFlowClient),
	{ ssr: false, loading: () => null },
);

export function MoneyFlowMount(props: MoneyFlowClientProps = {}) {
	return <MoneyFlowClient {...props} />;
}
