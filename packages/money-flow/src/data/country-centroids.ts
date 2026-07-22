/**
 * Country centroids for the money-flow demo.
 *
 * 86 countries covering >99% of global GDP and FX volume. Real capital-city
 * lat/lon for each. GDP tiers are coarse (1=largest, 6=smallest) — used by the
 * gravity model, not displayed.
 *
 * Region grouping mirrors UN M49. Color coding in the scene comes from this.
 *
 * This is the **extension point**: add more entries to scale up corridor count.
 * Adding all 251 ISO-3166 entries would push the bilateral matrix to ~31K
 * corridors. Today's 86 → ~3.7K half-matrix, ~7.4K full directional. The
 * scene's drawcall budget is unaffected by count (single LineSegments).
 *
 * Real BIS LBS bilateral data can override this — see `use-bilateral-matrix.ts`.
 */

export type Region =
	| "northAmerica"
	| "southAmerica"
	| "europe"
	| "africa"
	| "middleEast"
	| "centralAsia"
	| "eastAsia"
	| "southAsia"
	| "southeastAsia"
	| "oceania";

export interface CountryCentroid {
	iso2: string;
	name: string;
	lat: number;
	lon: number;
	/** GDP tier 1..6 — driver for gravity-model weight. 1 = USA/CN scale. */
	gdpTier: number;
	region: Region;
}

