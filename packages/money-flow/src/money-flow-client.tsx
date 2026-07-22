"use client";

/**
 * MoneyFlowClient — Canvas wrapper for the money-flow visualization.
 *
 * Composes WorldGlobe + BilateralCorridors + TransactionParticles + HUD.
 * The bilateral matrix and country positions are memoized at the top level
 * so changes to HUD controls (particle count, speed, layer toggles) don't
 * re-trigger heavy recomputation.
 */

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { eigenvectorCentrality } from "./data/centrality";
import { COUNTRY_CENTROIDS } from "./data/country-centroids";
import { debtRankAll } from "./data/debt-rank";
import { buildGravityBilateral, sliceTopN } from "./data/gravity-bilateral";
import { LAYERS, type LayerId } from "./data/layer-config";
import {
	blendTriennial,
	buildTriennialCountryPairWeights,
} from "./data/triennial-to-country-pairs";
import { useBilateralMatrix } from "./data/use-bilateral-matrix";
import type { MemberPoint } from "./data/use-members";
import { useMemberPoints } from "./data/use-members";
import { type HudControls, HudOverlay } from "./hud/hud-overlay";
import { useReducedMotion } from "./hooks/use-reduced-motion";
import { BilateralCorridors } from "./scene/bilateral-corridors";
import { CountryBorders } from "./scene/country-borders";
import { CountryProbe } from "./scene/country-probe";
import { StatsCollector } from "./scene/flow-stats";
import { Graticule } from "./scene/graticule";
import { MemberCloud } from "./scene/member-cloud";
import {
	DEFAULT_PARTICLE_COUNT,
	DEFAULT_TYPE_COLORS,
	TransactionParticles,
} from "./scene/transaction-particles";
import { WorldGlobe } from "./scene/world-globe";
import { countryPositions, GLOBE_RADIUS } from "./scene/world-globe-utils";

const ALL_LAYER_IDS: LayerId[] = LAYERS.map((l) => l.id);

export const PARTICLE_CEILINGS = {
	high: DEFAULT_PARTICLE_COUNT,
	medium: 50_000,
	low: 10_000,
} as const;

export function getFlowRenderPolicy(
	reducedMotion: boolean,
	userPaused: boolean,
) {
	const staticScene = reducedMotion || userPaused;
	return {
		staticScene,
		frameloop: staticScene ? ("demand" as const) : ("always" as const),
		particleCeiling: reducedMotion
			? PARTICLE_CEILINGS.low
			: PARTICLE_CEILINGS.high,
		autoRotate: !staticScene,
	};
}

const initialControls: HudControls = {
	particleCount: DEFAULT_PARTICLE_COUNT,
	speed: 1.0,
	corridorOpacity: 1.0,
	activeLayers: new Set(LAYERS.flatMap((l) => (l.active ? [l.id] : []))),
	topN: 0, // 0 = unlimited
	triennialBlend: 0.7, // 0=pure gravity, 1=pure BIS Triennial 2025
	quarter: null, // null = "latest available BIS LBS quarter"
	useRealData: false, // off by default — no network calls out of the box; flip on to attempt /api/fx/bilateral against your own backend
	showMembers: true, // member-point cloud overlay
	paused: false,
	colorMode: "instrument",
	countryMode: "centrality",
	probeOnHover: true,
	// Šavrič, Patterson, Jenny 2019 Equal Earth ⇄ sphere lerp. 0 = globe,
	// 1 = flat. Per Cairo (How Maps Lie 2019), projection choice is editorial.
	projectionMorph: 0,
	// Geographic reference layers — both ride the projection morph.
	showGraticule: true,
	showBorders: true,
};

export interface MoneyFlowClientProps {
	/**
	 * "lab" — full HUD, every toggle exposed. Good for a demo/explore page.
	 * "prod" — sealed defaults (real-data attempt on, member cloud anchored,
	 * projection on globe, autorotate). Hides the HUD by default but the
	 * user can still summon it via the "?" key (handled inside HudOverlay).
	 */
	mode?: "lab" | "prod";
	/**
	 * Member-point cloud data. Defaults to a small fabricated example
	 * dataset (`EXAMPLE_MEMBER_POINTS`) when omitted — pass your own
	 * `MemberPoint[]` to render real data.
	 */
	members?: MemberPoint[];
}

const PROD_OVERRIDES: Partial<HudControls> = {
	useRealData: true,
	showMembers: true,
	projectionMorph: 0,
	showGraticule: true,
	showBorders: true,
	probeOnHover: true,
	triennialBlend: 0, // pure real data; gravity-blend only as fallback
	topN: 600, // tighter to prevent visual overload on first load
};

function DemandInvalidation({
	controls,
	matrix,
}: {
	controls: HudControls;
	matrix: ReturnType<typeof sliceTopN>;
}) {
	const invalidate = useThree((state) => state.invalidate);
	useEffect(() => invalidate(), [controls, invalidate, matrix]);
	return null;
}

