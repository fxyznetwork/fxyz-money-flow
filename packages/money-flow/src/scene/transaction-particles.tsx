"use client";

/**
 * TransactionParticles — InstancedMesh + BigUint64Array packing.
 *
 * The CodePen NV-center technique deployed where it pays off. Each particle's
 * entire state — corridor id, position-along-arc t, speed, type — is packed
 * into a single 64-bit integer.
 *
 * Storage layout (BigUint64Array, one entry per particle):
 *
 *   ┌── hi (Uint32) ──┐  ┌── lo (Uint32) ──┐
 *   t_q : 16 │ corridor : 16    type : 8 │ speed : 16 │ _flags : 8
 *
 *   t_q       : 0..65535, t = t_q / 65535 (position along bezier arc)
 *   corridor  : 0..65535 (index into matrix.indexPairs)
 *   type      : 0..255 (transaction kind — value/work/etc, drives color)
 *   speed     : 0..65535, multiplier = speed / 32768 (0..2× range)
 *   _flags    : reserved
 *
 * Hot path (per-frame matrix write) uses an aliased Uint32Array view so the
 * decode is plain integer ops — BigInt would be too slow at 100K × 60 fps.
 *
 * Memory: 100K particles × 8 bytes = 800 KB. Equivalent Float32Array of the
 * same fields = ~2 MB. The savings matter at this scale; below ~20K it's
 * theatrical.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BilateralMatrix } from "../data/gravity-bilateral";

const DEFAULT_PARTICLE_COUNT = 100_000;

interface TransactionParticlesProps {
	matrix: BilateralMatrix;
	positions: THREE.Vector3[];
	radius: number;
	count?: number;
	/** Speed multiplier — 1.0 = baseline, 0 pauses, 2 doubles. */
	speed?: number;
	/** Per-type colors. Index is type_id (0..). */
	typeColors?: readonly string[];
	/** When true, skip the integration step entirely (saves CPU vs speed=0). */
	paused?: boolean;
	/**
	 * Coloring mode:
	 *  - 'instrument' — particles colored by BIS Triennial instrument
	 *    distribution (per-particle type_id, set at seed time).
	 *  - 'currency' — particles colored by the currency-of-denomination of
	 *    their corridor. Requires matrix.currencies + matrix.currencyLUT.
	 *    Falls back to instrument when currency data is missing.
	 */
	colorMode?: "instrument" | "currency";
}

/**
 * Currency palette — chosen for visual distinction at small instance scale.
 * USD is the dominant flow (~50% of LBS) so it gets the Florin gold to read
 * as the "background". Other majors are visually distinct.
 *
 * Citation for currency dominance: BIS LBS Q4 historical — USD ~48-52%, EUR
 * ~22-25%, JPY ~5-7%, GBP ~5-6%, CHF ~3%, CNY rising ~2-3%. Other = long tail.
 */
const CURRENCY_COLORS: Record<string, string> = {
	USD: "#fbbc7a", // Florin gold — dominant
	EUR: "#5c7ad3", // blue
	JPY: "#e87044", // orange-red
	GBP: "#aec2f8", // pale blue
	CHF: "#f4ecd8", // off-white
	CNY: "#a8392a", // deep red
	AUD: "#34d399", // green
	CAD: "#a78bfa", // purple
	HKD: "#f59e0b", // amber
	SGD: "#22d3ee", // cyan
	TO1: "#606070", // BIS aggregate "all currencies" — dim grey
};

function currencyColor(code: string): string {
	return CURRENCY_COLORS[code] ?? "#404048"; // long-tail neutral
}

// Default type colors — BIS Triennial 2025 instrument categories. Index
// matches LAYERS in `data/layer-config.ts` (spot / forwards / fx swaps /
// currency swaps / fx options / NDFs / settlement-aspirational).
const DEFAULT_TYPE_COLORS = [
	"#fbbc7a", // spot (28% of $9.6T/day)
	"#f59e0b", // outright forwards (15%)
	"#60a5fa", // FX swaps (49% — largest)
	"#a78bfa", // currency swaps (1%)
	"#f87171", // FX options (5%, more than doubled vs 2022)
	"#34d399", // NDFs (2%)
	"#22d3ee", // settlement (aspirational, CPMI source)
] as const;

/**
 * BIS Triennial 2025 instrument shares of $9.6T/day global FX turnover.
 * Index matches LAYERS in `data/layer-config.ts`. Settlement (idx 6) is
 * aspirational and defaults to 0 — it draws from a different data source
 * (CPMI Red Book payment flows) not bundled here.
 *
 * Source: BIS Press release 2025-09-30, https://www.bis.org/press/p250930.htm
 */
const INSTRUMENT_WEIGHTS = [0.28, 0.15, 0.49, 0.01, 0.05, 0.02, 0.0] as const;

