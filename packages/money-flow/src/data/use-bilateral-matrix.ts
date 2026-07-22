"use client";

/**
 * OPTIONAL real-data hook.
 *
 * Fetches the bilateral matrix for one quarter from `/api/fx/bilateral`. This
 * is disabled by default (see `useRealData` in `money-flow-client.tsx`) — the
 * package renders the bundled gravity + BIS Triennial blend out of the box,
 * with zero backend required. Enable it and implement the endpoint on your
 * own backend if you want to feed it live BIS LBS-shaped data; if the fetch
 * fails or returns nothing, the component falls back to the synthetic matrix
 * automatically.
 *
 * Returns the same `BilateralMatrix` shape that `gravity-bilateral.ts` and
 * `triennial-to-country-pairs.ts` produce — drop-in for `money-flow-client.tsx`.
 *
 * Quarter param: ISO date string `YYYY-MM-DD` for the quarter end (e.g.
 * `'2024-12-31'`). `null` → "latest available". The endpoint resolves "latest"
 * via `MATCH ()-[r:BILATERAL_BANKING_FLOW]->() RETURN max(r.quarterEnd)`.
 *
 * **Caching (A5)** — module-level Map keyed by `${quarter}|${currency}|${measure}|${topN}`.
 * Survives across re-renders and component unmounts. Background prefetch fires
 * for ±N quarters around the current one once a fetch lands, so scrubbing
 * forward/backward stays instantaneous after the first navigation.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { getClientApiBase } from "./api-base";
import { COUNTRY_CENTROIDS } from "./country-centroids";
import type { BilateralMatrix } from "./gravity-bilateral";

interface BilateralEdge {
	creditor: string;
	debtor: string;
	currency: string;
	claims: number;
	liabilities: number;
	value: number;
}

interface BilateralResponse {
	success: boolean;
	quarter: string | null;
	currency: string | null;
	measure: "claims" | "liabilities" | "gross";
	count: number;
	totalValueMillionsUsd: number;
	edges: BilateralEdge[];
	source: string;
	updatedAt: string;
	note?: string;
}

export interface UseBilateralOptions {
	/** Quarter end as `YYYY-MM-DD`, or `null` for "latest available". */
	quarter: string | null;
	/** Default `'gross'` (claims + liabilities). */
	measure?: "claims" | "liabilities" | "gross";
	/** Cap edges by descending value. Default: unlimited (server returns all). */
	topN?: number;
	/** ISO 4217 currency filter; default: all currencies summed. */
	currency?: string;
	/** When true, do not fetch — use the synthetic fallback. */
	disabled?: boolean;
}

export interface UseBilateralResult {
	matrix: BilateralMatrix | null;
	quarter: string | null;
	source: "bis-lbs" | "synthetic-pending";
	loading: boolean;
	error: string | null;
}

const ISO2_TO_INDEX = new Map<string, number>(
	COUNTRY_CENTROIDS.map((c, i) => [c.iso2, i]),
);

// =============================================================================
// Module-level cache — survives across renders and component unmounts. Keyed
// by the request shape, value = { resolvedQuarter, edges } pair so callers can
// distinguish "fetched, returned latest" from "fetched, returned the requested
// quarter".
// =============================================================================

interface CacheEntry {
	resolvedQuarter: string | null;
	edges: BilateralEdge[];
	fetchedAt: number;
}

const matrixCache = new Map<string, CacheEntry>();
const inflightFetches = new Map<string, Promise<CacheEntry>>();

function cacheKey(opts: {
	quarter: string | null;
	measure: "claims" | "liabilities" | "gross";
	topN?: number;
	currency?: string;
}): string {
	return `${opts.quarter ?? "latest"}|${opts.currency ?? "*"}|${opts.measure}|${opts.topN ?? 0}`;
}

function buildUrl(
	apiBase: string,
	opts: {
		quarter: string | null;
		measure: "claims" | "liabilities" | "gross";
		topN?: number;
		currency?: string;
	},
): string {
	const params = new URLSearchParams();
	if (opts.quarter) params.set("quarter", opts.quarter);
	if (opts.currency) params.set("currency", opts.currency);
	params.set("measure", opts.measure);
	if (opts.topN) params.set("topN", String(opts.topN));
	return `${apiBase}/api/fx/bilateral?${params}`;
}

