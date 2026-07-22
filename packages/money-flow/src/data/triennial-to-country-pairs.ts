/**
 * Map BIS Triennial currency-pair turnover onto country-pair edges.
 *
 * The challenge: BIS reports one-sided pair turnover (EUR/USD = X). EUR is
 * multilateral — represents 20 eurozone countries. We allocate the pair's
 * volume across the cartesian product of (base-country-set × quote-country-set)
 * weighted by GDP tier mass.
 *
 * Output is a sparse Map keyed by `${i}_${j}` (sorted indices into
 * COUNTRY_CENTROIDS) → cumulative weight.
 *
 * This allocation is approximate but defensible: BIS itself does not publish
 * country-pair turnover (only currency-pair). The eurozone-blob ambiguity is
 * noted in BIS methodology docs; we resolve it by GDP-weighted allocation.
 */

import { TRIENNIAL_PAIRS } from "./bis-triennial-2025";
import { COUNTRY_CENTROIDS, GDP_TIER_MASS } from "./country-centroids";
import type { BilateralMatrix } from "./gravity-bilateral";

/**
 * Map ISO 4217 currency → set of country indices (into COUNTRY_CENTROIDS) that
 * issue/use that currency.
 *
 * Eurozone members in our 86-country list (12 of 20): DE FR IT ES NL BE AT IE
 * PT GR FI LU. Missing: SK SI EE LV LT CY MT HR. The 12 we have cover ~93% of
 * eurozone GDP — acceptable for this allocation.
 */
const CURRENCY_TO_ISO2: Record<string, string[]> = {
	USD: ["US"],
	EUR: ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "GR", "FI", "LU"],
	JPY: ["JP"],
	GBP: ["GB"],
	CNY: ["CN"],
	AUD: ["AU"],
	CAD: ["CA"],
	CHF: ["CH"], // also LI, but not in our list
	INR: ["IN"],
	MXN: ["MX"],
	KRW: ["KR"],
	SGD: ["SG"],
	HKD: ["HK"],
	BRL: ["BR"],
	TWD: ["TW"],
	ZAR: ["ZA"],
	TRY: ["TR"],
	PLN: ["PL"],
	NZD: ["NZ"],
	SEK: ["SE"],
	NOK: ["NO"],
	DKK: ["DK"],
	RUB: ["RU"],
	THB: ["TH"],
	MYR: ["MY"],
	IDR: ["ID"],
	PHP: ["PH"],
	VND: ["VN"],
	AED: ["AE"],
	SAR: ["SA"],
	ILS: ["IL"],
	EGP: ["EG"],
	NGN: ["NG"],
	ARS: ["AR"],
	CLP: ["CL"],
	COP: ["CO"],
	PEN: ["PE"],
};

const ISO2_TO_INDEX: Map<string, number> = new Map(
	COUNTRY_CENTROIDS.map((c, i) => [c.iso2, i]),
);

function indicesForCurrency(curr: string): number[] {
	const isos = CURRENCY_TO_ISO2[curr];
	if (!isos) return [];
	const out: number[] = [];
	for (const iso of isos) {
		const idx = ISO2_TO_INDEX.get(iso);
		if (idx !== undefined) out.push(idx);
	}
	return out;
}

/**
 * Build the country-pair weight map from BIS Triennial 2025 currency-pair
 * shares. Returns a sparse map { "i_j" → cumulative_share }, indices sorted
 * (i < j) so each pair appears once.
 */
export function buildTriennialCountryPairWeights(): Map<string, number> {
	const out = new Map<string, number>();

	for (const pair of TRIENNIAL_PAIRS) {
		const baseCountries = indicesForCurrency(pair.base);
		const quoteCountries = indicesForCurrency(pair.quote);
		if (baseCountries.length === 0 || quoteCountries.length === 0) continue;

		// Compute total mass product across the cartesian product so the
		// pair's share gets distributed proportionally to economic mass.
		let totalMass = 0;
		for (const bi of baseCountries) {
			const baseMass = GDP_TIER_MASS[COUNTRY_CENTROIDS[bi].gdpTier] ?? 1;
			for (const qi of quoteCountries) {
				if (bi === qi) continue;
				const quoteMass = GDP_TIER_MASS[COUNTRY_CENTROIDS[qi].gdpTier] ?? 1;
				totalMass += baseMass * quoteMass;
			}
		}
		if (totalMass === 0) continue;

		for (const bi of baseCountries) {
			const baseMass = GDP_TIER_MASS[COUNTRY_CENTROIDS[bi].gdpTier] ?? 1;
			for (const qi of quoteCountries) {
				if (bi === qi) continue;
				const quoteMass = GDP_TIER_MASS[COUNTRY_CENTROIDS[qi].gdpTier] ?? 1;
				const share = pair.share * ((baseMass * quoteMass) / totalMass);
				const i = Math.min(bi, qi);
				const j = Math.max(bi, qi);
				const key = `${i}_${j}`;
				out.set(key, (out.get(key) ?? 0) + share);
			}
		}
	}

	return out;
}

/**
 * Blend a gravity-derived bilateral matrix with the BIS Triennial weights.
 *
 * - If a corridor has Triennial data, weight = (1-alpha)*gravity + alpha*triennial.
 * - If a corridor has no Triennial data (long tail), weight = gravity * (1-alpha).
 *
 * alpha=0 → pure gravity (same as today). alpha=1 → pure Triennial (long tail
 * vanishes). Recommend alpha=0.7 for visible "real shape with synthetic fill".
 */
export function blendTriennial(
	gravity: BilateralMatrix,
	triennialWeights: Map<string, number>,
	alpha: number,
): BilateralMatrix {
	const indexPairs = new Uint32Array(gravity.indexPairs);
	const weights = new Float32Array(gravity.corridorCount);

	let maxBlended = 0;
	const triennialValues: number[] = [];

	for (let k = 0; k < gravity.corridorCount; k++) {
		const i = gravity.indexPairs[k * 2];
		const j = gravity.indexPairs[k * 2 + 1];
		const triennialShare = triennialWeights.get(`${i}_${j}`) ?? 0;
		triennialValues.push(triennialShare);
	}

	// Normalize Triennial shares to [0..1] range matching gravity scale.
	const maxTriennial =
		triennialValues.reduce((m, v) => (v > m ? v : m), 0) || 1;

	for (let k = 0; k < gravity.corridorCount; k++) {
		const tNorm = triennialValues[k] / maxTriennial;
		const blended = (1 - alpha) * gravity.weights[k] + alpha * tNorm;
		weights[k] = blended;
		if (blended > maxBlended) maxBlended = blended;
	}

	// Re-normalize to [0..1].
	if (maxBlended > 0) {
		for (let k = 0; k < gravity.corridorCount; k++) {
			weights[k] = weights[k] / maxBlended;
		}
	}

	return { indexPairs, weights, corridorCount: gravity.corridorCount };
}
