/**
 * Money-flow layer toggles — BIS Triennial instrument breakdown.
 *
 * These are the BIS Triennial Survey's instrument categories, not a general
 * taxonomy — the analyst axes here are specific to this dataset.
 *
 * Source: BIS Triennial Survey 2025 — global daily turnover $9.6T split
 * across 6 instrument types. https://www.bis.org/statistics/rpfx25.htm
 *
 * Plus 1 settlement layer (CPMI Red Book payment flows) — aspirational,
 * different data source than the six above, so it ships inactive by default.
 */

export interface LayerDescriptor {
	id: string;
	label: string;
	color: string;
	/** Active = ships in v1 with real BIS Triennial data. Aspirational = different data source / future stage. */
	active: boolean;
	/** Approximate share of $9.6T daily global FX turnover (BIS Triennial 2025). */
	approxSharePct?: number;
	citation?: string;
}

export const LAYERS: readonly LayerDescriptor[] = [
	{
		id: "spot",
		label: "Spot",
		color: "#fbbc7a",
		active: true,
		approxSharePct: 28,
		citation: "BIS Triennial 2025",
	},
	{
		id: "outright_forwards",
		label: "Outright Fwd",
		color: "#f59e0b",
		active: true,
		approxSharePct: 15,
		citation: "BIS Triennial 2025",
	},
	{
		id: "fx_swaps",
		label: "FX Swaps",
		color: "#60a5fa",
		active: true,
		approxSharePct: 49,
		citation: "BIS Triennial 2025 — largest single instrument",
	},
	{
		id: "currency_swaps",
		label: "Curr Swaps",
		color: "#a78bfa",
		active: true,
		approxSharePct: 1,
		citation: "BIS Triennial 2025",
	},
	{
		id: "fx_options",
		label: "FX Options",
		color: "#f87171",
		active: true,
		approxSharePct: 5,
		citation: "BIS Triennial 2025 — more than doubled vs 2022",
	},
	{
		id: "ndfs",
		label: "NDFs",
		color: "#34d399",
		active: true,
		approxSharePct: 2,
		citation: "BIS Triennial 2025",
	},
	{
		id: "settlement",
		label: "Settlement",
		color: "#22d3ee",
		active: false,
		citation: "BIS CPMI Red Book — separate data source",
	},
];

export const LAYER_IDS = LAYERS.map((l) => l.id);
export type LayerId = (typeof LAYERS)[number]["id"];

/** Used by HUD label. */
export const LAYER_GROUP_LABEL = "BIS instruments";
export const LAYER_GROUP_CITATION =
	"BIS Triennial 2025 · 6 instrument types · $9.6T/day";
