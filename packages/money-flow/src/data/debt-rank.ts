/**
 * DebtRank — systemic-importance ranking on a directional bilateral matrix.
 *
 * Reference: Battiston, Puliga, Kaushik, Tasca, Caldarelli — "DebtRank: Too
 * Central to Fail? Financial Networks, the FED and Systemic Risk."
 * Scientific Reports 2:541 (2012).
 *
 * The classical DebtRank captures how much of the network's total economic
 * value would be at risk if a given node defaulted. Unlike eigenvector
 * centrality (which measures position), DebtRank measures *propagated
 * distress*. A small node deeply tied into the network's vulnerabilities
 * can have higher DebtRank than a large but loosely-connected hub.
 *
 * Algorithm (single-shock variant — node i is the seed):
 *   1. h[j] = 1 if j == i else 0     (distress)
 *      s[j] = "I" (inactive) for all j != i; s[i] = "A" (active)
 *   2. while exists active nodes:
 *        for each j with active inbound neighbor k:
 *          h[j] = min(1, h[j] + sum_k(weight[k→j] * h[k]) / sum_k(weight[k→j]))
 *        s[j] = "A" if h[j] increased
 *        s[k] = "I" (inactive — already propagated) for previously-active k
 *   3. DebtRank(i) = sum_j(h[j] * v[j]) - h[i] * v[i]
 *      where v[j] is the economic value of node j (here: row-sum of weights).
 *
 * Returns the per-node DebtRank, normalized to [0..1] for direct use as a
 * brightness/scale field. Cost: O(N × iterations × edges) — for N=86 and
 * ~10K edges, ~150ms on a 2024 MBP. Computed once per matrix change.
 */

import type { BilateralMatrix } from "./gravity-bilateral";

export interface DebtRankResult {
	/** debtRank[seedNode] ∈ [0..1], normalized so max = 1. */
	debtRank: Float32Array;
	iterations: number;
}

/**
 * Build adjacency-list views of the directional matrix.
 * `outNeighbors[i]` = corridor indices where i is creditor → flow leaves i.
 * `inNeighbors[j]`  = corridor indices where j is debtor   → flow enters j.
 */
function buildAdjacency(
	matrix: BilateralMatrix,
	nodeCount: number,
): {
	outAdj: number[][];
	inAdj: number[][];
	rowSum: Float32Array;
} {
	const outAdj: number[][] = Array.from({ length: nodeCount }, () => []);
	const inAdj: number[][] = Array.from({ length: nodeCount }, () => []);
	const rowSum = new Float32Array(nodeCount);

	for (let k = 0; k < matrix.corridorCount; k++) {
		const i = matrix.indexPairs[k * 2]; // creditor (source of flow)
		const j = matrix.indexPairs[k * 2 + 1]; // debtor (sink)
		const w = matrix.weights[k];
		outAdj[i].push(k);
		inAdj[j].push(k);
		// Row-sum is treated as "economic value" of the node — total flow
		// it touches, in either direction. Sum incoming + outgoing.
		rowSum[i] += w;
		rowSum[j] += w;
	}

	return { outAdj, inAdj, rowSum };
}

/**
 * Compute DebtRank by running a single-shock simulation seeded on each node
 * in turn. Returns the normalized per-node score.
 */
export function debtRankAll(
	matrix: BilateralMatrix,
	nodeCount: number,
	options: { maxIterations?: number } = {},
): DebtRankResult {
	const maxIters = options.maxIterations ?? 32;
	const { outAdj, rowSum } = buildAdjacency(matrix, nodeCount);

	// Total network value = sum of all rowSums / 2 (each weight counted twice).
	let totalValue = 0;
	for (let n = 0; n < nodeCount; n++) totalValue += rowSum[n];
	totalValue *= 0.5;

	const result = new Float32Array(nodeCount);
	let totalIterations = 0;

	const h = new Float32Array(nodeCount);
	// state: 0 = undistressed, 1 = active (distressed this round), 2 = inactive (already propagated)
	const state = new Uint8Array(nodeCount);

	for (let seed = 0; seed < nodeCount; seed++) {
		h.fill(0);
		state.fill(0);
		h[seed] = 1;
		state[seed] = 1;

		let activeCount = 1;
		let iter = 0;

		while (activeCount > 0 && iter < maxIters) {
			iter++;
			// Compute h_next for any node touched by an active neighbor.
			const nextH = new Float32Array(h);
			const nextState = new Uint8Array(state);

			for (let i = 0; i < nodeCount; i++) {
				if (state[i] !== 1) continue; // only active nodes propagate
				// Push distress along outbound edges to debtors.
				for (const k of outAdj[i]) {
					const j = matrix.indexPairs[k * 2 + 1];
					if (state[j] === 2) continue; // already propagated, frozen
					const w = matrix.weights[k];
					// Lever: weight * h[creditor] / debtor's total inbound weight.
					// Use rowSum as a proxy denominator; classical Battiston uses
					// the debtor's interbank-asset side, which we approximate
					// with rowSum[j] for symmetric-noise.
					const denom = rowSum[j] || 1;
					const delta = (w * h[i]) / denom;
					const next = Math.min(1, nextH[j] + delta);
					if (next > nextH[j]) {
						nextH[j] = next;
						if (state[j] === 0) nextState[j] = 1; // newly active
					}
				}
				// Mark this node inactive — it's done propagating.
				nextState[i] = 2;
			}

			// Recount active nodes.
			activeCount = 0;
			for (let n = 0; n < nodeCount; n++) {
				if (nextState[n] === 1) activeCount++;
			}

			h.set(nextH);
			state.set(nextState);
		}

		totalIterations += iter;

		// DebtRank score: weighted sum of distress over the network, minus
		// the seed's own distress (Battiston eq. 4).
		let score = 0;
		for (let n = 0; n < nodeCount; n++) score += h[n] * rowSum[n];
		score -= h[seed] * rowSum[seed];
		result[seed] = totalValue > 0 ? score / (2 * totalValue) : 0;
	}

	// Normalise to [0..1].
	let max = 0;
	for (let n = 0; n < nodeCount; n++) {
		if (result[n] > max) max = result[n];
	}
	if (max > 0) {
		const inv = 1 / max;
		for (let n = 0; n < nodeCount; n++) result[n] *= inv;
	}

	return { debtRank: result, iterations: totalIterations };
}
