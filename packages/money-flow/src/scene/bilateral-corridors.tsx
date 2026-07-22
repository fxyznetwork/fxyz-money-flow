"use client";

/**
 * BilateralCorridors — single LineSegments draw call for ALL corridors.
 *
 *  - One pre-allocated Float32Array sized for `corridorCount * segments * 2 * 3`.
 *  - Per-vertex color (Float32Array sized for the same vertex count, ×3) where
 *    color brightness encodes corridor weight.
 *  - One quadratic bezier per corridor, evaluated at K subdivisions.
 *
 * Drawcall budget: 1.
 */

import { useMemo } from "react";
import * as THREE from "three";
import type { BilateralMatrix } from "../data/gravity-bilateral";

const SEGMENTS_PER_ARC = 12;

interface BilateralCorridorsProps {
	matrix: BilateralMatrix;
	positions: THREE.Vector3[];
	radius: number;
	color?: string;
	/** Multiplier on the per-vertex weight → opacity. Default 1.0. */
	opacityScale?: number;
}

/**
 * Bezier arc point: lift control point above the chord by chord-length × 0.55.
 * Inlined here so we write directly into the shared Float32Array without
 * intermediate Vector3 allocations per corridor.
 */
function writeArcSegments(
	out: Float32Array,
	colorOut: Float32Array,
	offset: number,
	start: THREE.Vector3,
	end: THREE.Vector3,
	radius: number,
	weight: number,
	colorRGB: [number, number, number],
): number {
	const chord = start.distanceTo(end);
	const lift = radius + chord * 0.55;
	// Control point (mid of chord, normalized to lift radius).
	const midX = (start.x + end.x) * 0.5;
	const midY = (start.y + end.y) * 0.5;
	const midZ = (start.z + end.z) * 0.5;
	const midLen = Math.sqrt(midX * midX + midY * midY + midZ * midZ) || 1;
	const cx = (midX / midLen) * lift;
	const cy = (midY / midLen) * lift;
	const cz = (midZ / midLen) * lift;

	let cursor = offset;
	let prevX = start.x;
	let prevY = start.y;
	let prevZ = start.z;

	for (let i = 1; i <= SEGMENTS_PER_ARC; i++) {
		const t = i / SEGMENTS_PER_ARC;
		const tInv = 1 - t;
		const tInv2 = tInv * tInv;
		const t2 = t * t;
		const m2 = 2 * tInv * t;

		const px = tInv2 * start.x + m2 * cx + t2 * end.x;
		const py = tInv2 * start.y + m2 * cy + t2 * end.y;
		const pz = tInv2 * start.z + m2 * cz + t2 * end.z;

		// Segment: prev → current.
		out[cursor] = prevX;
		out[cursor + 1] = prevY;
		out[cursor + 2] = prevZ;
		colorOut[cursor] = colorRGB[0] * weight;
		colorOut[cursor + 1] = colorRGB[1] * weight;
		colorOut[cursor + 2] = colorRGB[2] * weight;

		out[cursor + 3] = px;
		out[cursor + 4] = py;
		out[cursor + 5] = pz;
		colorOut[cursor + 3] = colorRGB[0] * weight;
		colorOut[cursor + 4] = colorRGB[1] * weight;
		colorOut[cursor + 5] = colorRGB[2] * weight;

		cursor += 6;
		prevX = px;
		prevY = py;
		prevZ = pz;
	}

	return cursor;
}

export function BilateralCorridors({
	matrix,
	positions,
	radius,
	color = "#fbbc7a",
	opacityScale = 1.0,
}: BilateralCorridorsProps) {
	const geometry = useMemo(() => {
		const totalVerts = matrix.corridorCount * SEGMENTS_PER_ARC * 2;
		const positionsBuf = new Float32Array(totalVerts * 3);
		const colorsBuf = new Float32Array(totalVerts * 3);

		const baseColor = new THREE.Color(color);
		const colorRGB: [number, number, number] = [
			baseColor.r,
			baseColor.g,
			baseColor.b,
		];

		let cursor = 0;
		for (let k = 0; k < matrix.corridorCount; k++) {
			const i = matrix.indexPairs[k * 2];
			const j = matrix.indexPairs[k * 2 + 1];
			const w = matrix.weights[k];
			cursor = writeArcSegments(
				positionsBuf,
				colorsBuf,
				cursor,
				positions[i],
				positions[j],
				radius,
				w,
				colorRGB,
			);
		}

		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(positionsBuf, 3));
		geo.setAttribute("color", new THREE.BufferAttribute(colorsBuf, 3));
		return geo;
	}, [matrix, positions, radius, color]);

	return (
		<lineSegments geometry={geometry} frustumCulled={false}>
			<lineBasicMaterial
				vertexColors
				transparent
				opacity={Math.min(1, 0.55 * opacityScale)}
				depthWrite={false}
				toneMapped={false}
			/>
		</lineSegments>
	);
}

export { SEGMENTS_PER_ARC };
