/**
 * Eigenvector centrality on the bilateral matrix.
 *
 * Reference: Soramäki, Bech, Arnold, Glass, Beyeler. "The Topology of
 * Interbank Payment Flows," Physica A 379 (2007). The Fedwire core-periphery
 * decomposition uses eigenvector centrality (and its in/out variants) to
 * surface "money-center" countries — the financial hubs that mediate the
 * majority of cross-border claims even when their direct counterparty count
 * is similar to peripheral nodes.
 *
 * Power iteration is more than sufficient at 86×86 (BilateralMatrix node
 * count == COUNTRY_CENTROIDS.length): converges in ~25 iterations with
 * tolerance 1e-6. Cost is O(iterations × edges), which is dwarfed by the
 * gravity model and rebuild logic.
 *
 * The matrix is treated as undirected for centrality (sum of incoming +
 * outgoing) — directional centrality (Bonacich+Lloyd 2001) would split
 * source-importance from sink-importance, which is meaningful but adds two
 * scalar fields per node. Deferred to next pass.
 */

import type { BilateralMatrix } from "./gravity-bilateral";

export interface CentralityResult {
	/** centrality[nodeIndex] ∈ [0..1], normalized so max = 1. */
	centrality: Float32Array;
	/** L2-norm of last residual. < tolerance means converged. */
	residual: number;
	/** Iterations actually performed. */
	iterations: number;
}

const DEFAULT_MAX_ITERATIONS = 64;
const DEFAULT_TOLERANCE = 1e-6;

export function eigenvectorCentrality(
	matrix: BilateralMatrix,
	nodeCount: number,
	options: { maxIterations?: number; tolerance?: number } = {},
): CentralityResult {
	const maxIters = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
	const tol = options.tolerance ?? DEFAULT_TOLERANCE;

	// Initialise with the all-ones vector (canonical power-iteration seed).
	let v = new Float32Array(nodeCount);
	v.fill(1 / Math.sqrt(nodeCount));
	const next = new Float32Array(nodeCount);

	let residual = Number.POSITIVE_INFINITY;
	let iter = 0;

	for (iter = 0; iter < maxIters; iter++) {
		next.fill(0);

		// Sparse matrix-vector multiply via the edge list. Treat undirected:
		// each (i, j) pair contributes weight to both i and j.
		for (let k = 0; k < matrix.corridorCount; k++) {
			const i = matrix.indexPairs[k * 2];
			const j = matrix.indexPairs[k * 2 + 1];
			const w = matrix.weights[k];
			next[i] += w * v[j];
			next[j] += w * v[i];
		}

		// L2-normalise next.
		let norm = 0;
		for (let n = 0; n < nodeCount; n++) norm += next[n] * next[n];
		norm = Math.sqrt(norm);
		if (norm < 1e-12) break; // matrix is null — bail
		const inv = 1 / norm;
		for (let n = 0; n < nodeCount; n++) next[n] *= inv;

		// L2 of (next - v) is the residual.
		let r = 0;
		for (let n = 0; n < nodeCount; n++) {
			const d = next[n] - v[n];
			r += d * d;
		}
		residual = Math.sqrt(r);

		// Swap.
		const tmp = v;
		v = next;
		// reuse `tmp` next iteration
		for (let n = 0; n < nodeCount; n++) tmp[n] = 0;

		if (residual < tol) {
			iter += 1;
			break;
		}
	}

	// Normalise to [0..1] for direct use as a brightness/scale field.
	let max = 0;
	for (let n = 0; n < nodeCount; n++) {
		if (v[n] > max) max = v[n];
	}
	const out = new Float32Array(nodeCount);
	if (max > 0) {
		const inv = 1 / max;
		for (let n = 0; n < nodeCount; n++) out[n] = v[n] * inv;
	}

	return { centrality: out, residual, iterations: iter };
}
