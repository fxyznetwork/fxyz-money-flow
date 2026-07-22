"use client";

/**
 * HUD overlay — drawcalls, FPS, instance counts, layer toggles, particle
 * controls. Pure presentational over a stats poll + parent-owned state.
 *
 * Design constraints:
 *  - JBM mono everywhere (per design-system v1.0).
 *  - Sharp corners (radius 0).
 *  - Dark-first, BG #0a0a14.
 *  - No SaaS-style borrowed stats; the numbers shown are the actual scene
 *    drawcall + instance counts.
 */

import {
	LAYER_GROUP_CITATION,
	LAYER_GROUP_LABEL,
	LAYERS,
	type LayerId,
} from "../data/layer-config";
import { useFlowStatsPoll } from "../scene/flow-stats";

export interface HudControls {
	particleCount: number;
	speed: number;
	corridorOpacity: number;
	activeLayers: Set<LayerId>;
	/** Cap on visible corridors, sorted by weight desc. 0 = unlimited. */
	topN: number;
	/** 0 = pure gravity, 1 = pure BIS Triennial 2025 currency-pair blend. */
	triennialBlend: number;
	/**
	 * Quarter end ISO date (`YYYY-MM-DD`) for BIS LBS data, or `null` for
	 * "latest available". Only meaningful when `useRealData` is true.
	 */
	quarter: string | null;
	/** When true, fetch /api/fx/bilateral. When false, render gravity blend only. */
	useRealData: boolean;
	/** Member-point cloud overlay (Harvard-style classification, above the globe). */
	showMembers: boolean;
	/** Skip particle integration each frame. Bloomberg-grade pause. */
	paused: boolean;
	/** Particle coloring mode. Currency mode requires BIS LBS data. */
	colorMode: "instrument" | "currency";
	/**
	 * Country brightness/scale driver:
	 *  - 'gdp'        — pure economic mass, as seeded
	 *  - 'centrality' — eigenvector centrality (Soramäki 2007)
	 *  - 'debtrank'   — Battiston 2012 systemic-importance
	 */
	countryMode: "gdp" | "centrality" | "debtrank";
	/** CFD-style depth probe on country hover. */
	probeOnHover: boolean;
	/**
	 * Sphere ⇄ Equal Earth flat-map morph. 0 = globe, 1 = flat. Šavrič,
	 * Patterson, Jenny 2019. Cairo *How Maps Lie* (2019) on projection bias —
	 * the toggle exists so viewers feel the editorial weight of the choice.
	 */
	projectionMorph: number;
	/** Lat/lon graticule (every 30°), equator emphasized, tropics drawn. */
	showGraticule: boolean;
	/** Natural Earth 110m country outlines (loaded from public asset). */
	showBorders: boolean;
}

interface HudOverlayProps {
	corridorCount: number;
	countryCount: number;
	maxCorridors: number;
	controls: HudControls;
	onChange: (next: HudControls) => void;
	/** Which data plane is currently driving the scene. */
	dataSource: "bis-lbs" | "gravity-blend";
	/** Quarter actually returned by the endpoint (may differ from controls.quarter when "latest"). */
	resolvedQuarter: string | null;
	dataLoading: boolean;
	dataError: string | null;
	memberCount: number;
}

const ROW = "flex items-baseline justify-between gap-3";
const NUM = "tabular-nums text-[#fbbc7a]";
const LABEL = "text-[#a0a0b0] text-[10px] uppercase tracking-wider";

/**
 * BIS LBS quarter-history range. BIS publishes LBS quarterly back to 1977-Q4
 * (the genuine source floor; deeper aggregates exist but pre-1977 the dataset
 * shape changes). We surface the full historical depth — viewers can scrub
 * all the way back to the inception of the LBS series. Sparser early data is
 * data, not noise.
 */
const QUARTER_HISTORY_START = "1977-10-01"; // 1977-Q4 = first quarter of BIS LBS publication.

/**
 * Generate a list of quarter ends from 2000-Q1 → today, descending (newest first).
 */