/** Find the first cumulative bucket whose value is greater than or equal to target. */
export function lowerBoundCumulative(
	cumulative: ArrayLike<number>,
	target: number,
): number {
	if (cumulative.length === 0) return -1;

	let low = 0;
	let high = cumulative.length;
	while (low < high) {
		const middle = low + ((high - low) >>> 1);
		if (cumulative[middle] >= target) high = middle;
		else low = middle + 1;
	}

	return low < cumulative.length ? low : cumulative.length - 1;
}

interface ParticleMatrixTarget {
	setMatrixAt(index: number, matrix: THREE.Matrix4): void;
	instanceMatrix: { needsUpdate: boolean };
}

export function writeParticleInstances({
	target,
	count,
	u32View,
	arcs,
	delta,
	speed,
	advance,
	scratchMatrix,
}: {
	target: ParticleMatrixTarget;
	count: number;
	u32View: Uint32Array;
	arcs: Float32Array;
	delta: number;
	speed: number;
	advance: boolean;
	scratchMatrix: THREE.Matrix4;
}) {
	const dt = Math.min(delta, 0.05);
	const baseSpeed = 0.05 * speed;

	for (let p = 0; p < count; p++) {
		const lo = u32View[p * 2];
		const hi = u32View[p * 2 + 1];
		const corridor = hi & 0xffff;
		let t_q = (hi >>> 16) & 0xffff;
		let t = t_q / 0xffff;

		if (advance) {
			const speed_q = (lo >>> 8) & 0xffff;
			t += baseSpeed * (speed_q / 32768) * dt;
			if (t >= 1.0) t -= Math.floor(t);
			t_q = (t * 0xffff) | 0;
			u32View[p * 2 + 1] = (corridor & 0xffff) | ((t_q & 0xffff) << 16);
		}

		const arcOffset = corridor * 9;
		const ax = arcs[arcOffset];
		const ay = arcs[arcOffset + 1];
		const az = arcs[arcOffset + 2];
		const cx = arcs[arcOffset + 3];
		const cy = arcs[arcOffset + 4];
		const cz = arcs[arcOffset + 5];
		const bx = arcs[arcOffset + 6];
		const by = arcs[arcOffset + 7];
		const bz = arcs[arcOffset + 8];

		const tInv = 1 - t;
		const tInv2 = tInv * tInv;
		const t2 = t * t;
		const m2 = 2 * tInv * t;

		scratchMatrix.makeTranslation(
			tInv2 * ax + m2 * cx + t2 * bx,
			tInv2 * ay + m2 * cy + t2 * by,
			tInv2 * az + m2 * cz + t2 * bz,
		);
		target.setMatrixAt(p, scratchMatrix);
	}

	target.instanceMatrix.needsUpdate = true;
}

/**
 * Initialize the BigUint64Array buffer with a randomized particle population.
 * Each particle is assigned a corridor (weighted by corridor weight), a random
 * t, a random speed in [0.4..1.6], and a type drawn from the BIS Triennial
 * instrument-share distribution.
 */
function seedParticles(
	count: number,
	matrix: BilateralMatrix,
	rng: () => number,
): { storage: BigUint64Array; u32View: Uint32Array } {
	const storage = new BigUint64Array(count);
	const u32View = new Uint32Array(storage.buffer);

	// Build cumulative-weight table for weighted corridor sampling.
	const cum = new Float32Array(matrix.corridorCount);
	let acc = 0;
	for (let k = 0; k < matrix.corridorCount; k++) {
		acc += matrix.weights[k];
		cum[k] = acc;
	}
	const total = acc;

	for (let p = 0; p < count; p++) {
		// Weighted-random corridor id.
		const r = rng() * total;
		const corridor = lowerBoundCumulative(cum, r);

		const t_q = (rng() * 0xffff) | 0;
		const speed_q = (16384 + ((rng() * 32768) | 0)) & 0xffff; // 0.5..1.5 range

		// Type drawn from BIS Triennial instrument-share weights.
		const tr = rng();
		let typeAcc = 0;
		let type = 0;
		for (let ti = 0; ti < INSTRUMENT_WEIGHTS.length; ti++) {
			typeAcc += INSTRUMENT_WEIGHTS[ti];
			if (tr <= typeAcc) {
				type = ti;
				break;
			}
		}

		// Pack: lo = type:8 | speed:16 | _flags:8;  hi = corridor:16 | t_q:16
		const lo = (type & 0xff) | ((speed_q & 0xffff) << 8); // _flags=0
		const hi = (corridor & 0xffff) | ((t_q & 0xffff) << 16);

		// Little-endian: u32View[2p] = lo, u32View[2p+1] = hi.
		u32View[p * 2] = lo;
		u32View[p * 2 + 1] = hi;
	}

	return { storage, u32View };
}

