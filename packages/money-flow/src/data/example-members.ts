/**
 * Fabricated example member-point dataset — 20 entries spread across
 * different countries and classification buckets, used as the default when
 * no `members` prop is supplied to `MoneyFlowClient` / `MoneyFlowMount`.
 *
 * None of this represents real people, real accounts, or real positions —
 * it exists purely to make the member-point cloud render something out of
 * the box. Swap it out with your own `MemberPoint[]`.
 */

import type { MemberPoint } from "./member-point";

export const EXAMPLE_MEMBER_POINTS: MemberPoint[] = [
	{ id: "example-01", magnitudeClass: "O", homeCountry: "US" },
	{ id: "example-02", magnitudeClass: "B", homeCountry: "US" },
	{ id: "example-03", magnitudeClass: "G", homeCountry: "GB" },
	{ id: "example-04", magnitudeClass: "A", homeCountry: "DE" },
	{ id: "example-05", magnitudeClass: "K", homeCountry: "FR" },
	{ id: "example-06", magnitudeClass: "F", homeCountry: "JP" },
	{ id: "example-07", magnitudeClass: "M", homeCountry: "SG" },
	{ id: "example-08", magnitudeClass: "G", homeCountry: "BR" },
	{ id: "example-09", magnitudeClass: "O", homeCountry: "IN" },
	{ id: "example-10", magnitudeClass: "B", homeCountry: "AU" },
	{ id: "example-11", magnitudeClass: "A", homeCountry: "CA" },
	{ id: "example-12", magnitudeClass: "K", homeCountry: "ZA" },
	{ id: "example-13", magnitudeClass: "F", homeCountry: "AE" },
	{ id: "example-14", magnitudeClass: "G", homeCountry: "KR" },
	{ id: "example-15", magnitudeClass: "M", homeCountry: "NL" },
	{ id: "example-16", magnitudeClass: "PROVISIONAL", homeCountry: "CH" },
	{ id: "example-17", magnitudeClass: "O", homeCountry: "SE" },
	{ id: "example-18", magnitudeClass: "B", homeCountry: "MX" },
	{ id: "example-19", magnitudeClass: "A", homeCountry: "NG" },
	// No homeCountry — falls back to the deterministic Fibonacci-sphere spot.
	{ id: "example-20", magnitudeClass: "K", homeCountry: null },
];
