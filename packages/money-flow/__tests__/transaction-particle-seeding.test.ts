import { describe, expect, it } from "vitest";
import { lowerBoundCumulative } from "../src/scene/transaction-particles";

function referenceLinear(cumulative: Float32Array, target: number): number {
	if (cumulative.length === 0) return -1;
	let corridor = cumulative.length - 1;
	for (let index = 0; index < cumulative.length; index++) {
		if (cumulative[index] >= target) {
			corridor = index;
			break;
		}
	}
	return corridor;
}

function seededRandom(seed: number): () => number {
	let state = seed | 0;
	return () => {
		state = (state * 1664525 + 1013904223) | 0;
		return (state >>> 0) / 0x100000000;
	};
}

describe("transaction particle cumulative selection", () => {
	it("matches the reference at first, last, exact, and between-bucket boundaries", () => {
		const cumulative = new Float32Array([0.1, 0.35, 0.75, 1]);
		const targets = [0, 0.1, 0.1000001, 0.2, 0.35, 0.5, 0.75, 0.999999, 1, 1.1];

		for (const target of targets) {
			expect(lowerBoundCumulative(cumulative, target)).toBe(
				referenceLinear(cumulative, target),
			);
		}
	});

	it("handles an empty table and a single corridor", () => {
		expect(lowerBoundCumulative(new Float32Array(), 0)).toBe(-1);
		const single = new Float32Array([3.5]);
		for (const target of [0, 3.5, 9]) {
			expect(lowerBoundCumulative(single, target)).toBe(
				referenceLinear(single, target),
			);
		}
	});

	it("matches deterministic randomized cumulative tables", () => {
		const random = seededRandom(0x5eed1234);
		for (let tableIndex = 0; tableIndex < 24; tableIndex++) {
			const cumulative = new Float32Array(1 + (tableIndex % 17));
			let total = 0;
			for (let index = 0; index < cumulative.length; index++) {
				total += 0.001 + random() * 10;
				cumulative[index] = total;
			}

			for (let sample = 0; sample < 500; sample++) {
				const target = random() * total;
				expect(lowerBoundCumulative(cumulative, target)).toBe(
					referenceLinear(cumulative, target),
				);
			}
		}
	});

	it("keeps 100K deterministic selections identical across 600 corridors", () => {
		const random = seededRandom(0x9e3779b9);
		const cumulative = new Float32Array(600);
		let total = 0;
		for (let index = 0; index < cumulative.length; index++) {
			total += 0.01 + random() * 4;
			cumulative[index] = total;
		}
		const targets = Float64Array.from(
			{ length: 100_000 },
			() => random() * total,
		);

		const expected = Uint16Array.from(targets, (target) =>
			referenceLinear(cumulative, target),
		);
		const actual = Uint16Array.from(targets, (target) =>
			lowerBoundCumulative(cumulative, target),
		);

		expect(actual).toEqual(expected);
	});

	it("reads only logarithmically many buckets in a large cumulative table", () => {
		const length = 1 << 20;
		let bucketReads = 0;
		const cumulative = new Proxy({ length } as ArrayLike<number>, {
			get(target, property, receiver) {
				if (property === "length") return target.length;
				bucketReads++;
				return Number(property) + 1;
			},
		});

		expect(lowerBoundCumulative(cumulative, 900_000.5)).toBe(900_000);
		expect(bucketReads).toBeLessThanOrEqual(Math.ceil(Math.log2(length)) + 1);
	});
});