export function TransactionParticles({
	matrix,
	positions,
	radius,
	count = DEFAULT_PARTICLE_COUNT,
	speed = 1.0,
	typeColors = DEFAULT_TYPE_COLORS,
	paused = false,
	colorMode = "instrument",
}: TransactionParticlesProps) {
	const meshRef = useRef<THREE.InstancedMesh>(null);
	const invalidate = useThree((state) => state.invalidate);

	// Particle storage — BigUint64Array of state, Uint32Array view for hot path.
	const { storage: _storage, u32View } = useMemo(() => {
		// Deterministic-ish RNG so reloads don't shuffle particles wildly.
		let s = 0x9e3779b9;
		const rng = () => {
			s = (s * 1664525 + 1013904223) | 0;
			return (s >>> 0) / 0x100000000;
		};
		return seedParticles(count, matrix, rng);
	}, [count, matrix]);

	// Pre-compute per-corridor bezier control points so we don't re-derive
	// midpoints every frame.
	const arcs = useMemo(() => {
		const out = new Float32Array(matrix.corridorCount * 9); // 3 points × 3 coords
		for (let k = 0; k < matrix.corridorCount; k++) {
			const i = matrix.indexPairs[k * 2];
			const j = matrix.indexPairs[k * 2 + 1];
			const a = positions[i];
			const b = positions[j];
			const chord = a.distanceTo(b);
			const lift = radius + chord * 0.55;
			const mx = (a.x + b.x) * 0.5;
			const my = (a.y + b.y) * 0.5;
			const mz = (a.z + b.z) * 0.5;
			const ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
			out[k * 9 + 0] = a.x;
			out[k * 9 + 1] = a.y;
			out[k * 9 + 2] = a.z;
			out[k * 9 + 3] = (mx / ml) * lift;
			out[k * 9 + 4] = (my / ml) * lift;
			out[k * 9 + 5] = (mz / ml) * lift;
			out[k * 9 + 6] = b.x;
			out[k * 9 + 7] = b.y;
			out[k * 9 + 8] = b.z;
		}
		return out;
	}, [matrix, positions, radius]);
	const tempMatrix = useMemo(() => new THREE.Matrix4(), []);

	useEffect(() => {
		const mesh = meshRef.current;
		if (!mesh) return;
		writeParticleInstances({
			target: mesh,
			count,
			u32View,
			arcs,
			delta: 0,
			speed,
			advance: false,
			scratchMatrix: tempMatrix,
		});
		invalidate();
	}, [arcs, count, invalidate, speed, tempMatrix, u32View]);

	// Apply per-instance colors. Two modes:
	//  - instrument: type_id (set at seed time from BIS Triennial weights)
	//  - currency:   per-corridor currency from matrix.currencies/LUT.
	//                Falls back to instrument when matrix has no currencies.
	useEffect(() => {
		const mesh = meshRef.current;
		if (!mesh) return;
		const colors = new Float32Array(count * 3);
		const tempColor = new THREE.Color();
		const useCurrency =
			colorMode === "currency" &&
			matrix.currencies !== undefined &&
			matrix.currencyLUT !== undefined &&
			matrix.currencyLUT.length > 0;

		for (let p = 0; p < count; p++) {
			const lo = u32View[p * 2];
			const hi = u32View[p * 2 + 1];
			const corridor = hi & 0xffff;

			if (useCurrency && corridor < matrix.corridorCount) {
				const curIdx = matrix.currencies?.[corridor] ?? 0;
				const code = matrix.currencyLUT?.[curIdx] ?? "?";
				tempColor.set(currencyColor(code));
			} else {
				const type = lo & 0xff;
				tempColor.set(typeColors[type % typeColors.length]);
			}

			colors[p * 3] = tempColor.r;
			colors[p * 3 + 1] = tempColor.g;
			colors[p * 3 + 2] = tempColor.b;
		}
		mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
		mesh.instanceColor.needsUpdate = true;
	}, [count, u32View, typeColors, colorMode, matrix]);

	// Per-frame integration: advance t for each particle, evaluate bezier,
	// write matrix. This is the hot path.
	useFrame((_state, delta) => {
		const mesh = meshRef.current;
		if (!mesh) return;
		if (paused) return; // skip integration entirely — saves 100K iterations/frame
		writeParticleInstances({
			target: mesh,
			count,
			u32View,
			arcs,
			delta,
			speed,
			advance: true,
			scratchMatrix: tempMatrix,
		});
	});

	return (
		<instancedMesh
			ref={meshRef}
			args={[undefined, undefined, count]}
			frustumCulled={false}
		>
			<sphereGeometry args={[0.005, 4, 4]} />
			<meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
		</instancedMesh>
	);
}

export { DEFAULT_PARTICLE_COUNT, DEFAULT_TYPE_COLORS };
