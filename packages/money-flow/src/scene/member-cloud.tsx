"use client";

/**
 * MemberCloud — translucent point cloud floating above the globe substrate.
 *
 * Plots `MemberPoint[]` as an InstancedMesh, color-coded by an optional
 * `magnitudeClass` classification bucket (defaults to a Harvard-style
 * O/B/A/F/G/K/M scheme; any string label works — unrecognized values fall
 * back to a neutral color).
 *
 * Position rules (country code is the SOLE geography used):
 *   - When `point.homeCountry` matches a known country centroid, the point
 *     is placed at that centroid + a small deterministic jitter (so
 *     co-located points don't z-fight). The placement morphs with
 *     `morphAmount` so the cloud unfolds with the substrate.
 *   - Otherwise the point falls back to a deterministic Fibonacci-sphere
 *     spot at radius * 1.55 — stable across reloads, no geographic meaning.
 *
 * Drawcall budget: 1 (single InstancedMesh).
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COUNTRY_CENTROIDS } from "../data/country-centroids";
import type { MemberPoint } from "../data/use-members";
import { latLonToProjected } from "./projection";

interface MemberCloudProps {
	members: MemberPoint[];
	radius: number;
	morphAmount?: number;
	visible?: boolean;
}

/**
 * Harvard-style spectral color mapping. O = hottest/bluest, M = coolest/reddest.
 *
 * "PROVISIONAL" / null / unrecognized → a neutral amber-blue so the slot is
 * still visible without faking a classification that isn't there.
 */
const SPECTRAL_COLORS: Record<string, string> = {
	O: "#aec2f8", // blue-white
	B: "#cad7f5",
	A: "#dde4f3", // white
	F: "#f4ecd8",
	G: "#fbbc7a", // sun-yellow / Florin gold
	K: "#e87044", // orange
	M: "#a8392a", // red
	PROVISIONAL: "#5c7ad3",
};

function spectralColor(magnitudeClass: string | null | undefined): string {
	if (!magnitudeClass) return "#5c7ad3";
	const c = magnitudeClass.toUpperCase();
	return SPECTRAL_COLORS[c] ?? "#5c7ad3";
}

/**
 * Fibonacci-sphere distribution. Deterministic per index — same id, same
 * spot across reloads.
 */
function fibonacciSpherePoint(
	idx: number,
	total: number,
	radius: number,
): THREE.Vector3 {
	const phi = Math.acos(1 - (2 * (idx + 0.5)) / total);
	const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
	const x = radius * Math.sin(phi) * Math.cos(theta);
	const y = radius * Math.cos(phi);
	const z = radius * Math.sin(phi) * Math.sin(theta);
	return new THREE.Vector3(x, y, z);
}

const MEMBER_BASE_SIZE = 0.012;
/** Anchor radius for country-anchored members — sits above country dots. */
const ANCHOR_RADIUS_FACTOR = 1.08;
/** Jitter scale applied to country-anchored members so co-located ones
 * separate visually. Deterministic per member id so reloads don't shuffle. */
const JITTER_RADIUS = 0.04;

const COUNTRY_LOOKUP = new Map(
	COUNTRY_CENTROIDS.map((c) => [c.iso2.toUpperCase(), c]),
);

/**
 * Cheap deterministic hash → unit vec3. Same starName → same jitter direction.
 */
function jitterDirection(id: string): { dx: number; dy: number; dz: number } {
	let h = 2166136261;
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	const a = ((h >>> 0) % 360) * (Math.PI / 180);
	const b = (((h >>> 9) >>> 0) % 360) * (Math.PI / 180);
	return {
		dx: Math.sin(a) * Math.cos(b),
		dy: Math.sin(a) * Math.sin(b),
		dz: Math.cos(a),
	};
}

export function MemberCloud({
	members,
	radius,
	morphAmount = 0,
	visible = true,
}: MemberCloudProps) {
	const meshRef = useRef<THREE.InstancedMesh>(null);

	const { matrices, colors } = useMemo(() => {
		const tempMatrix = new THREE.Matrix4();
		const tempColor = new THREE.Color();
		const mats: THREE.Matrix4[] = [];
		const cols = new Float32Array(members.length * 3);

		const cloudRadius = radius * 1.55;
		for (let i = 0; i < members.length; i++) {
			const m = members[i];
			let pos: THREE.Vector3;

			const country = m.homeCountry
				? COUNTRY_LOOKUP.get(m.homeCountry.toUpperCase())
				: null;
			if (country) {
				const anchor = latLonToProjected(
					country.lat,
					country.lon,
					radius * ANCHOR_RADIUS_FACTOR,
					morphAmount,
				);
				const jitter = jitterDirection(m.id);
				pos = new THREE.Vector3(
					anchor.x + jitter.dx * JITTER_RADIUS,
					anchor.y + jitter.dy * JITTER_RADIUS,
					anchor.z + jitter.dz * JITTER_RADIUS,
				);
			} else {
				pos = fibonacciSpherePoint(i, members.length, cloudRadius);
			}

			tempMatrix.makeTranslation(pos.x, pos.y, pos.z);
			tempMatrix.scale(
				new THREE.Vector3(MEMBER_BASE_SIZE, MEMBER_BASE_SIZE, MEMBER_BASE_SIZE),
			);
			mats.push(tempMatrix.clone());

			tempColor.set(spectralColor(m.magnitudeClass));
			cols[i * 3] = tempColor.r;
			cols[i * 3 + 1] = tempColor.g;
			cols[i * 3 + 2] = tempColor.b;
		}
		return { matrices: mats, colors: cols };
	}, [members, radius, morphAmount]);

	useEffect(() => {
		const mesh = meshRef.current;
		if (!mesh) return;
		for (let i = 0; i < members.length; i++) {
			mesh.setMatrixAt(i, matrices[i]);
		}
		mesh.instanceMatrix.needsUpdate = true;
		mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
		mesh.instanceColor.needsUpdate = true;
	}, [matrices, colors, members.length]);

	if (!visible || members.length === 0) return null;

	return (
		<instancedMesh
			ref={meshRef}
			args={[undefined, undefined, members.length]}
			frustumCulled={false}
		>
			<sphereGeometry args={[1, 8, 8]} />
			<meshBasicMaterial transparent opacity={0.9} toneMapped={false} />
		</instancedMesh>
	);
}
