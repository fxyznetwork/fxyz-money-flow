"use client";

/**
 * WorldGlobe — Earth substrate + atmosphere + 86 country InstancedMesh nodes.
 *
 * - Substrate sphere uses a ShaderMaterial that lerps each vertex toward its
 *   Equal Earth (Šavrič, Patterson, Jenny 2019) flat-map position via the
 *   `uMorph` uniform. morph=0 → globe, morph=1 → flat. Wireframe overlay rides
 *   the same shader.
 * - Day/night terminator is computed in geographic space (not view space), so
 *   it's stable through the morph: `dot(geographicNormal, uSunDir) > 0` =
 *   daylit. Subsolar point from `sun-position.ts` (Spencer 1971 approximation).
 * - Atmosphere — outer Fresnel-rim sphere with sun-side glow. Real grazing-
 *   angle math, no fake data; fades to zero on the flat map (the Equal Earth
 *   plane has no horizon to glow).
 * - Country instances re-bake their per-instance matrix on `morphAmount`
 *   change, sharing the same projection helper as the substrate so the dots
 *   stay glued to their lat/lon during the transition.
 *
 * Drawcall budget for this layer: 4 (substrate, wireframe, atmosphere, country
 * instances).
 *
 * "Cairo" framing: Alberto Cairo, *How Maps Lie* 2019. See `projection.ts`.
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COUNTRY_CENTROIDS, GDP_TIER_MASS } from "../data/country-centroids";
import { EQUAL_EARTH_VERTEX_GLSL, latLonToProjected } from "./projection";
import { sunDirection } from "./sun-position";
import { GLOBE_RADIUS } from "./world-globe-utils";

const COUNTRY_BASE_SIZE = 0.018;
const ATMOSPHERE_RADIUS_MULTIPLIER = 1.045;

interface WorldGlobeProps {
	radius?: number;
	earthColor?: string;
	wireframeColor?: string;
	/** Atmosphere rim color (additive). Default = pale teal-blue. */
	atmosphereColor?: string;
	/**
	 * Optional eigenvector-centrality (Soramäki 2007) or DebtRank (Battiston
	 * 2012) field — one value ∈ [0..1] per country, indexed against
	 * COUNTRY_CENTROIDS. When provided, modulates marker brightness AND scale
	 * alongside GDP.
	 */
	centrality?: Float32Array;
	/**
	 * 0 = full sphere, 1 = full Equal Earth flat map. Intermediate values lerp
	 * the substrate vertex shader and re-bake country instance matrices.
	 */
	morphAmount?: number;
}

