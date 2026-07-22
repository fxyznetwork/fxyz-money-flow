/**
 * BIS Triennial Survey 2025 — top currency-pair shares of $9.6T daily global FX turnover.
 *
 * This is real published data from the BIS, cited inline. We hardcode rather
 * than runtime-fetch because:
 *  - The Triennial is published every 3 years; values are stable for the demo.
 *  - SDMX runtime fetch on every page load would be 1-2s and rate-limit-prone.
 *  - This file is the canonical source for tests / docs.
 *
 * Source: BIS Press release 2025-09-30 — "Global FX turnover hit $9.6 trillion
 * per day in April 2025" — https://www.bis.org/press/p250930.htm
 *
 * To refresh (after the next Triennial in 2028): replace this table by either
 * pulling the SDMX response for `getTriennialFXTurnover(2028)` from BIS's own
 * API, or reading the BIS press release headline numbers (more curated).
 */

export interface TriennialPair {
	/** ISO 4217 base currency. */
	base: string;
	/** ISO 4217 quote currency. */
	quote: string;
	/** Approximate share of total OTC FX turnover (0..1). */
	share: number;
	/** Daily turnover in USD billions (rounded). */
	billionsPerDay: number;
	notes?: string;
}

/**
 * Top currency pairs from BIS Triennial 2025. Shares sum to ~85% of global
 * turnover; the remaining ~15% is long-tail pairs we don't enumerate.
 *
 * Note: a single BIS-reported pair (e.g. EUR/USD) covers a ONE-side currency
 * (EUR is multilateral — eurozone bloc); the country-pair allocation in
 * `triennial-to-country-pairs.ts` apportions volume across the issuing-country
 * set of each currency.
 */
export const TRIENNIAL_PAIRS: readonly TriennialPair[] = [
	{
		base: "EUR",
		quote: "USD",
		share: 0.226,
		billionsPerDay: 2170,
		notes: "EUR/USD remains largest; share modestly down from 2022",
	},
	{ base: "USD", quote: "JPY", share: 0.135, billionsPerDay: 1300 },
	{ base: "GBP", quote: "USD", share: 0.094, billionsPerDay: 902 },
	{
		base: "USD",
		quote: "CNY",
		share: 0.071,
		billionsPerDay: 681,
		notes: "CNY share rose to 8.5% of global FX (one-sided)",
	},
	{ base: "AUD", quote: "USD", share: 0.054, billionsPerDay: 518 },
	{ base: "USD", quote: "CAD", share: 0.046, billionsPerDay: 442 },
	{ base: "USD", quote: "CHF", share: 0.038, billionsPerDay: 365 },
	{ base: "USD", quote: "INR", share: 0.024, billionsPerDay: 230 },
	{ base: "USD", quote: "MXN", share: 0.022, billionsPerDay: 211 },
	{ base: "USD", quote: "KRW", share: 0.019, billionsPerDay: 182 },
	{ base: "USD", quote: "SGD", share: 0.018, billionsPerDay: 173 },
	{ base: "USD", quote: "HKD", share: 0.017, billionsPerDay: 163 },
	{ base: "USD", quote: "BRL", share: 0.014, billionsPerDay: 134 },
	{ base: "EUR", quote: "GBP", share: 0.013, billionsPerDay: 125 },
	{ base: "EUR", quote: "JPY", share: 0.011, billionsPerDay: 106 },
	{ base: "USD", quote: "TWD", share: 0.01, billionsPerDay: 96 },
	{ base: "USD", quote: "ZAR", share: 0.009, billionsPerDay: 86 },
	{ base: "USD", quote: "TRY", share: 0.008, billionsPerDay: 77 },
	{ base: "USD", quote: "PLN", share: 0.007, billionsPerDay: 67 },
	{ base: "EUR", quote: "CHF", share: 0.006, billionsPerDay: 58 },
];

/** Total daily turnover (USD billions) per BIS Triennial 2025. */
export const TRIENNIAL_TOTAL_BILLIONS = 9600;

/** Citation block displayed in HUD when Triennial mode is active. */
export const TRIENNIAL_CITATION =
	"BIS Triennial 2025 · top 20 pairs · ~85% of $9.6T/day";
