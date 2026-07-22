"use client";

/**
 * CountryBorders — Natural Earth 110m admin-0 country outlines.
 *
 * Fetches a pre-processed compact JSON from `/borders-110m.json` (an
 * OPTIONAL static asset — generate it yourself from the Natural Earth source
 * below and place it at your app's public root, or leave it out entirely).
 * When the asset is missing, the component renders nothing — the graticule +
 * country dots still provide geographic structure.
 *
 * Format on disk (compact, ~700 KB JSON, ~150 KB gzipped):
 *
 *   {
 *     "version": "natural-earth-110m-1.4.0",
 *     "polygons": [
 *       { "iso": "US", "rings": [ [ [lat, lon], [lat, lon], ... ], ... ] },
 *       ...
 *     ]
 *   }
 *
 * Each ring closes by repeating the first vertex; we draw with LineSegments,
 * so we emit pairs (i, i+1) within each ring. Multiple non-self-intersecting
 * rings per country (mainland + islands).
 *
 * Source: https://www.naturalearthdata.com/downloads/110m-cultural-vectors/
 * License: Public domain (Natural Earth attribution recommended in credits).
 */

import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { latLonToProjected } from "./projection";

interface BorderPolygon {
	iso: string;
	rings: [number, number][][]; // [[lat, lon], ...] per ring
}

interface BordersDoc {
	version: string;
	polygons: BorderPolygon[];
}

interface CountryBordersProps {
	radius: number;
	morphAmount: number;
	color?: string;
	opacity?: number;
}

const BORDERS_URL = "/borders-110m.json";

function parseBordersDoc(raw: string): BordersDoc | null {
	try {
		return JSON.parse(raw) as BordersDoc;
	} catch {
		return null;
	}
}

export function CountryBorders({
	radius,
	morphAmount,
	color = "#3a4a6a",
	opacity = 0.6,
}: CountryBordersProps) {
	const rawBorders = useLoader(THREE.FileLoader, BORDERS_URL) as string;
	const doc = useMemo(() => parseBordersDoc(rawBorders), [rawBorders]);

	const geometry = useMemo(() => {
		if (!doc) return null;
		// Count total segments first to size the buffer once.
		let segmentCount = 0;
		for (const poly of doc.polygons) {
			for (const ring of poly.rings) {
				if (ring.length >= 2) segmentCount += ring.length - 1;
			}
		}
		if (segmentCount === 0) return null;

		const positions = new Float32Array(segmentCount * 2 * 3);
		let cursor = 0;
		for (const poly of doc.polygons) {
			for (const ring of poly.rings) {
				if (ring.length < 2) continue;
				for (let i = 0; i < ring.length - 1; i++) {
					const [latA, lonA] = ring[i];
					const [latB, lonB] = ring[i + 1];
					const a = latLonToProjected(latA, lonA, radius * 1.003, morphAmount);
					const b = latLonToProjected(latB, lonB, radius * 1.003, morphAmount);
					positions[cursor] = a.x;
					positions[cursor + 1] = a.y;
					positions[cursor + 2] = a.z;
					positions[cursor + 3] = b.x;
					positions[cursor + 4] = b.y;
					positions[cursor + 5] = b.z;
					cursor += 6;
				}
			}
		}

		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		return geo;
	}, [doc, radius, morphAmount]);

	if (!geometry) return null;

	return (
		<lineSegments geometry={geometry} frustumCulled={false} renderOrder={-1}>
			<lineBasicMaterial
				color={color}
				transparent
				opacity={opacity}
				depthWrite={false}
				toneMapped={false}
			/>
		</lineSegments>
	);
}
