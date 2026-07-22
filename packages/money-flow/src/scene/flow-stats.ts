"use client";

/**
 * Flow stats — drawcall + FPS measurement for the HUD.
 *
 * `StatsCollector` lives inside the R3F Canvas and writes to a module-scope
 * ref each frame. `useFlowStatsPoll` polls that ref via setInterval so HUD
 * updates don't re-render the scene.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";

export interface FlowStats {
	fps: number;
	drawCalls: number;
	triangles: number;
	frameMs: number;
}

const initialStats: FlowStats = {
	fps: 0,
	drawCalls: 0,
	triangles: 0,
	frameMs: 0,
};

export const flowStatsRef: { current: FlowStats } = { current: initialStats };

export function StatsCollector(): null {
	const gl = useThree((s) => s.gl);
	const frameCount = useRef(0);
	const lastSampleTime = useRef<number | null>(null);
	if (lastSampleTime.current === null) {
		lastSampleTime.current = performance.now();
	}
	const lastFps = useRef(0);

	useFrame((_state, delta) => {
		frameCount.current++;
		const now = performance.now();
		const previousSampleTime = lastSampleTime.current ?? now;
		const elapsed = now - previousSampleTime;
		if (elapsed >= 250) {
			lastFps.current = (frameCount.current * 1000) / elapsed;
			frameCount.current = 0;
			lastSampleTime.current = now;
		}
		flowStatsRef.current = {
			fps: lastFps.current,
			drawCalls: gl.info.render.calls,
			triangles: gl.info.render.triangles,
			frameMs: delta * 1000,
		};
	});

	return null;
}

export function useFlowStatsPoll(intervalMs = 250): FlowStats {
	const [stats, setStats] = useState<FlowStats>(initialStats);
	useEffect(() => {
		const id = setInterval(
			() => setStats({ ...flowStatsRef.current }),
			intervalMs,
		);
		return () => clearInterval(id);
	}, [intervalMs]);
	return stats;
}
