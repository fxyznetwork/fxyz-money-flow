/**
 * @fxyz/money-flow — gravity-model (Tinbergen) bilateral trade-flow globe,
 * transaction-particle system, and member-point cloud, in one
 * client-rendered Canvas.
 *
 * The top-level component is "use client". Its Canvas needs `ssr: false` at
 * the route level, since react-three-fiber can't render server-side —
 * `MoneyFlowMount` below does that for you via `next/dynamic`.
 */

export {
	MoneyFlowClient,
	type MoneyFlowClientProps,
} from "./money-flow-client";
export { MoneyFlowMount } from "./money-flow-mount";
export { EXAMPLE_MEMBER_POINTS } from "./data/example-members";
export type {
	MemberPoint,
	UseMemberPointsResult,
} from "./data/use-members";