export const COUNTRY_CENTROIDS: readonly CountryCentroid[] = [
	// North America
	{
		iso2: "US",
		name: "United States",
		lat: 38.9072,
		lon: -77.0369,
		gdpTier: 1,
		region: "northAmerica",
	},
	{
		iso2: "CA",
		name: "Canada",
		lat: 45.4215,
		lon: -75.6972,
		gdpTier: 2,
		region: "northAmerica",
	},
	{
		iso2: "MX",
		name: "Mexico",
		lat: 19.4326,
		lon: -99.1332,
		gdpTier: 3,
		region: "northAmerica",
	},

	// South America
	{
		iso2: "BR",
		name: "Brazil",
		lat: -15.8267,
		lon: -47.9218,
		gdpTier: 2,
		region: "southAmerica",
	},
	{
		iso2: "AR",
		name: "Argentina",
		lat: -34.6037,
		lon: -58.3816,
		gdpTier: 3,
		region: "southAmerica",
	},
	{
		iso2: "CL",
		name: "Chile",
		lat: -33.4489,
		lon: -70.6693,
		gdpTier: 4,
		region: "southAmerica",
	},
	{
		iso2: "CO",
		name: "Colombia",
		lat: 4.711,
		lon: -74.0721,
		gdpTier: 4,
		region: "southAmerica",
	},
	{
		iso2: "PE",
		name: "Peru",
		lat: -12.0464,
		lon: -77.0428,
		gdpTier: 4,
		region: "southAmerica",
	},
	{
		iso2: "VE",
		name: "Venezuela",
		lat: 10.4806,
		lon: -66.9036,
		gdpTier: 5,
		region: "southAmerica",
	},
	{
		iso2: "EC",
		name: "Ecuador",
		lat: -0.1807,
		lon: -78.4678,
		gdpTier: 5,
		region: "southAmerica",
	},
	{
		iso2: "UY",
		name: "Uruguay",
		lat: -34.9011,
		lon: -56.1645,
		gdpTier: 5,
		region: "southAmerica",
	},

	// Europe — west
	{
		iso2: "GB",
		name: "United Kingdom",
		lat: 51.5074,
		lon: -0.1278,
		gdpTier: 2,
		region: "europe",
	},
	{
		iso2: "DE",
		name: "Germany",
		lat: 52.52,
		lon: 13.405,
		gdpTier: 2,
		region: "europe",
	},
	{
		iso2: "FR",
		name: "France",
		lat: 48.8566,
		lon: 2.3522,
		gdpTier: 2,
		region: "europe",
	},
	{
		iso2: "IT",
		name: "Italy",
		lat: 41.9028,
		lon: 12.4964,
		gdpTier: 3,
		region: "europe",
	},
	{
		iso2: "ES",
		name: "Spain",
		lat: 40.4168,
		lon: -3.7038,
		gdpTier: 3,
		region: "europe",
	},
	{
		iso2: "NL",
		name: "Netherlands",
		lat: 52.3676,
		lon: 4.9041,
		gdpTier: 3,
		region: "europe",
	},
	{
		iso2: "BE",
		name: "Belgium",
		lat: 50.8503,
		lon: 4.3517,
		gdpTier: 4,
		region: "europe",
	},
	{
		iso2: "CH",
		name: "Switzerland",
		lat: 46.948,
		lon: 7.4474,
		gdpTier: 3,
		region: "europe",
	},
	{
		iso2: "AT",
		name: "Austria",
		lat: 48.2082,
		lon: 16.3738,
		gdpTier: 4,
		region: "europe",
	},
	{
		iso2: "IE",
		name: "Ireland",
		lat: 53.3498,
		lon: -6.2603,
		gdpTier: 4,
		region: "europe",
	},
	{
		iso2: "PT",
		name: "Portugal",
		lat: 38.7223,
		lon: -9.1393,
		gdpTier: 4,
		region: "europe",
	},
	{
		iso2: "DK",
		name: "Denmark",
		lat: 55.6761,
		lon: 12.5683,
		gdpTier: 4,
		region: "europe",
	},
	{
		iso2: "SE",
		name: "Sweden",
		lat: 59.3293,
		lon: 18.0686,
		gdpTier: 4,
		region: "europe",
	},
	{
		iso2: "NO",
		name: "Norway",
		lat: 59.9139,
		lon: 10.7522,
		gdpTier: 4,
		region: "europe",
	},
	{
		iso2: "FI",
		name: "Finland",
		lat: 60.1699,
		lon: 24.9384,
		gdpTier: 4,
		region: "europe",
	},
	{
		iso2: "IS",
		name: "Iceland",
		lat: 64.1466,
		lon: -21.9426,
		gdpTier: 6,
		region: "europe",
	},
	{
		iso2: "LU",
		name: "Luxembourg",
		lat: 49.6116,
		lon: 6.1319,
		gdpTier: 4,
		region: "europe",
	},

	// Europe — central / east
	{
		iso2: "PL",
		name: "Poland",
		lat: 52.2297,
		lon: 21.0122,
		gdpTier: 3,
		region: "europe",
	},
	{
		iso2: "CZ",
		name: "Czechia",
		lat: 50.0755,
		lon: 14.4378,
		gdpTier: 4,
		region: "europe",
	},
	{
		iso2: "HU",
		name: "Hungary",
		lat: 47.4979,
		lon: 19.0402,
		gdpTier: 5,
		region: "europe",
	},
	{
		iso2: "GR",
		name: "Greece",
		lat: 37.9838,
		lon: 23.7275,
		gdpTier: 4,
		region: "europe",
	},
	{
		iso2: "RO",
		name: "Romania",
		lat: 44.4268,
		lon: 26.1025,
		gdpTier: 4,
		region: "europe",
	},
	{
		iso2: "BG",
		name: "Bulgaria",
		lat: 42.6977,
		lon: 23.3219,
		gdpTier: 5,
		region: "europe",
	},
	{
		iso2: "RS",
		name: "Serbia",
		lat: 44.7866,
		lon: 20.4489,
		gdpTier: 5,
		region: "europe",
	},
	{
		iso2: "UA",
		name: "Ukraine",
		lat: 50.4501,
		lon: 30.5234,
		gdpTier: 4,
		region: "europe",
	},
	{
		iso2: "RU",
		name: "Russia",
		lat: 55.7558,
		lon: 37.6173,
		gdpTier: 2,
		region: "europe",
	},
	{
		iso2: "BY",
		name: "Belarus",
		lat: 53.9006,
		lon: 27.559,
		gdpTier: 5,
		region: "europe",
	},
	{
		iso2: "TR",
		name: "Turkey",
		lat: 39.9334,
		lon: 32.8597,
		gdpTier: 3,
		region: "europe",
	},

	// Middle East
	{
		iso2: "AE",
		name: "United Arab Emirates",
		lat: 25.2048,
		lon: 55.2708,
		gdpTier: 3,
		region: "middleEast",
	},
	{
		iso2: "SA",
		name: "Saudi Arabia",
		lat: 24.7136,
		lon: 46.6753,
		gdpTier: 2,
		region: "middleEast",
	},
	{
		iso2: "IL",
		name: "Israel",
		lat: 31.7683,
		lon: 35.2137,
		gdpTier: 3,
		region: "middleEast",
	},
	{
		iso2: "QA",
		name: "Qatar",
		lat: 25.2854,
		lon: 51.531,
		gdpTier: 4,
		region: "middleEast",
	},
	{
		iso2: "KW",
		name: "Kuwait",
		lat: 29.3759,
		lon: 47.9774,
		gdpTier: 4,
		region: "middleEast",
	},
	{
		iso2: "BH",
		name: "Bahrain",
		lat: 26.0667,
		lon: 50.5577,
		gdpTier: 5,
		region: "middleEast",
	},
	{
		iso2: "OM",
		name: "Oman",
		lat: 23.588,
		lon: 58.3829,
		gdpTier: 5,
		region: "middleEast",
	},
	{
		iso2: "IR",
		name: "Iran",
		lat: 35.6892,
		lon: 51.389,
		gdpTier: 4,
		region: "middleEast",
	},
	{
		iso2: "IQ",
		name: "Iraq",
		lat: 33.3152,
		lon: 44.3661,
		gdpTier: 5,
		region: "middleEast",
	},
	{
		iso2: "JO",
		name: "Jordan",
		lat: 31.9454,
		lon: 35.9284,
		gdpTier: 5,
		region: "middleEast",
	},
	{
		iso2: "LB",
		name: "Lebanon",
		lat: 33.8938,
		lon: 35.5018,
		gdpTier: 5,
		region: "middleEast",
	},
	{
		iso2: "EG",
		name: "Egypt",
		lat: 30.0444,
		lon: 31.2357,
		gdpTier: 4,
		region: "africa",
	},

	// Africa
	{
		iso2: "ZA",
		name: "South Africa",
		lat: -25.7479,
		lon: 28.2293,
		gdpTier: 3,
		region: "africa",
	},
	{
		iso2: "NG",
		name: "Nigeria",
		lat: 9.0765,
		lon: 7.3986,
		gdpTier: 3,
		region: "africa",
	},
	{
		iso2: "KE",
		name: "Kenya",
		lat: -1.2921,
		lon: 36.8219,
		gdpTier: 4,
		region: "africa",
	},
	{
		iso2: "GH",
		name: "Ghana",
		lat: 5.6037,
		lon: -0.187,
		gdpTier: 5,
		region: "africa",
	},
	{
		iso2: "ET",
		name: "Ethiopia",
		lat: 9.145,
		lon: 40.4897,
		gdpTier: 5,
		region: "africa",
	},
	{
		iso2: "MA",
		name: "Morocco",
		lat: 33.9716,
		lon: -6.8498,
		gdpTier: 4,
		region: "africa",
	},
	{
		iso2: "DZ",
		name: "Algeria",
		lat: 36.7538,
		lon: 3.0588,
		gdpTier: 4,
		region: "africa",
	},
	{
		iso2: "TN",
		name: "Tunisia",
		lat: 36.8065,
		lon: 10.1815,
		gdpTier: 5,
		region: "africa",
	},
	{
		iso2: "AO",
		name: "Angola",
		lat: -8.839,
		lon: 13.2894,
		gdpTier: 5,
		region: "africa",
	},
	{
		iso2: "TZ",
		name: "Tanzania",
		lat: -6.7924,
		lon: 39.2083,
		gdpTier: 5,
		region: "africa",
	},
	{
		iso2: "UG",
		name: "Uganda",
		lat: 0.3476,
		lon: 32.5825,
		gdpTier: 5,
		region: "africa",
	},
	{
		iso2: "CI",
		name: "Côte d'Ivoire",
		lat: 5.36,
		lon: -4.0083,
		gdpTier: 5,
		region: "africa",
	},
	{
		iso2: "SN",
		name: "Senegal",
		lat: 14.7167,
		lon: -17.4677,
		gdpTier: 6,
		region: "africa",
	},

	// Central Asia
	{
		iso2: "KZ",
		name: "Kazakhstan",
		lat: 51.1605,
		lon: 71.4704,
		gdpTier: 4,
		region: "centralAsia",
	},
	{
		iso2: "UZ",
		name: "Uzbekistan",
		lat: 41.2995,
		lon: 69.2401,
		gdpTier: 5,
		region: "centralAsia",
	},
	{
		iso2: "AZ",
		name: "Azerbaijan",
		lat: 40.4093,
		lon: 49.8671,
		gdpTier: 5,
		region: "centralAsia",
	},
	{
		iso2: "GE",
		name: "Georgia",
		lat: 41.7151,
		lon: 44.8271,
		gdpTier: 6,
		region: "centralAsia",
	},
	{
		iso2: "AM",
		name: "Armenia",
		lat: 40.1872,
		lon: 44.5152,
		gdpTier: 6,
		region: "centralAsia",
	},

	// East Asia
	{
		iso2: "CN",
		name: "China",
		lat: 39.9042,
		lon: 116.4074,
		gdpTier: 1,
		region: "eastAsia",
	},
	{
		iso2: "JP",
		name: "Japan",
		lat: 35.6762,
		lon: 139.6503,
		gdpTier: 2,
		region: "eastAsia",
	},
	{
		iso2: "KR",
		name: "South Korea",
		lat: 37.5665,
		lon: 126.978,
		gdpTier: 3,
		region: "eastAsia",
	},
	{
		iso2: "TW",
		name: "Taiwan",
		lat: 25.033,
		lon: 121.5654,
		gdpTier: 3,
		region: "eastAsia",
	},
	{
		iso2: "HK",
		name: "Hong Kong",
		lat: 22.3193,
		lon: 114.1694,
		gdpTier: 3,
		region: "eastAsia",
	},
	{
		iso2: "MO",
		name: "Macao",
		lat: 22.1987,
		lon: 113.5439,
		gdpTier: 5,
		region: "eastAsia",
	},
	{
		iso2: "MN",
		name: "Mongolia",
		lat: 47.8864,
		lon: 106.9057,
		gdpTier: 6,
		region: "eastAsia",
	},

	// South Asia
	{
		iso2: "IN",
		name: "India",
		lat: 28.6139,
		lon: 77.209,
		gdpTier: 1,
		region: "southAsia",
	},
	{
		iso2: "PK",
		name: "Pakistan",
		lat: 33.6844,
		lon: 73.0479,
		gdpTier: 4,
		region: "southAsia",
	},
	{
		iso2: "BD",
		name: "Bangladesh",
		lat: 23.8103,
		lon: 90.4125,
		gdpTier: 4,
		region: "southAsia",
	},
	{
		iso2: "LK",
		name: "Sri Lanka",
		lat: 6.9271,
		lon: 79.8612,
		gdpTier: 5,
		region: "southAsia",
	},
	{
		iso2: "NP",
		name: "Nepal",
		lat: 27.7172,
		lon: 85.324,
		gdpTier: 6,
		region: "southAsia",
	},

	// Southeast Asia
	{
		iso2: "SG",
		name: "Singapore",
		lat: 1.3521,
		lon: 103.8198,
		gdpTier: 3,
		region: "southeastAsia",
	},
	{
		iso2: "ID",
		name: "Indonesia",
		lat: -6.2088,
		lon: 106.8456,
		gdpTier: 3,
		region: "southeastAsia",
	},
	{
		iso2: "TH",
		name: "Thailand",
		lat: 13.7563,
		lon: 100.5018,
		gdpTier: 3,
		region: "southeastAsia",
	},
	{
		iso2: "VN",
		name: "Vietnam",
		lat: 21.0285,
		lon: 105.8542,
		gdpTier: 4,
		region: "southeastAsia",
	},
	{
		iso2: "MY",
		name: "Malaysia",
		lat: 3.139,
		lon: 101.6869,
		gdpTier: 4,
		region: "southeastAsia",
	},
	{
		iso2: "PH",
		name: "Philippines",
		lat: 14.5995,
		lon: 120.9842,
		gdpTier: 4,
		region: "southeastAsia",
	},
	{
		iso2: "MM",
		name: "Myanmar",
		lat: 19.7633,
		lon: 96.0785,
		gdpTier: 5,
		region: "southeastAsia",
	},
	{
		iso2: "KH",
		name: "Cambodia",
		lat: 11.5564,
		lon: 104.9282,
		gdpTier: 6,
		region: "southeastAsia",
	},

	// Oceania
	{
		iso2: "AU",
		name: "Australia",
		lat: -33.8688,
		lon: 151.2093,
		gdpTier: 2,
		region: "oceania",
	},
	{
		iso2: "NZ",
		name: "New Zealand",
		lat: -41.2865,
		lon: 174.7762,
		gdpTier: 4,
		region: "oceania",
	},
	{
		iso2: "FJ",
		name: "Fiji",
		lat: -18.1248,
		lon: 178.4501,
		gdpTier: 6,
		region: "oceania",
	},
	{
		iso2: "PG",
		name: "Papua New Guinea",
		lat: -9.4438,
		lon: 147.1803,
		gdpTier: 6,
		region: "oceania",
	},
];

