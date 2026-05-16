export const ReportVisibility = {
  PUBLIC_ANON: 'PUBLIC_ANON',
  PUBLIC_AUTH: 'PUBLIC_AUTH',
  WITHIN_ORG_ONLY: 'WITHIN_ORG_ONLY',
  WITHIN_ORG_ANCESTORS: 'WITHIN_ORG_ANCESTORS',
  WITHIN_ORG_DESCENDANTS: 'WITHIN_ORG_DESCENDANTS',
  WITHIN_ORG_TREE: 'WITHIN_ORG_TREE',
  WITHIN_BOARDS: 'WITHIN_BOARDS',
} as const;

export type ReportVisibility =
  (typeof ReportVisibility)[keyof typeof ReportVisibility];

export const ALL_REPORT_VISIBILITIES: readonly ReportVisibility[] = [
  ReportVisibility.PUBLIC_ANON,
  ReportVisibility.PUBLIC_AUTH,
  ReportVisibility.WITHIN_ORG_ONLY,
  ReportVisibility.WITHIN_ORG_ANCESTORS,
  ReportVisibility.WITHIN_ORG_DESCENDANTS,
  ReportVisibility.WITHIN_ORG_TREE,
  ReportVisibility.WITHIN_BOARDS,
];

export function isPublicVisibility(v: ReportVisibility): boolean {
  return (
    v === ReportVisibility.PUBLIC_ANON || v === ReportVisibility.PUBLIC_AUTH
  );
}

export function isWithinOrgVisibility(v: ReportVisibility): boolean {
  return (
    v === ReportVisibility.WITHIN_ORG_ONLY ||
    v === ReportVisibility.WITHIN_ORG_ANCESTORS ||
    v === ReportVisibility.WITHIN_ORG_DESCENDANTS ||
    v === ReportVisibility.WITHIN_ORG_TREE
  );
}

export function isHierarchyVisibility(v: ReportVisibility): boolean {
  return (
    v === ReportVisibility.WITHIN_ORG_ANCESTORS ||
    v === ReportVisibility.WITHIN_ORG_DESCENDANTS ||
    v === ReportVisibility.WITHIN_ORG_TREE
  );
}
