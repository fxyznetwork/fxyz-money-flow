"use client";

/**
 * Standard `prefers-reduced-motion` hook. No dependencies beyond React —
 * this package has no design-system coupling, so it reads the media query
 * directly instead of pulling in a shared implementation.
 *
 * Returns `false` during SSR / before the media query can be read, then
 * updates on mount and whenever the OS-level preference changes.
 */

import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;

		const mql = window.matchMedia(REDUCED_MOTION_QUERY);
		setReduced(mql.matches);

		const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);

		if (typeof mql.addEventListener === "function") {
			mql.addEventListener("change", onChange);
			return () => mql.removeEventListener("change", onChange);
		}

		// Safari < 14 fallback (deprecated but still present in older engines).
		mql.addListener(onChange);
		return () => mql.removeListener(onChange);
	}, []);

	return reduced;
}