async function fetchAndCache(
	opts: {
		quarter: string | null;
		measure: "claims" | "liabilities" | "gross";
		topN?: number;
		currency?: string;
	},
	signal?: AbortSignal,
): Promise<CacheEntry> {
	const key = cacheKey(opts);
	const cached = matrixCache.get(key);
	if (cached) return cached;
	const inflight = inflightFetches.get(key);
	if (inflight) return inflight;

	const url = buildUrl(getClientApiBase(), opts);
	const promise = fetch(url, { signal })
		.then((r) => {
			if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
			return r.json() as Promise<BilateralResponse>;
		})
		.then((body) => {
			if (!body.success)
				throw new Error("bilateral endpoint returned success=false");
			const entry: CacheEntry = {
				resolvedQuarter: body.quarter,
				edges: body.edges,
				fetchedAt: Date.now(),
			};
			matrixCache.set(key, entry);
			inflightFetches.delete(key);
			return entry;
		})
		.catch((err) => {
			inflightFetches.delete(key);
			throw err;
		});

	inflightFetches.set(key, promise);
	return promise;
}

/**
 * Convert flat edge list → BilateralMatrix indexed against COUNTRY_CENTROIDS.
 *
 * Edges referencing countries not in the centroid table (e.g. small islands
 * the demo doesn't ship coordinates for) are dropped — a future iteration can
 * widen the centroid set rather than gating on it here.
 */
function edgesToMatrix(edges: BilateralEdge[]): BilateralMatrix {
	const pairs: number[] = [];
	const weights: number[] = [];
	const currencyByCorridor: number[] = [];
	const currencyLUT: string[] = [];
	const currencyToIndex = new Map<string, number>();
	let maxValue = 0;

	for (const edge of edges) {
		const i = ISO2_TO_INDEX.get(edge.creditor);
		const j = ISO2_TO_INDEX.get(edge.debtor);
		if (i === undefined || j === undefined) continue;
		if (i === j) continue;
		pairs.push(i, j);
		weights.push(edge.value);
		if (edge.value > maxValue) maxValue = edge.value;

		// Currency LUT — one slot per distinct currency, capped at 255 (Uint8).
		// Real BIS LBS responses have ~5-10 distinct currencies for a given
		// (creditor, debtor) cut, well under the cap. `TO1` (BIS aggregate
		// "all currencies summed") gets its own slot too — colored neutral.
		const cur = edge.currency || "?";
		let curIdx = currencyToIndex.get(cur);
		if (curIdx === undefined) {
			curIdx = currencyLUT.length;
			currencyLUT.push(cur);
			currencyToIndex.set(cur, curIdx);
		}
		currencyByCorridor.push(curIdx);
	}

	const corridorCount = weights.length;
	const indexPairs = new Uint32Array(pairs);
	const weightsArr = new Float32Array(corridorCount);
	const currencies = new Uint8Array(currencyByCorridor);
	const norm = maxValue > 0 ? 1 / maxValue : 0;
	for (let k = 0; k < corridorCount; k++) {
		weightsArr[k] = weights[k] * norm;
	}

	return {
		indexPairs,
		weights: weightsArr,
		corridorCount,
		currencies,
		currencyLUT,
	};
}

/**
 * Cheap synchronous lookup so callers can short-circuit when the cache
 * already has the requested matrix. Used inside the hook to avoid a
 * stale-then-fresh flash when scrubbing through cached quarters.
 */
function cachedEntry(opts: {
	quarter: string | null;
	measure: "claims" | "liabilities" | "gross";
	topN?: number;
	currency?: string;
}): CacheEntry | null {
	return matrixCache.get(cacheKey(opts)) ?? null;
}

/**
 * List of nearby quarter ISO dates around the given anchor. Used by the
 * background prefetcher.
 */