export function WorldGlobe({
	radius = GLOBE_RADIUS,
	earthColor = "#0a0a14",
	wireframeColor = "#1f1f2e",
	atmosphereColor = "#5c7ad3",
	centrality,
	morphAmount = 0,
}: WorldGlobeProps) {
	const meshRef = useRef<THREE.InstancedMesh>(null);
	const earthMatRef = useRef<THREE.ShaderMaterial>(null);
	const wireMatRef = useRef<THREE.ShaderMaterial>(null);
	const atmosphereMatRef = useRef<THREE.ShaderMaterial>(null);
	const sunDirRef = useRef<THREE.Vector3 | null>(null);
	if (!sunDirRef.current) {
		sunDirRef.current = sunDirection();
	}

	// Recompute sun position every 5 min — at this rotation rate (15°/hour =
	// 0.25°/min) anything finer is below the soft-terminator smoothstep width.
	useEffect(() => {
		const id = setInterval(
			() => {
				const nextSunDir = sunDirection();
				sunDirRef.current?.copy(nextSunDir);
				earthMatRef.current?.uniforms.uSunDir.value.copy(nextSunDir);
				atmosphereMatRef.current?.uniforms.uSunDir.value.copy(nextSunDir);
			},
			5 * 60 * 1000,
		);
		return () => clearInterval(id);
	}, []);

	// Per-country instance matrices + colors, recomputed when morph changes
	// so the dots stay aligned with the substrate.
	const { matrices, colors } = useMemo(() => {
		const tempMatrix = new THREE.Matrix4();
		const tempColor = new THREE.Color();
		const mats: THREE.Matrix4[] = [];
		const cols = new Float32Array(COUNTRY_CENTROIDS.length * 3);

		const goldRGB = new THREE.Color("#fbbc7a");
		for (let i = 0; i < COUNTRY_CENTROIDS.length; i++) {
			const c = COUNTRY_CENTROIDS[i];
			// Lift the marker fractionally above the substrate so it doesn't
			// z-fight the Earth/wireframe at morph=0 OR at morph=1.
			const pos = latLonToProjected(c.lat, c.lon, radius * 1.005, morphAmount);
			const massScalar = Math.cbrt(GDP_TIER_MASS[c.gdpTier] ?? 1);
			const cent = centrality?.[i] ?? 0;
			const sizeScale =
				COUNTRY_BASE_SIZE * (0.6 + massScalar * 0.5 + cent * 0.6);
			tempMatrix.makeTranslation(pos.x, pos.y, pos.z);
			tempMatrix.scale(new THREE.Vector3(sizeScale, sizeScale, sizeScale));
			mats.push(tempMatrix.clone());

			const baseBrightness =
				0.4 + (massScalar / Math.cbrt(GDP_TIER_MASS[1])) * 0.6;
			const brightness = baseBrightness + cent * (1.4 - baseBrightness);
			tempColor.copy(goldRGB).multiplyScalar(brightness);
			cols[i * 3] = tempColor.r;
			cols[i * 3 + 1] = tempColor.g;
			cols[i * 3 + 2] = tempColor.b;
		}
		return { matrices: mats, colors: cols };
	}, [radius, centrality, morphAmount]);

	useEffect(() => {
		const mesh = meshRef.current;
		if (!mesh) return;
		for (let i = 0; i < COUNTRY_CENTROIDS.length; i++) {
			mesh.setMatrixAt(i, matrices[i]);
		}
		mesh.instanceMatrix.needsUpdate = true;
		mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
	}, [matrices, colors]);

	// Push morph + color uniforms each render. ShaderMaterial uniforms aren't
	// reactive in the JSX prop sense — we hold refs and write in useEffect.
	useEffect(() => {
		if (earthMatRef.current) {
			earthMatRef.current.uniforms.uMorph.value = morphAmount;
			earthMatRef.current.uniforms.uRadius.value = radius;
			earthMatRef.current.uniforms.uColor.value.set(earthColor);
			earthMatRef.current.uniforms.uSunDir.value.copy(sunDirRef.current!);
		}
		if (wireMatRef.current) {
			wireMatRef.current.uniforms.uMorph.value = morphAmount;
			wireMatRef.current.uniforms.uRadius.value = radius * 1.001;
			wireMatRef.current.uniforms.uColor.value.set(wireframeColor);
		}
		if (atmosphereMatRef.current) {
			atmosphereMatRef.current.uniforms.uMorph.value = morphAmount;
			atmosphereMatRef.current.uniforms.uColor.value.set(atmosphereColor);
			atmosphereMatRef.current.uniforms.uSunDir.value.copy(sunDirRef.current!);
		}
	}, [morphAmount, radius, earthColor, wireframeColor, atmosphereColor]);

	const substrateUniformsRef = useRef<Record<string, THREE.IUniform> | null>(
		null,
	);
	if (!substrateUniformsRef.current) {
		substrateUniformsRef.current = {
			uMorph: { value: morphAmount },
			uRadius: { value: radius },
			uColor: { value: new THREE.Color(earthColor) },
			uSunDir: { value: sunDirRef.current!.clone() },
		};
	}
	const substrateUniforms = substrateUniformsRef.current;

	const wireframeUniformsRef = useRef<Record<string, THREE.IUniform> | null>(
		null,
	);
	if (!wireframeUniformsRef.current) {
		wireframeUniformsRef.current = {
			uMorph: { value: morphAmount },
			uRadius: { value: radius * 1.001 },
			uColor: { value: new THREE.Color(wireframeColor) },
		};
	}
	const wireframeUniforms = wireframeUniformsRef.current;

	const atmosphereUniformsRef = useRef<Record<string, THREE.IUniform> | null>(
		null,
	);
	if (!atmosphereUniformsRef.current) {
		atmosphereUniformsRef.current = {
			uMorph: { value: morphAmount },
			uColor: { value: new THREE.Color(atmosphereColor) },
			uSunDir: { value: sunDirRef.current!.clone() },
		};
	}
	const atmosphereUniforms = atmosphereUniformsRef.current;

	// Substrate vertex shader: morph + recover (lat, lon) so the fragment can
	// compare geographic normal with sun direction (terminator stays stable
	// regardless of camera/morph).
	const substrateVertex = /* glsl */ `
		${EQUAL_EARTH_VERTEX_GLSL}
		uniform float uMorph;
		uniform float uRadius;
		varying vec3 vGeoNormal;
		void main() {
			vGeoNormal = normalize(position);
			vec3 pos = morphSphereToEqualEarth(position, uRadius, uMorph);
			gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
		}
	`;

	// Substrate fragment: subtle day/night terminator. Day side gets a small
	// teal-blue lift over the near-black night side. On flat morph the
	// terminator becomes a curve drawn ON the plane — physically defensible
	// (it's still where the sun is) and visually informative.
	const substrateFragment = /* glsl */ `
		uniform vec3 uColor;
		uniform vec3 uSunDir;
		varying vec3 vGeoNormal;
		void main() {
			float sunDot = dot(vGeoNormal, normalize(uSunDir));
			// Soft terminator: ~5° band at the day/night line.
			float light = smoothstep(-0.05, 0.10, sunDot);
			// Day-side teal-blue lift; night-side stays at the configured base.
			vec3 dayTint = vec3(0.05, 0.07, 0.12);
			vec3 col = uColor + dayTint * light;
			gl_FragColor = vec4(col, 1.0);
		}
	`;

	const wireframeFragment = /* glsl */ `
		uniform vec3 uColor;
		void main() {
			gl_FragColor = vec4(uColor, 0.35);
		}
	`;

	// Atmosphere — outer sphere, Fresnel rim glow with sun-side bias.
	// Backside-only (cull front) so it draws as a halo around the Earth.
	const atmosphereVertex = /* glsl */ `
		varying vec3 vWorldPosition;
		varying vec3 vWorldNormal;
		void main() {
			vec4 worldPos = modelMatrix * vec4(position, 1.0);
			vWorldPosition = worldPos.xyz;
			vWorldNormal = normalize(mat3(modelMatrix) * normal);
			gl_Position = projectionMatrix * viewMatrix * worldPos;
		}
	`;

	const atmosphereFragment = /* glsl */ `
		uniform vec3 uColor;
		uniform vec3 uSunDir;
		uniform float uMorph;
		varying vec3 vWorldPosition;
		varying vec3 vWorldNormal;
		void main() {
			// View direction from camera to fragment.
			vec3 viewDir = normalize(cameraPosition - vWorldPosition);
			// Fresnel: 1 at grazing, 0 looking straight down.
			float fresnel = pow(1.0 - max(dot(viewDir, vWorldNormal), 0.0), 2.5);
			// Sun-side bias: brightness biased toward the lit limb.
			float sunDot = dot(normalize(vWorldNormal), normalize(uSunDir));
			float sunGlow = smoothstep(-0.3, 0.6, sunDot);
			float intensity = fresnel * (0.35 + 0.65 * sunGlow);
			// Fade out as the globe morphs to flat — atmosphere has no
			// physical interpretation on the flat plane.
			intensity *= (1.0 - uMorph);
			gl_FragColor = vec4(uColor * intensity, intensity);
		}
	`;

	return (
		<group>
			{/* Earth substrate — solid sphere with vertex morph to Equal Earth. */}
			<mesh>
				<sphereGeometry args={[radius, 96, 96]} />
				<shaderMaterial
					ref={earthMatRef}
					uniforms={substrateUniforms}
					vertexShader={substrateVertex}
					fragmentShader={substrateFragment}
					toneMapped={false}
				/>
			</mesh>
			{/* Wireframe graticule — morph + transparent lines, no day/night. */}
			<mesh>
				<sphereGeometry args={[radius * 1.001, 36, 24]} />
				<shaderMaterial
					ref={wireMatRef}
					uniforms={wireframeUniforms}
					vertexShader={
						/* glsl */ `
						${EQUAL_EARTH_VERTEX_GLSL}
						uniform float uMorph;
						uniform float uRadius;
						void main() {
							vec3 pos = morphSphereToEqualEarth(position, uRadius, uMorph);
							gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
						}
					`
					}
					fragmentShader={wireframeFragment}
					transparent
					wireframe
					toneMapped={false}
				/>
			</mesh>
			{/* Atmosphere — outer Fresnel halo, fades to zero on flat map. */}
			<mesh renderOrder={-1}>
				<sphereGeometry
					args={[radius * ATMOSPHERE_RADIUS_MULTIPLIER, 64, 64]}
				/>
				<shaderMaterial
					ref={atmosphereMatRef}
					uniforms={atmosphereUniforms}
					vertexShader={atmosphereVertex}
					fragmentShader={atmosphereFragment}
					transparent
					blending={THREE.AdditiveBlending}
					side={THREE.BackSide}
					depthWrite={false}
					toneMapped={false}
				/>
			</mesh>
			{/* Country instances — CPU-baked matrices, re-baked on morph change. */}
			<instancedMesh
				ref={meshRef}
				args={[undefined, undefined, COUNTRY_CENTROIDS.length]}
			>
				<sphereGeometry args={[1, 12, 12]} />
				<meshBasicMaterial toneMapped={false} />
			</instancedMesh>
		</group>
	);
}
