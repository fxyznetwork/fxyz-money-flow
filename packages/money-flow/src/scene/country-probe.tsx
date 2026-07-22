"use client";

/**
 * CountryProbe — Mehrling money-view CFD-style depth probe on hover.
 *
 * On country hover, surfaces:
 *   - Country code + GDP tier
 *   - Network position: centrality + DebtRank ranks
 *   - Inbound flow magnitude (sum of corridors where this country is debtor)
 *   - Outbound flow magnitude (sum where this country is creditor)
 *   - Net direction (positive net debtor = sink; positive net creditor = source)
 *   - Top 3 counterparties by gross flow
 *
 * Reference: Mehrling *The New Lombard Street* (2011) — money flows have a
 * fluid dynamics analogue (velocity = flow magnitude, pressure = price). The
 * probe surfaces the local fluid state using that metaphor.
 *
 * Implementation: raycaster on the country InstancedMesh, drei Html for the
 * floating panel anchored to the country's 3D position.
 */

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { COUNTRY_CENTROIDS, GDP_TIER_MASS } from "../data/country-centroids";
import type { BilateralMatrix } from "../data/gravity-bilateral";

interface CountryProbeProps {
	matrix: BilateralMatrix;
	positions: THREE.Vector3[];
	centrality?: Float32Array;
	debtRank?: Float32Array;
	enabled?: boolean;
}

interface ProbeStats {
	countryIdx: number;
	inbound: number;
	outbound: number;
	net: number; // outbound - inbound
	topCounterparties: { iso: string; flow: number; direction: "in" | "out" }[];
}

const MAX_HOVER_DISTANCE = 0.04; // world units; rough hover radius

/**
 * Compute flow stats for a country index against the current matrix.
 * Cheap — runs once per hover, not per frame.
 */
function computeStats(matrix: BilateralMatrix, countryIdx: number): ProbeStats {
	let inbound = 0;
	let outbound = 0;
	const counterparties: {
		idx: number;
		flow: number;
		direction: "in" | "out";
	}[] = [];

	for (let k = 0; k < matrix.corridorCount; k++) {
		const i = matrix.indexPairs[k * 2]; // creditor (source)
		const j = matrix.indexPairs[k * 2 + 1]; // debtor (sink)
		const w = matrix.weights[k];
		if (i === countryIdx) {
			outbound += w;
			counterparties.push({ idx: j, flow: w, direction: "out" });
		} else if (j === countryIdx) {
			inbound += w;
			counterparties.push({ idx: i, flow: w, direction: "in" });
		}
	}

	counterparties.sort((a, b) => b.flow - a.flow);
	return {
		countryIdx,
		inbound,
		outbound,
		net: outbound - inbound,
		topCounterparties: counterparties.slice(0, 3).map((c) => ({
			iso: COUNTRY_CENTROIDS[c.idx]?.iso2 ?? "??",
			flow: c.flow,
			direction: c.direction,
		})),
	};
}

export function CountryProbe({
	matrix,
	positions,
	centrality,
	debtRank,
	enabled = true,
}: CountryProbeProps) {
	const { camera, raycaster, pointer } = useThree();
	const [hoverIdx, setHoverIdx] = useState<number | null>(null);
	const lastHoverIdx = useRef<number | null>(null);

	// Per-frame raycast against country positions. Cheap — only 86 sphere
	// distance checks. Not using actual InstancedMesh hit-testing because
	// reading instance matrices is more code than computing camera-ray ↔
	// position distance.
	useFrame(() => {
		if (!enabled) {
			if (hoverIdx !== null) setHoverIdx(null);
			return;
		}
		raycaster.setFromCamera(pointer, camera);

		// Find the country whose center is closest to the camera ray AND
		// within MAX_HOVER_DISTANCE of it.
		let bestIdx: number | null = null;
		let bestDist = MAX_HOVER_DISTANCE;
		for (let i = 0; i < positions.length; i++) {
			const p = positions[i];
			// Distance from ray to point: |(p - origin) × direction| / |direction|.
			// raycaster.ray.distanceToPoint does this.
			const d = raycaster.ray.distanceToPoint(p);
			if (d < bestDist) {
				bestDist = d;
				bestIdx = i;
			}
		}

		if (bestIdx !== lastHoverIdx.current) {
			lastHoverIdx.current = bestIdx;
			setHoverIdx(bestIdx);
		}
	});

	const stats = useMemo(
		() => (hoverIdx === null ? null : computeStats(matrix, hoverIdx)),
		[hoverIdx, matrix],
	);

	if (hoverIdx === null || !stats) return null;

	const country = COUNTRY_CENTROIDS[hoverIdx];
	if (!country) return null;
	const pos = positions[hoverIdx];

	const gdpMass = GDP_TIER_MASS[country.gdpTier] ?? 0;
	const cent = centrality?.[hoverIdx] ?? 0;
	const dr = debtRank?.[hoverIdx] ?? 0;

	const netLabel = stats.net > 0 ? "net source" : "net sink";
	const netColor = stats.net > 0 ? "#fbbc7a" : "#5c7ad3";

	return (
		<Html
			position={[pos.x, pos.y, pos.z]}
			distanceFactor={6}
			style={{ pointerEvents: "none" }}
		>
			<div
				className="font-mono text-[10px] text-[#e0e0e8] border border-[#1f1f2e] bg-[#0a0a14]/95 p-2 backdrop-blur-sm whitespace-nowrap"
				style={{
					transform: "translate(12px, -50%)",
					fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
				}}
			>
				<div className="text-[12px] text-[#fbbc7a] tracking-[0.18em]">
					{country.iso2}
				</div>
				<div className="text-[#a0a0b0] text-[9px] uppercase mb-1">
					tier {country.gdpTier} · gdp ${gdpMass.toLocaleString()}B
				</div>
				<div className="grid grid-cols-2 gap-x-3 gap-y-0">
					<span className="text-[#606070]">centrality</span>
					<span className="tabular-nums text-right">{cent.toFixed(2)}</span>
					<span className="text-[#606070]">debt-rank</span>
					<span className="tabular-nums text-right">{dr.toFixed(2)}</span>
					<span className="text-[#606070]">→ outbound</span>
					<span className="tabular-nums text-right text-[#fbbc7a]">
						{stats.outbound.toFixed(2)}
					</span>
					<span className="text-[#606070]">← inbound</span>
					<span className="tabular-nums text-right text-[#5c7ad3]">
						{stats.inbound.toFixed(2)}
					</span>
					<span className="text-[#606070]">Δ net</span>
					<span className="tabular-nums text-right" style={{ color: netColor }}>
						{stats.net > 0 ? "+" : ""}
						{stats.net.toFixed(2)} {netLabel}
					</span>
				</div>
				{stats.topCounterparties.length > 0 && (
					<>
						<div className="text-[#606070] mt-1 mb-0.5">top counterparties</div>
						{stats.topCounterparties.map((cp) => (
							<div
								key={`${cp.iso}-${cp.direction}`}
								className="flex justify-between gap-2"
							>
								<span className="text-[#a0a0b0]">
									{cp.direction === "out" ? "→" : "←"} {cp.iso}
								</span>
								<span className="tabular-nums text-[#a0a0b0]">
									{cp.flow.toFixed(2)}
								</span>
							</div>
						))}
					</>
				)}
			</div>
		</Html>
	);
}