function nearbyQuarters(anchor: string | null, span = 2): string[] {
	if (!anchor) return [];
	const m = anchor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return [];
	const year = parseInt(m[1], 10);
	const month = parseInt(m[2], 10);
	const q = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
	const y = year;
	const out: string[] = [];
	for (let step = -span; step <= span; step++) {
		if (step === 0) continue;
		let qs = q + step;
		let ys = y;
		while (qs > 4) {
			qs -= 4;
			ys += 1;
		}
		while (qs < 1) {
			qs += 4;
			ys -= 1;
		}
		const mm = qs * 3;
		const dd = mm === 3 || mm === 12 ? 31 : 30;
		out.push(
			`${ys}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
		);
	}
	return out;
}

export function useBilateralMatrix(
	options: UseBilateralOptions,
): UseBilateralResult {
	const { quarter, measure = "gross", topN, currency, disabled } = options;

	// Synchronous cache lookup — if the requested matrix is already cached,
	// surface it immediately so the scene never flickers between quarters
	// the user has already visited.
	const requestKey = cacheKey({ quarter, measure, topN, currency });
	const cached = disabled
		? null
		: cachedEntry({ quarter, measure, topN, currency });
	const [state, setState] = useState<{
		key: string;
		edges: BilateralEdge[] | null;
		resolvedQuarter: string | null;
		error: string | null;
	}>({
		key: "",
		edges: null,
		resolvedQuarter: null,
		error: null,
	});
	const requestId = useRef(0);

	const hasCurrentState = state.key === requestKey;
	const edges = disabled
		? null
		: (cached?.edges ?? (hasCurrentState ? state.edges : null));
	const resolvedQuarter = disabled
		? null
		: (cached?.resolvedQuarter ??
			(hasCurrentState ? state.resolvedQuarter : null));
	const loading = !disabled && !cached && !hasCurrentState;
	const error =
		disabled || cached ? null : hasCurrentState ? state.error : null;

	useEffect(() => {
		if (disabled) return;
		const opts = { quarter, measure, topN, currency };
		const cachedNow = cachedEntry(opts);
		if (cachedNow) return;

		const controller = new AbortController();
		const id = ++requestId.current;

		fetchAndCache(opts, controller.signal)
			.then((entry) => {
				if (id !== requestId.current) return;
				setState({
					key: requestKey,
					edges: entry.edges,
					resolvedQuarter: entry.resolvedQuarter,
					error: null,
				});
			})
			.catch((err: unknown) => {
				if (id !== requestId.current) return;
				if (err instanceof DOMException && err.name === "AbortError") return;
				setState({
					key: requestKey,
					edges: null,
					resolvedQuarter: null,
					error: err instanceof Error ? err.message : String(err),
				});
			});

		return () => {
			controller.abort();
		};
	}, [quarter, measure, topN, currency, disabled, requestKey]);

	// Background prefetch — once the current quarter has resolved, kick off
	// fetches for ±2 nearby quarters in the background. They land in the
	// module cache so subsequent scrubber moves are instant.
	useEffect(() => {
		if (disabled || !resolvedQuarter) return;
		const neighbors = nearbyQuarters(resolvedQuarter, 2);
		// Yield to the main work first.
		const handle = setTimeout(() => {
			for (const q of neighbors) {
				const opts = { quarter: q, measure, topN, currency };
				if (cachedEntry(opts)) continue;
				fetchAndCache(opts).catch(() => {
					// Background fetches fail-silent; the user-facing fetch will
					// surface its own error.
				});
			}
		}, 100);
		return () => clearTimeout(handle);
	}, [disabled, resolvedQuarter, measure, topN, currency]);

	const matrix = useMemo(() => {
		if (!edges || edges.length === 0) return null;
		return edgesToMatrix(edges);
	}, [edges]);

	const source: "bis-lbs" | "synthetic-pending" =
		matrix && matrix.corridorCount > 0 ? "bis-lbs" : "synthetic-pending";

	return {
		matrix,
		quarter: resolvedQuarter,
		source,
		loading,
		error,
	};
}
