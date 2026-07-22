"use client";

/**
 * Member-point data source — injectable, not fetched.
 *
 * This package never calls a backend for member-point data. It renders
 * whichever `MemberPoint[]` you pass in via the `members` prop, or falls
 * back to a small fabricated example dataset (`EXAMPLE_MEMBER_POINTS`) so
 * the member-point cloud has something to show out of the box.
 */

import { EXAMPLE_MEMBER_POINTS } from "./example-members";
import type { MemberPoint } from "./member-point";

export type { MemberPoint } from "./member-point";

export interface UseMemberPointsResult {
	members: MemberPoint[] | null;
	loading: boolean;
	error: string | null;
}

/**
 * Resolve the member points to render.
 *
 * @param data - Caller-supplied points, or `undefined`/`null` to use the
 *   bundled example dataset.
 * @param disabled - When true, returns no points regardless of `data`
 *   (mirrors the "showMembers" HUD toggle).
 */
export function useMemberPoints(
	data: MemberPoint[] | null | undefined,
	disabled = false,
): UseMemberPointsResult {
	if (disabled) {
		return { members: null, loading: false, error: null };
	}
	return { members: data ?? EXAMPLE_MEMBER_POINTS, loading: false, error: null };
}