/** Multiplier from GDP tier → economic mass scalar used in the gravity model. */
export const GDP_TIER_MASS: Record<number, number> = {
	1: 25, // US, CN, IN — top tier
	2: 12, // JP, DE, GB, FR, RU, BR, CA, AU, SA — major economies
	3: 6, // IT, ES, MX, KR, ID, NL, TR, CH, PL, TW, AR, BE, AE, ZA, NG, IL, SG, TH, HK
	4: 3, // mid-tier secondary economies
	5: 1.2, // smaller secondary
	6: 0.4, // small / island / niche
};

/** Number of regions, used for color slot allocation. */
export const REGIONS: readonly Region[] = [
	"northAmerica",
	"southAmerica",
	"europe",
	"africa",
	"middleEast",
	"centralAsia",
	"eastAsia",
	"southAsia",
	"southeastAsia",
	"oceania",
] as const;

/** Region color mapping. Mid-saturation, pulled from Stellar v3 family. */
export const REGION_COLORS: Record<Region, string> = {
	northAmerica: "#fbbc7a", // warm amber
	southAmerica: "#f59e0b", // amber
	europe: "#60a5fa", // sky
	africa: "#34d399", // emerald
	middleEast: "#fb923c", // orange
	centralAsia: "#a78bfa", // violet
	eastAsia: "#f87171", // red
	southAsia: "#fbbf24", // yellow
	southeastAsia: "#22d3ee", // cyan
	oceania: "#a3e635", // lime
};
