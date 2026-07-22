"use client";

/**
 * Resolve the base URL for the OPTIONAL real-data fetch in
 * `use-bilateral-matrix.ts`. This package makes no network calls unless you
 * turn on `useRealData` (off by default) AND your own backend implements
 * the documented `/api/fx/bilateral` contract.
 *
 * Resolution order:
 *   1. `NEXT_PUBLIC_API_URL` env var, if set — its origin is used.
 *   2. Same-origin (empty string) — works when your API is served from the
 *      same host as the page.
 */
export function getClientApiBase(): string {
	if (typeof window === "undefined") return "";

	const env = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
	if (env) {
		try {
			return new URL(env).origin;
		} catch {
			return env.split("/api/")[0] || env;
		}
	}

	return "";
}
