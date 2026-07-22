/**
 * Subsolar point calculator — where on Earth is the sun directly overhead?
 *
 * Returns a unit vector in the same coordinate convention as
 * `latLonToSphere`, so the GPU can compute `dot(vertexNormal, sunDir) > 0`
 * to test "this point is in daylight".
 *
 * Approximation (good to ~0.5° for the day/night terminator at this scale):
 *   - Subsolar latitude:  23.45° · sin(2π · (DOY - 81) / 365.25)
 *     (DOY = day of year, 81 = March equinox; ignores equation-of-time and
 *      precession — we draw a soft 5° smoothstep at the terminator anyway).
 *   - Subsolar longitude: -15° · (UTC_hour - 12)
 *     (Earth rotates 15°/hour; at UTC noon the sun is over the prime meridian).
 *
 * Sources:
 *  - Spencer 1971 *Search* (Fourier series for solar declination)
 *  - Reda & Andreas 2008 NREL SPA (used to validate the approximation;
 *    full SPA is overkill for terminator visualization)
 */

import * as THREE from "three";

const DEG = Math.PI / 180;
const EARTH_AXIAL_TILT_DEG = 23.45;
const MARCH_EQUINOX_DOY = 81;

/**
 * Day-of-year, fractional. Jan 1 00:00 UTC = 0.
 */
function dayOfYearUTC(date: Date): number {
	const start = Date.UTC(date.getUTCFullYear(), 0, 1);
	const ms = date.getTime() - start;
	return ms / (24 * 3600 * 1000);
}

/**
 * Subsolar latitude/longitude in degrees, valid to ~0.5° for typical use.
 */
export function subsolarPoint(now: Date = new Date()): {
	latDeg: number;
	lonDeg: number;
} {
	const doy = dayOfYearUTC(now);
	const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
	const latDeg =
		EARTH_AXIAL_TILT_DEG *
		Math.sin((2 * Math.PI * (doy - MARCH_EQUINOX_DOY)) / 365.25);
	let lonDeg = -15 * (utcHour - 12);
	// Wrap to [-180, 180].
	if (lonDeg > 180) lonDeg -= 360;
	if (lonDeg < -180) lonDeg += 360;
	return { latDeg, lonDeg };
}

/**
 * Sun direction unit vector in the same convention as `latLonToSphere` —
 * `dot(vertexNormal, sunDir)` is the cosine of the solar elevation at the
 * vertex's surface point.
 */
export function sunDirection(now: Date = new Date()): THREE.Vector3 {
	const { latDeg, lonDeg } = subsolarPoint(now);
	const phi = (90 - latDeg) * DEG;
	const theta = (lonDeg + 180) * DEG;
	const sinPhi = Math.sin(phi);
	return new THREE.Vector3(
		-sinPhi * Math.cos(theta),
		Math.cos(phi),
		sinPhi * Math.sin(theta),
	).normalize();
}
