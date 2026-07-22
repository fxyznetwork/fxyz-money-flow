/**
 * Gravity-model bilateral matrix.
 *
 * Computes a bilateral "flow" weight between every pair of countries using
 * Tinbergen's classical gravity equation: weight = (m_a · m_b) / d²
 * where m is the country's economic mass (GDP tier) and d is great-circle
 * distance.
 *
 * The output is structured for direct upload to a `LineSegments` buffer:
 * - `indexPairs`: Uint32Array of (i, j, i, j, ...) — country indices into
 *   COUNTRY_CENTROIDS for each corridor's endpoints.
 * - `weights`: Float32Array, normalized to [0..1], one per corridor.
 *
 * The matrix is the upper triangle (i < j) — corridors are undirected here.
 * Wire real BIS LBS bilateral data (see `use-bilateral-matrix.ts`) to
 * override this with live corridors.
 */

import {
	COUNTRY_CENTROIDS,
	type CountryCentroid,
	GDP_TIER_MASS,
} from "./country-centroids";

export interface BilateralMatrix {
	/** (i, j) pairs, flat. length = corridorCount * 2. */
	indexPairs: Uint32Array;
	/** Normalized [0..1] weight per corridor. length = corridorCount. */
	weights: Float32Array;
	corridorCount: number;
	/**
	 * Optional per-corridor currency LUT index. length = corridorCount.
	 * When present, particles colored by `colorMode='currency'` look up
	 * `currencyLUT[currencies[k]]`. Absent (e.g. gravity model) → fall back
	 * to instrument-distribution coloring.
	 */
	currencies?: Uint8Array;
	/**
	 * Currency code lookup table — indices match `currencies`. Typical
	 * size: 5-10 (USD, EUR, JPY, GBP, CHF, CNY, ...).
	 */
	currencyLUT?: string[];
}

/**
 * Cheap slice: take the top-N corridors by weight from a full matrix.
 * Avoids re-running the n² gravity compute when only the visible cap changes.
 */
export function sliceTopN(
	full: BilateralMatrix,
	topN: number,
): BilateralMatrix {
	if (topN <= 0 || topN >= full.corridorCount) return full;
	// Build (index, weight) array, sort desc, take topN.
	const ord = new Array(full.corridorCount);
	for (let k = 0; k < full.corridorCount; k++) ord[k] = k;
	ord.sort((a, b) => full.weights[b] - full.weights[a]);
	const keep = ord.slice(0, topN);
	const indexPairs = new Uint32Array(topN * 2);
	const weights = new Float32Array(topN);
	const currencies = full.currencies ? new Uint8Array(topN) : undefined;
	for (let k = 0; k < topN; k++) {
		const src = keep[k];
		indexPairs[k * 2] = full.indexPairs[src * 2];
		indexPairs[k * 2 + 1] = full.indexPairs[src * 2 + 1];
		weights[k] = full.weights[src];
		if (currencies && full.currencies) currencies[k] = full.currencies[src];
	}
	return {
		indexPairs,
		weights,
		corridorCount: topN,
		currencies,
		currencyLUT: full.currencyLUT,
	};
}

export interface GravityOptions {
	/** Filter corridors below this normalized weight. Default: 0 (keep all). */
	minWeight?: number;
	/** Cap to top-N corridors by weight. Default: unlimited. */
	topN?: number;
	/** Centroids to use. Default: COUNTRY_CENTROIDS. Pass a subset to scope the matrix. */
	centroids?: readonly CountryCentroid[];
}

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle (haversine) distance in km between two lat/lon points.
 */
function haversineKm(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const toRad = Math.PI / 180;
	const dLat = (lat2 - lat1) * toRad;
	const dLon = (lon2 - lon1) * toRad;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return EARTH_RADIUS_KM * c;
}

/**
 * Build the bilateral gravity matrix.
 *
 * Distance epsilon: 100km — keeps city-pair pairs (e.g. Singapore–KL) finite
 * without dominating. Cube-distance falloff would be too sharp; squared keeps
 * long-haul corridors visible (London↔Tokyo, NY↔Sydney).
 */
export function buildGravityBilateral(
	options: GravityOptions = {},
): BilateralMatrix {
	const centroids = options.centroids ?? COUNTRY_CENTROIDS;
	const n = centroids.length;
	const epsilon = 100; // km

	const rawPairs: number[] = [];
	const rawWeights: number[] = [];
	let maxWeight = 0;

	for (let i = 0; i < n; i++) {
		const a = centroids[i];
		const massA = GDP_TIER_MASS[a.gdpTier] ?? 1;
		for (let j = i + 1; j < n; j++) {
			const b = centroids[j];
			const massB = GDP_TIER_MASS[b.gdpTier] ?? 1;
			const d = haversineKm(a.lat, a.lon, b.lat, b.lon);
			const weight = (massA * massB) / (d + epsilon) ** 2;
			rawPairs.push(i, j);
			rawWeights.push(weight);
			if (weight > maxWeight) maxWeight = weight;
		}
	}

	// Normalize to [0..1].
	const normalized = rawWeights.map((w) => w / maxWeight);

	// Apply filtering. Build a mask of corridor indices to keep.
	const minWeight = options.minWeight ?? 0;
	const filteredIndices: number[] = [];
	for (let k = 0; k < normalized.length; k++) {
		if (normalized[k] >= minWeight) filteredIndices.push(k);
	}

	// topN: sort filtered indices by weight desc, take first N.
	let keptIndices = filteredIndices;
	if (options.topN && options.topN < filteredIndices.length) {
		keptIndices = Array.from(filteredIndices).toSorted(
			(p, q) => normalized[q] - normalized[p],
		);
		keptIndices = keptIndices.slice(0, options.topN);
	}

	const corridorCount = keptIndices.length;
	const indexPairs = new Uint32Array(corridorCount * 2);
	const weights = new Float32Array(corridorCount);

	for (let k = 0; k < corridorCount; k++) {
		const src = keptIndices[k];
		indexPairs[k * 2] = rawPairs[src * 2];
		indexPairs[k * 2 + 1] = rawPairs[src * 2 + 1];
		weights[k] = normalized[src];
	}

	return { indexPairs, weights, corridorCount };
}
