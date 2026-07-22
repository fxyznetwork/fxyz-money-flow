import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import {
	getFlowRenderPolicy,
	PARTICLE_CEILINGS,
} from "../src/money-flow-client";
import { writeParticleInstances } from "../src/scene/transaction-particles";

const clientSource = readFileSync(
	new URL(
		"../src/money-flow-client.tsx",
		import.meta.url,
	),
	"utf8",
);
const particleSource = readFileSync(
	new URL(
		"../src/scene/transaction-particles.tsx",
		import.meta.url,
	),
	"utf8",
);

describe("money-flow reduced-motion policy", () => {
	it("keeps the 100K normal path and defines explicit quality ceilings", () => {
		expect(PARTICLE_CEILINGS).toEqual({
			high: 100_000,
			medium: 50_000,
			low: 10_000,
		});
		expect(getFlowRenderPolicy(false, false)).toEqual({
			staticScene: false,
			frameloop: "always",
			particleCeiling: 100_000,
			autoRotate: true,
		});
	});

	it("uses demand rendering and stops integration/autorotation when static", () => {
		expect(getFlowRenderPolicy(true, false)).toEqual({
			staticScene: true,
			frameloop: "demand",
			particleCeiling: 10_000,
			autoRotate: false,
		});
		expect(getFlowRenderPolicy(false, true)).toEqual({
			staticScene: true,
			frameloop: "demand",
			particleCeiling: 100_000,
			autoRotate: false,
		});
		expect(clientSource).toContain(
			'import { useReducedMotion } from "./hooks/use-reduced-motion"',
		);
		expect(clientSource).toContain("<DemandInvalidation");
		expect(clientSource).toContain("frameloop={renderPolicy.frameloop}");
		expect(clientSource).toContain("paused={renderPolicy.staticScene}");
	});

	it("writes a static pose before paused frames and does not integrate it", () => {
		const matrices: THREE.Matrix4[] = [];
		const target = {
			setMatrixAt: (_index: number, matrix: THREE.Matrix4) =>
				matrices.push(matrix.clone()),
			instanceMatrix: { needsUpdate: false },
		};
		const t = 0.5;
		const tQuantized = Math.floor(t * 0xffff);
		const u32View = new Uint32Array([32768 << 8, (tQuantized & 0xffff) << 16]);
		const arcs = new Float32Array([0, 0, 0, 0.5, 1, 0, 1, 0, 0]);
		const initialState = u32View[1];

		writeParticleInstances({
			target,
			count: 1,
			u32View,
			arcs,
			delta: 0,
			speed: 1,
			advance: false,
			scratchMatrix: new THREE.Matrix4(),
		});

		expect(u32View[1]).toBe(initialState);
		expect(target.instanceMatrix.needsUpdate).toBe(true);
		expect(matrices).toHaveLength(1);
		expect(
			new THREE.Vector3().setFromMatrixPosition(matrices[0]).length(),
		).toBeGreaterThan(0);
		expect(particleSource).toMatch(
			/useEffect\([\s\S]*advance: false[\s\S]*invalidate\(\)/,
		);
		expect(particleSource).toMatch(/if \(paused\) return;[\s\S]*advance: true/);
	});
});