function makeQuarterList(): string[] {
	const out: string[] = [];
	const now = new Date();
	let year = now.getUTCFullYear();
	let q = Math.floor(now.getUTCMonth() / 3) + 1; // 1..4
	const startYear = parseInt(QUARTER_HISTORY_START.slice(0, 4), 10);
	while (year > startYear || (year === startYear && q >= 1)) {
		const month = q * 3;
		const day = month === 3 || month === 12 ? 31 : 30;
		out.push(
			`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
		);
		q -= 1;
		if (q < 1) {
			q = 4;
			year -= 1;
		}
	}
	return out;
}

const QUARTER_LIST = makeQuarterList();

function formatQuarterLabel(iso: string | null): string {
	if (!iso) return "latest";
	const m = iso.match(/^(\d{4})-(\d{2})-/);
	if (!m) return iso;
	const year = m[1];
	const month = parseInt(m[2], 10);
	const q = month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";
	return `${year} ${q}`;
}

function useHudOverlayRender({
	corridorCount,
	countryCount,
	maxCorridors,
	controls,
	onChange,
	dataSource,
	resolvedQuarter,
	dataLoading,
	dataError,
	memberCount,
}: HudOverlayProps) {
	const stats = useFlowStatsPoll();

	const particleStorageBytes = controls.particleCount * 8;
	const float32EquivalentBytes = controls.particleCount * 28; // 7 floats: pos×3, type, speed, corridor, t

	return (
		<div
			className="pointer-events-none absolute inset-0 select-none font-mono text-[12px] text-[#e0e0e8]"
			style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
		>
			{/* Top-left: title + data tag */}
			<div className="pointer-events-auto absolute top-4 left-4 max-w-[420px] space-y-1">
				<div className="text-[14px] uppercase tracking-[0.18em]">
					<span className="text-[#fbbc7a]">money-flow</span>
				</div>
				<div className={LABEL}>
					{dataSource === "bis-lbs"
						? `BIS LBS bilateral · ${formatQuarterLabel(resolvedQuarter)} · ${corridorCount.toLocaleString()} edges`
						: controls.triennialBlend > 0
							? `gravity × BIS Triennial 2025 blend (${(controls.triennialBlend * 100).toFixed(0)}% real)`
							: "structural demo · gravity-model bilateral"}
				</div>
				<div className={`${LABEL} text-[#606070]`}>
					{dataSource === "bis-lbs"
						? "WS_LBS_D_PUB · creditor → debtor × currency × quarter"
						: controls.useRealData
							? dataLoading
								? "fetching /api/fx/bilateral..."
								: dataError
									? `BIS LBS fetch error — ${dataError}`
									: "BIS LBS pending sync · gravity fallback active"
							: "synthetic mode · /api/fx/bilateral disabled"}
				</div>
			</div>

			{/* Top-right: live stats */}
			<div className="pointer-events-auto absolute top-4 right-4 w-[280px] space-y-1 border border-[#1f1f2e] bg-[#0a0a14]/85 p-3 backdrop-blur-sm">
				<div className={LABEL}>scene</div>
				<div className={ROW}>
					<span>fps</span>
					<span className={NUM}>{stats.fps.toFixed(1)}</span>
				</div>
				<div className={ROW}>
					<span>frame</span>
					<span className={NUM}>{stats.frameMs.toFixed(2)} ms</span>
				</div>
				<div className={ROW}>
					<span>drawcalls</span>
					<span className={NUM}>{stats.drawCalls}</span>
				</div>
				<div className={ROW}>
					<span>triangles</span>
					<span className={NUM}>{stats.triangles.toLocaleString()}</span>
				</div>

				<div className={`${LABEL} pt-3`}>geometry</div>
				<div className={ROW}>
					<span>·projection</span>
					<div className="flex gap-0.5">
						{(
							[
								["globe", 0],
								["flat", 1],
							] as const
						).map(([label, target]) => {
							const active =
								target === 0
									? controls.projectionMorph < 0.5
									: controls.projectionMorph >= 0.5;
							return (
								<button
									key={label}
									type="button"
									onClick={() =>
										onChange({
											...controls,
											projectionMorph: target,
										})
									}
									className={`px-1 py-0 text-[8px] uppercase tracking-wider transition ${
										active
											? "text-[#fbbc7a]"
											: "text-[#606070] hover:text-[#a0a0b0]"
									}`}
									title={
										target === 0
											? "globe (sphere)"
											: "Equal Earth flat map (Šavrič, Patterson, Jenny 2019; Cairo 2019)"
									}
								>
									{label}
								</button>
							);
						})}
					</div>
				</div>
				<div className={ROW}>
					<span>·refs</span>
					<div className="flex gap-0.5">
						<button
							type="button"
							onClick={() =>
								onChange({
									...controls,
									showGraticule: !controls.showGraticule,
								})
							}
							className={`px-1 py-0 text-[8px] uppercase tracking-wider transition ${
								controls.showGraticule
									? "text-[#fbbc7a]"
									: "text-[#606070] hover:text-[#a0a0b0]"
							}`}
							title="meridians + parallels every 30° + tropics (±23.45°)"
						>
							grid
						</button>
						<button
							type="button"
							onClick={() =>
								onChange({ ...controls, showBorders: !controls.showBorders })
							}
							className={`px-1 py-0 text-[8px] uppercase tracking-wider transition ${
								controls.showBorders
									? "text-[#fbbc7a]"
									: "text-[#606070] hover:text-[#a0a0b0]"
							}`}
							title="Natural Earth 110m admin-0 country outlines"
						>
							borders
						</button>
					</div>
				</div>
				<div className={ROW}>
					<span>countries</span>
					<span className={NUM}>{countryCount}</span>
				</div>
				<div className={ROW}>
					<span>·field</span>
					<div className="flex gap-0.5">
						{(["gdp", "centrality", "debtrank"] as const).map((m) => (
							<button
								key={m}
								type="button"
								onClick={() => onChange({ ...controls, countryMode: m })}
								className={`px-1 py-0 text-[8px] uppercase tracking-wider transition ${
									controls.countryMode === m
										? "text-[#fbbc7a]"
										: "text-[#606070] hover:text-[#a0a0b0]"
								}`}
								title={
									m === "gdp"
										? "country mass = GDP only"
										: m === "centrality"
											? "Soramäki 2007 eigenvector centrality"
											: "Battiston 2012 DebtRank — systemic importance"
								}
							>
								{m === "debtrank" ? "rank" : m}
							</button>
						))}
					</div>
				</div>
				<div className={ROW}>
					<span>corridors</span>
					<span className={NUM}>{corridorCount.toLocaleString()}</span>
				</div>
				<div className={ROW}>
					<span>particles</span>
					<span className={NUM}>{controls.particleCount.toLocaleString()}</span>
				</div>
				<div className={ROW}>
					<span>members</span>
					<button
						type="button"
						onClick={() =>
							onChange({ ...controls, showMembers: !controls.showMembers })
						}
						className={`px-1 tabular-nums transition ${
							controls.showMembers
								? "text-[#fbbc7a]"
								: "text-[#606070] hover:text-[#a0a0b0]"
						}`}
						title="toggle member-point cloud overlay"
					>
						{controls.showMembers ? memberCount.toLocaleString() : "off"}
					</button>
				</div>

				<div className={`${LABEL} pt-3`}>memory · packing</div>
				<div className={ROW}>
					<span>BigUint64</span>
					<span className={NUM}>
						{(particleStorageBytes / 1024).toFixed(0)} KB
					</span>
				</div>
				<div className={ROW}>
					<span>vs Float32</span>
					<span className="text-[#808090] tabular-nums">
						{(float32EquivalentBytes / 1024).toFixed(0)} KB
					</span>
				</div>
				<div className={ROW}>
					<span>saved</span>
					<span className={NUM}>
						{(
							((float32EquivalentBytes - particleStorageBytes) /
								float32EquivalentBytes) *
							100
						).toFixed(0)}
						%
					</span>
				</div>
			</div>

			{/* Bottom-left: layer toggles */}
			<div className="pointer-events-auto absolute bottom-4 left-4 w-[300px] space-y-2 border border-[#1f1f2e] bg-[#0a0a14]/85 p-3 backdrop-blur-sm">
				<div className={ROW}>
					<span className={LABEL}>color by</span>
					<div className="flex gap-1">
						<button
							type="button"
							onClick={() => onChange({ ...controls, colorMode: "instrument" })}
							className={`px-2 py-0.5 text-[9px] uppercase tracking-wider transition border border-[#1f1f2e] ${
								controls.colorMode === "instrument"
									? "bg-[#1f1f2e] text-[#fbbc7a]"
									: "bg-transparent text-[#606070] hover:text-[#a0a0b0]"
							}`}
						>
							instrument
						</button>
						<button
							type="button"
							onClick={() => onChange({ ...controls, colorMode: "currency" })}
							className={`px-2 py-0.5 text-[9px] uppercase tracking-wider transition border border-[#1f1f2e] ${
								controls.colorMode === "currency"
									? "bg-[#1f1f2e] text-[#fbbc7a]"
									: "bg-transparent text-[#606070] hover:text-[#a0a0b0]"
							}`}
							title={
								dataSource === "bis-lbs"
									? "BIS LBS L_DENOM — currency of denomination"
									: "currency requires BIS LBS data; falls back to instrument"
							}
						>
							currency
						</button>
					</div>
				</div>
				<div className={LABEL}>{LAYER_GROUP_LABEL}</div>
				<div className="text-[9px] tracking-wider text-[#606070]">
					{LAYER_GROUP_CITATION}
				</div>
				<div className="flex flex-wrap gap-1 pt-1">
					{LAYERS.map((layer) => {
						const isActive = controls.activeLayers.has(layer.id);
						const isAspirational = !layer.active;
						return (
							<button
								type="button"
								key={layer.id}
								onClick={() => {
									const next = new Set(controls.activeLayers);
									if (isActive) {
										next.delete(layer.id);
									} else {
										next.add(layer.id);
									}
									onChange({ ...controls, activeLayers: next });
								}}
								className={`px-2 py-1 text-[10px] uppercase tracking-wider transition ${
									isActive
										? "text-[#0a0a14]"
										: "text-[#a0a0b0] hover:text-white"
								} ${isAspirational ? "border-dashed" : "border-solid"} border`}
								style={{
									backgroundColor: isActive ? layer.color : "transparent",
									borderColor: layer.color,
								}}
								title={
									layer.approxSharePct !== undefined
										? `${layer.label} · ~${layer.approxSharePct}% of $9.6T/day · ${layer.citation ?? ""}`
										: `${layer.label}${isAspirational ? " (aspirational — different data source)" : ""}`
								}
							>
								{layer.label}
								{layer.approxSharePct !== undefined && (
									<span className="ml-1 opacity-60">
										{layer.approxSharePct}%
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>

			{/* Bottom-right: sliders */}
			<div className="pointer-events-auto absolute bottom-4 right-4 w-[280px] space-y-3 border border-[#1f1f2e] bg-[#0a0a14]/85 p-3 backdrop-blur-sm">
				{/* Real-data toggle + pause + quarter scrubber */}
				<div>
					<div className={`${ROW} mb-1`}>
						<span className={LABEL}>data source</span>
						<div className="flex gap-1">
							<button
								type="button"
								onClick={() =>
									onChange({ ...controls, paused: !controls.paused })
								}
								className={`px-2 py-1 text-[10px] uppercase tracking-wider transition border border-[#fbbc7a] ${
									controls.paused
										? "bg-[#fbbc7a] text-[#0a0a14]"
										: "bg-transparent text-[#a0a0b0] hover:text-white"
								}`}
								title={controls.paused ? "resume" : "pause"}
							>
								{controls.paused ? "▶" : "❚❚"}
							</button>
							<button
								type="button"
								onClick={() =>
									onChange({ ...controls, useRealData: !controls.useRealData })
								}
								className={`px-2 py-1 text-[10px] uppercase tracking-wider transition ${
									controls.useRealData
										? "bg-[#fbbc7a] text-[#0a0a14]"
										: "bg-transparent text-[#a0a0b0] hover:text-white"
								} border border-[#fbbc7a]`}
							>
								{controls.useRealData ? "BIS real" : "synthetic"}
							</button>
						</div>
					</div>
					{controls.useRealData && (
						<>
							<div className={`${ROW} mb-1 pt-2`}>
								<span className={LABEL}>quarter</span>
								<span className={NUM}>
									{formatQuarterLabel(controls.quarter ?? resolvedQuarter)}
								</span>
							</div>
							{/* Newest quarter on the right (max), oldest on the left (min). */}
							<input
								aria-label="BIS LBS quarter"
								type="range"
								min={0}
								max={QUARTER_LIST.length - 1}
								step={1}
								value={
									controls.quarter
										? Math.max(
												0,
												QUARTER_LIST.length -
													1 -
													QUARTER_LIST.indexOf(controls.quarter),
											)
										: QUARTER_LIST.length - 1
								}
								onChange={(e) => {
									const v = Number(e.target.value);
									const idx = QUARTER_LIST.length - 1 - v;
									const next = QUARTER_LIST[idx];
									onChange({
										...controls,
										quarter: v === QUARTER_LIST.length - 1 ? null : next,
									});
								}}
								className="w-full accent-[#fbbc7a]"
							/>
							<div className="mt-1 text-[9px] tracking-wider text-[#606070]">
								{QUARTER_LIST.length} quarters · 1977 → today · BIS LBS lag ~3mo
							</div>
						</>
					)}
				</div>

				<div>
					<div className={`${ROW} mb-1`}>
						<span className={LABEL}>particle count</span>
						<span className={NUM}>
							{controls.particleCount.toLocaleString()}
						</span>
					</div>
					<input
						aria-label="Particle count"
						type="range"
						min={5_000}
						max={200_000}
						step={5_000}
						value={controls.particleCount}
						onChange={(e) =>
							onChange({ ...controls, particleCount: Number(e.target.value) })
						}
						className="w-full accent-[#fbbc7a]"
					/>
				</div>

				<div>
					<div className={`${ROW} mb-1`}>
						<span className={LABEL}>corridors shown</span>
						<span className={NUM}>
							{controls.topN === 0 ? "all" : controls.topN.toLocaleString()}
							<span className="ml-1 text-[#606070]">
								/ {maxCorridors.toLocaleString()}
							</span>
						</span>
					</div>
					<input
						aria-label="Corridors shown"
						type="range"
						min={50}
						max={maxCorridors}
						step={50}
						value={controls.topN === 0 ? maxCorridors : controls.topN}
						onChange={(e) => {
							const v = Number(e.target.value);
							onChange({
								...controls,
								topN: v >= maxCorridors ? 0 : v,
							});
						}}
						className="w-full accent-[#fbbc7a]"
					/>
				</div>

				<div>
					<div className={`${ROW} mb-1`}>
						<span className={LABEL}>flow speed</span>
						<span className={NUM}>{controls.speed.toFixed(2)}×</span>
					</div>
					<input
						aria-label="Flow speed"
						type="range"
						min={0}
						max={3}
						step={0.05}
						value={controls.speed}
						onChange={(e) =>
							onChange({ ...controls, speed: Number(e.target.value) })
						}
						className="w-full accent-[#fbbc7a]"
					/>
				</div>

				<div>
					<div className={`${ROW} mb-1`}>
						<span className={LABEL}>corridor opacity</span>
						<span className={NUM}>{controls.corridorOpacity.toFixed(2)}×</span>
					</div>
					<input
						aria-label="Corridor opacity"
						type="range"
						min={0}
						max={2}
						step={0.05}
						value={controls.corridorOpacity}
						onChange={(e) =>
							onChange({ ...controls, corridorOpacity: Number(e.target.value) })
						}
						className="w-full accent-[#fbbc7a]"
					/>
				</div>

				<div>
					<div className={`${ROW} mb-1`}>
						<span className={LABEL}>gravity ⇄ BIS Triennial</span>
						<span className={NUM}>
							{(controls.triennialBlend * 100).toFixed(0)}%
						</span>
					</div>
					<input
						aria-label="Gravity to BIS Triennial blend"
						type="range"
						min={0}
						max={1}
						step={0.05}
						value={controls.triennialBlend}
						onChange={(e) =>
							onChange({
								...controls,
								triennialBlend: Number(e.target.value),
							})
						}
						className="w-full accent-[#fbbc7a]"
					/>
					<div className="text-[9px] tracking-wider text-[#606070] mt-1">
						0% = pure Tinbergen gravity · 100% = pure 2025 Triennial pair shares
					</div>
				</div>
			</div>
		</div>
	);
}

export function HudOverlay(props: HudOverlayProps) {
	return useHudOverlayRender(props);
}