export function MoneyFlowClient({
	mode = "lab",
	members,
}: MoneyFlowClientProps = {}) {
	const reducedMotion = useReducedMotion();
	const [controls, setControls] = useState<HudControls>(
		mode === "prod"
			? { ...initialControls, ...PROD_OVERRIDES }
			: initialControls,
	);

	// Real data — fires whenever quarter changes; null = latest.
	const real = useBilateralMatrix({
		quarter: controls.quarter,
		measure: "gross",
		topN: 2000,
		disabled: !controls.useRealData,
	});

	const memberRoster = useMemberPoints(members, !controls.showMembers);

	const rawGravity = useMemo(() => buildGravityBilateral(), []);
	const triennialWeights = useMemo(
		() => buildTriennialCountryPairWeights(),
		[],
	);
	const syntheticMatrix = useMemo(() => {
		if (controls.triennialBlend <= 0) return rawGravity;
		return blendTriennial(
			rawGravity,
			triennialWeights,
			controls.triennialBlend,
		);
	}, [rawGravity, triennialWeights, controls.triennialBlend]);
	// Real BIS LBS wins when present; otherwise gravity blend renders.
	const fullMatrix = real.matrix ?? syntheticMatrix;
	const dataSource: "bis-lbs" | "gravity-blend" = real.matrix
		? "bis-lbs"
		: "gravity-blend";
	const matrix = useMemo(
		() => sliceTopN(fullMatrix, controls.topN),
		[fullMatrix, controls.topN],
	);
	const positions = useMemo(
		() => countryPositions(GLOBE_RADIUS, controls.projectionMorph),
		[controls.projectionMorph],
	);

	// Soramäki et al. 2007 — eigenvector centrality computed on the FULL
	// (un-sliced) matrix so visible-corridor cap doesn't distort hub ranking.
	const centrality = useMemo(
		() =>
			eigenvectorCentrality(fullMatrix, COUNTRY_CENTROIDS.length).centrality,
		[fullMatrix],
	);
	// Battiston et al. 2012 — DebtRank, lazy-evaluated (only when
	// countryMode==='debtrank' so users not on that view don't pay the
	// O(N × edges) cost).
	const debtRank = useMemo(() => {
		if (controls.countryMode !== "debtrank") return null;
		return debtRankAll(fullMatrix, COUNTRY_CENTROIDS.length).debtRank;
	}, [fullMatrix, controls.countryMode]);

	const countryField =
		controls.countryMode === "centrality"
			? centrality
			: controls.countryMode === "debtrank" && debtRank
				? debtRank
				: undefined;

	// Per-type color array driven by active-layer toggles. Filtered types
	// render as black (invisible against dark background).
	const typeColors = useMemo(() => {
		return ALL_LAYER_IDS.map((id, idx) => {
			if (!controls.activeLayers.has(id)) return "#000000";
			return DEFAULT_TYPE_COLORS[idx] ?? "#fbbc7a";
		});
	}, [controls.activeLayers]);
	const renderPolicy = getFlowRenderPolicy(reducedMotion, controls.paused);
	const particleCount = Math.min(
		controls.particleCount,
		renderPolicy.particleCeiling,
	);

	return (
		<div className="fixed inset-0 bg-[#0a0a14]">
			<Canvas
				frameloop={renderPolicy.frameloop}
				dpr={[1, 1.5]}
				camera={{ position: [0, 0, 5], fov: 45, far: 50 }}
				gl={{
					antialias: true,
					alpha: false,
					powerPreference: "high-performance",
				}}
			>
				<DemandInvalidation controls={controls} matrix={matrix} />
				<color attach="background" args={["#0a0a14"]} />
				<ambientLight intensity={0.4} />

				<WorldGlobe
					radius={GLOBE_RADIUS}
					centrality={countryField}
					morphAmount={controls.projectionMorph}
				/>

				{controls.showGraticule && (
					<Graticule
						radius={GLOBE_RADIUS}
						morphAmount={controls.projectionMorph}
					/>
				)}

				{controls.showBorders && (
					<CountryBorders
						radius={GLOBE_RADIUS}
						morphAmount={controls.projectionMorph}
					/>
				)}

				<BilateralCorridors
					matrix={matrix}
					positions={positions}
					radius={GLOBE_RADIUS}
					opacityScale={controls.corridorOpacity}
				/>

				{controls.showMembers && memberRoster.members && (
					<MemberCloud
						members={memberRoster.members}
						radius={GLOBE_RADIUS}
						morphAmount={controls.projectionMorph}
					/>
				)}

				<TransactionParticles
					matrix={matrix}
					positions={positions}
					radius={GLOBE_RADIUS}
					count={particleCount}
					speed={controls.speed}
					typeColors={typeColors}
					paused={renderPolicy.staticScene}
					colorMode={controls.colorMode}
				/>

				<CountryProbe
					matrix={matrix}
					positions={positions}
					centrality={centrality}
					debtRank={debtRank ?? undefined}
					enabled={controls.probeOnHover}
				/>

				<OrbitControls
					enableZoom
					enablePan={controls.projectionMorph > 0.5}
					autoRotate={renderPolicy.autoRotate && controls.projectionMorph < 0.5}
					autoRotateSpeed={0.4}
					minDistance={2.5}
					maxDistance={8}
					dampingFactor={0.08}
					enableDamping
				/>

				<StatsCollector />
			</Canvas>

			<HudOverlay
				countryCount={COUNTRY_CENTROIDS.length}
				corridorCount={matrix.corridorCount}
				maxCorridors={fullMatrix.corridorCount}
				controls={controls}
				onChange={setControls}
				dataSource={dataSource}
				resolvedQuarter={real.quarter}
				dataLoading={real.loading}
				dataError={real.error}
				memberCount={memberRoster.members?.length ?? 0}
			/>
		</div>
	);
}
