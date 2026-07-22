import * as THREE from "three";
import { COUNTRY_CENTROIDS } from "../data/country-centroids";
import { latLonToProjected } from "./projection";

export const GLOBE_RADIUS = 1.5;

/**
 * Helper so other scene modules (corridors, particles, probe, member-cloud)
 * can place geometry at projected country positions. Pass the same
 * `morphAmount` you pass to `<WorldGlobe>` so every layer stays aligned.
 */
export function countryPositions(
	radius: number = GLOBE_RADIUS,
	morphAmount: number = 0,
): THREE.Vector3[] {
	return COUNTRY_CENTROIDS.map((c) =>
		latLonToProjected(c.lat, c.lon, radius * 1.005, morphAmount),
	);
}
