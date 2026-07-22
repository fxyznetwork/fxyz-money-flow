"use client";

/**
 * Graticule — meridians + parallels at canonical geographic intervals.
 *
 * Real geographic reference geometry (no external data, no fake numbers):
 *   - Meridians every 30° longitude
 *   - Parallels every 30° latitude (60°S, 30°S, 0° equator, 30°N, 60°N)
 *   - Equator emphasized (slightly brighter)
 *   - Tropics of Cancer/Capricorn (±23.45°) drawn dimmer for axial-tilt context
 *
 * All lines morph through `latLonToProjected`, so the graticule unfolds with
 * the substrate when the Cairo Equal Earth toggle fires.
 *
 * Drawcall budget: 1 (single LineSegments).
 *
 * Citations: lat/lon graticule is canonical; Tropic latitudes from Earth's
 * obliquity 23.4393° (IAU 2000A; we use 23.45° to match `sun-position.ts`).
 */

import { useMemo } from "react";
import * as THREE from "three";
import { latLonToProjected } from "./projection";

interface GraticuleProps {
	radius: number;
	morphAmount: number;
	color?: string;
	emphasisColor?: string;
	tropicColor?: string;
	opacity?: number;
}

const MERIDIAN_STEP_DEG = 30;
const PARALLEL_STEP_DEG = 30;
const SAMPLES_PER_LINE = 96;
const TROPIC_DEG = 23.45;

export function Graticule({
	radius,
	morphAmount,
	color = "#1f1f2e",
	emphasisColor = "#2a3142",
	tropicColor = "#1a1a26",
	opacity = 0.55,
}: GraticuleProps) {
	const geometry = useMemo(() => {
		// Pre-allocate. Meridians: 12 lines (0°, 30°, … 330°), each
		// SAMPLES_PER_LINE+1 points → SAMPLES_PER_LINE segments × 2 verts.
		// Parallels: 5 lines (every 30°) + 2 tropics = 7 lines × SAMPLES_PER_LINE
		// segments × 2 verts.
		const meridianCount = Math.ceil(360 / MERIDIAN_STEP_DEG);
		const parallelCount = Math.floor(180 / PARALLEL_STEP_DEG) - 1; // skip ±90°
		const tropicCount = 2;
		const totalLines = meridianCount + parallelCount + tropicCount;
		const totalVerts = totalLines * SAMPLES_PER_LINE * 2;

		const positions = new Float32Array(totalVerts * 3);
		const colors = new Float32Array(totalVerts * 3);

		const baseColor = new THREE.Color(color);
		const emphasis = new THREE.Color(emphasisColor);
		const tropic = new THREE.Color(tropicColor);

		let cursor = 0;

		const writeLine = (points: THREE.Vector3[], c: THREE.Color): void => {
			for (let i = 0; i < points.length - 1; i++) {
				const a = points[i];
				const b = points[i + 1];
				positions[cursor] = a.x;
				positions[cursor + 1] = a.y;
				positions[cursor + 2] = a.z;
				colors[cursor] = c.r;
				colors[cursor + 1] = c.g;
				colors[cursor + 2] = c.b;
				positions[cursor + 3] = b.x;
				positions[cursor + 4] = b.y;
				positions[cursor + 5] = b.z;
				colors[cursor + 3] = c.r;
				colors[cursor + 4] = c.g;
				colors[cursor + 5] = c.b;
				cursor += 6;
			}
		};

		// Meridians — sample lat from -90° to +90° at fixed lon.
		for (let mi = 0; mi < meridianCount; mi++) {
			const lon = -180 + mi * MERIDIAN_STEP_DEG;
			const isPrimeOrAntimeridian = lon === 0 || Math.abs(lon) === 180;
			const c = isPrimeOrAntimeridian ? emphasis : baseColor;
			const points: THREE.Vector3[] = [];
			for (let s = 0; s <= SAMPLES_PER_LINE; s++) {
				const lat = -90 + (180 * s) / SAMPLES_PER_LINE;
				points.push(latLonToProjected(lat, lon, radius * 1.002, morphAmount));
			}
			writeLine(points, c);
		}

		// Parallels every PARALLEL_STEP_DEG (excluding ±90° which are points).
		for (let pi = 1; pi < parallelCount + 1; pi++) {
			const lat = -90 + pi * PARALLEL_STEP_DEG;
			if (Math.abs(lat) >= 90) continue;
			const isEquator = lat === 0;
			const c = isEquator ? emphasis : baseColor;
			const points: THREE.Vector3[] = [];
			for (let s = 0; s <= SAMPLES_PER_LINE; s++) {
				const lon = -180 + (360 * s) / SAMPLES_PER_LINE;
				points.push(latLonToProjected(lat, lon, radius * 1.002, morphAmount));
			}
			writeLine(points, c);
		}

		// Tropics of Cancer (+23.45°) and Capricorn (-23.45°) — Earth obliquity.
		for (const lat of [-TROPIC_DEG, TROPIC_DEG]) {
			const points: THREE.Vector3[] = [];
			for (let s = 0; s <= SAMPLES_PER_LINE; s++) {
				const lon = -180 + (360 * s) / SAMPLES_PER_LINE;
				points.push(latLonToProjected(lat, lon, radius * 1.002, morphAmount));
			}
			writeLine(points, tropic);
		}

		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
		return geo;
	}, [radius, morphAmount, color, emphasisColor, tropicColor]);

	return (
		<lineSegments geometry={geometry} frustumCulled={false} renderOrder={-2}>
			<lineBasicMaterial
				vertexColors
				transparent
				opacity={opacity}
				depthWrite={false}
				toneMapped={false}
			/>
		</lineSegments>
	);
}
