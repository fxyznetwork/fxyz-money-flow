/**
 * Equal Earth ⇄ Sphere projection helpers.
 *
 * Equal Earth (Šavrič, Patterson, Jenny 2019, *Cartographic Journal* 56(3))
 * is an equal-area pseudocylindrical projection — surface areas on the map
 * preserve their proportion to surface areas on the globe. We use it as the
 * "flat" pole of a sphere⇄flat morph so trade and banking flows can be read
 * either positionally (flat) or rotationally (globe).
 *
 * Framing: Alberto Cairo (data-vis scholar, *How Maps Lie* 2019, *The Truthful
 * Art* 2016) notes that projection choice is editorial — the toggle exists to
 * let viewers feel that editorial weight directly. "Cairo" here is the
 * author's surname; not the city, not the Cairo 2D graphics library.
 *
 * Both JS helpers and the GLSL chunk MUST stay numerically aligned with the
 * `latLonToVec3` convention used by the rest of this package:
 *
 *   Sphere:  x = -r·sin(phi)·cos(theta), y = r·cos(phi), z = r·sin(phi)·sin(theta)
 *            with phi = (90 - lat°)·π/180, theta = (lon° + 180)·π/180.
 *
 *   Equal Earth (closed-form, lat in radians):
 *     θ = asin(√3/2 · sin(lat))
 *     x_raw = (2√3 · lon · cos(θ)) / (3·(9·A4·θ⁸ + 7·A3·θ⁶ + 3·A2·θ² + A1))
 *     y_raw = A4·θ⁹ + A3·θ⁷ + A2·θ³ + A1·θ
 *     A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796
 *
 * Raw EE output spans roughly x ∈ [-2.71, 2.71], y ∈ [-1.32, 1.32]; we scale
 * by `radius / EE_FIT` to land the plane next to the sphere of the same
 * `radius`. Aspect ratio (~2.05) is preserved — this is what Equal Earth gives
 * up vs. Mercator-style distortions.
 */

import * as THREE from "three";

// Šavrič, Patterson, Jenny 2019 polynomial coefficients.
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const SQRT3 = Math.sqrt(3);
const SQRT3_OVER_2 = SQRT3 / 2;

/**
 * Empirical fit factor: raw Equal Earth max-x ≈ 2.706, so dividing by 1.8
 * lands the plane at x ∈ [-1.5, 1.5] when radius = 1.5 (i.e. matches the
 * sphere's diameter in width — the height comes out to ~0.73·radius).
 */
const EE_FIT = 1.8;

const DEG = Math.PI / 180;

export function latLonToSphere(
	latDeg: number,
	lonDeg: number,
	radius: number,
): THREE.Vector3 {
	const phi = (90 - latDeg) * DEG;
	const theta = (lonDeg + 180) * DEG;
	const sinPhi = Math.sin(phi);
	return new THREE.Vector3(
		-radius * sinPhi * Math.cos(theta),
		radius * Math.cos(phi),
		radius * sinPhi * Math.sin(theta),
	);
}

export function latLonToEqualEarth(
	latDeg: number,
	lonDeg: number,
	radius: number,
): THREE.Vector3 {
	const lat = latDeg * DEG;
	const lon = lonDeg * DEG;
	const theta = Math.asin(SQRT3_OVER_2 * Math.sin(lat));
	const t2 = theta * theta;
	const t6 = t2 * t2 * t2;
	const t8 = t6 * t2;
	const denom = 3 * (9 * A4 * t8 + 7 * A3 * t6 + 3 * A2 * t2 + A1);
	const xRaw = (2 * SQRT3 * lon * Math.cos(theta)) / denom;
	const yRaw = A4 * theta * t8 + A3 * theta * t6 + A2 * t2 * theta + A1 * theta;
	const scale = radius / EE_FIT;
	return new THREE.Vector3(xRaw * scale, yRaw * scale, 0);
}

/**
 * Lerp between sphere position (morph=0) and Equal Earth flat position
 * (morph=1). Used by every scene module that places geometry at a country
 * centroid — the lerp keeps every layer aligned during the transition.
 */
export function latLonToProjected(
	latDeg: number,
	lonDeg: number,
	radius: number,
	morph: number,
): THREE.Vector3 {
	if (morph <= 0.0) return latLonToSphere(latDeg, lonDeg, radius);
	if (morph >= 1.0) return latLonToEqualEarth(latDeg, lonDeg, radius);
	const sph = latLonToSphere(latDeg, lonDeg, radius);
	const flat = latLonToEqualEarth(latDeg, lonDeg, radius);
	return new THREE.Vector3(
		sph.x + (flat.x - sph.x) * morph,
		sph.y + (flat.y - sph.y) * morph,
		sph.z + (flat.z - sph.z) * morph,
	);
}

/**
 * GLSL chunk: same Equal Earth math + sphere⇄flat lerp, callable from a
 * vertex shader given `position` (sphere-local) + uniforms `uMorph`, `uRadius`.
 *
 * The shader recovers (lat, lon) from a unit-sphere vertex by inverting the JS
 * `latLonToSphere` mapping:
 *   lat = asin(unit.y)
 *   lon = atan(-unit.z, unit.x)   ← NOT atan(z, -x); see derivation in projection.ts
 */
export const EQUAL_EARTH_VERTEX_GLSL = /* glsl */ `
const float EE_A1 = 1.340264;
const float EE_A2 = -0.081106;
const float EE_A3 = 0.000893;
const float EE_A4 = 0.003796;
const float EE_SQRT3 = 1.7320508075688772;
const float EE_SQRT3_OVER_2 = 0.8660254037844386;
const float EE_FIT = 1.8;

vec3 latLonToEqualEarth(float lat, float lon, float radius) {
  float theta = asin(EE_SQRT3_OVER_2 * sin(lat));
  float t2 = theta * theta;
  float t6 = t2 * t2 * t2;
  float t8 = t6 * t2;
  float denom = 3.0 * (9.0 * EE_A4 * t8 + 7.0 * EE_A3 * t6 + 3.0 * EE_A2 * t2 + EE_A1);
  float xRaw = (2.0 * EE_SQRT3 * lon * cos(theta)) / denom;
  float yRaw = EE_A4 * theta * t8 + EE_A3 * theta * t6 + EE_A2 * t2 * theta + EE_A1 * theta;
  float scale = radius / EE_FIT;
  return vec3(xRaw * scale, yRaw * scale, 0.0);
}

vec3 morphSphereToEqualEarth(vec3 spherePos, float radius, float morph) {
  if (morph <= 0.0) return spherePos;
  vec3 unit = normalize(spherePos);
  float lat = asin(clamp(unit.y, -1.0, 1.0));
  float lon = atan(-unit.z, unit.x);
  vec3 flatPos = latLonToEqualEarth(lat, lon, radius);
  return mix(spherePos, flatPos, morph);
}
`;
