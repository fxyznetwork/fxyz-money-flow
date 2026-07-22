/**
 * MemberPoint — the data contract for the optional member-point cloud
 * overlay (see `../scene/member-cloud.tsx`).
 *
 * Deliberately minimal: an id for deterministic placement, an optional
 * classification bucket that drives color, and an optional ISO 3166-1
 * alpha-2 country code that drives position. There is nothing here to carry
 * personal data — no name, no address, no precise location, no identifier
 * beyond whatever opaque `id` you supply.
 */
export interface MemberPoint {
	id: string;
	/**
	 * Arbitrary classification bucket used for color coding (see
	 * `SPECTRAL_COLORS` in `member-cloud.tsx` for the default O/B/A/F/G/K/M
	 * scheme). Any string works; unrecognized values fall back to a neutral
	 * color. Omit or pass `null` for "no classification".
	 */
	magnitudeClass?: string | null;
	/**
	 * ISO 3166-1 alpha-2 country code. When it matches a known country
	 * centroid, the point is placed there; otherwise (or when omitted) it
	 * falls back to a deterministic Fibonacci-sphere position.
	 */
	homeCountry?: string | null;
}
