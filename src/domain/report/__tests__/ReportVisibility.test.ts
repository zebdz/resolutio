import { describe, it, expect } from 'vitest';
import {
  ReportVisibility,
  isPublicVisibility,
  isWithinOrgVisibility,
  isHierarchyVisibility,
} from '../ReportVisibility';

describe('ReportVisibility', () => {
  it('exposes seven values', () => {
    expect(Object.values(ReportVisibility).sort()).toEqual(
      [
        'PUBLIC_ANON',
        'PUBLIC_AUTH',
        'WITHIN_ORG_ONLY',
        'WITHIN_ORG_ANCESTORS',
        'WITHIN_ORG_DESCENDANTS',
        'WITHIN_ORG_TREE',
        'WITHIN_BOARDS',
      ].sort()
    );
  });

  it('classifies public values', () => {
    expect(isPublicVisibility(ReportVisibility.PUBLIC_ANON)).toBe(true);
    expect(isPublicVisibility(ReportVisibility.PUBLIC_AUTH)).toBe(true);
    expect(isPublicVisibility(ReportVisibility.WITHIN_ORG_ONLY)).toBe(false);
    expect(isPublicVisibility(ReportVisibility.WITHIN_BOARDS)).toBe(false);
  });

  it('classifies within-org values', () => {
    expect(isWithinOrgVisibility(ReportVisibility.WITHIN_ORG_ONLY)).toBe(true);
    expect(isWithinOrgVisibility(ReportVisibility.WITHIN_ORG_ANCESTORS)).toBe(
      true
    );
    expect(isWithinOrgVisibility(ReportVisibility.WITHIN_ORG_DESCENDANTS)).toBe(
      true
    );
    expect(isWithinOrgVisibility(ReportVisibility.WITHIN_ORG_TREE)).toBe(true);
    expect(isWithinOrgVisibility(ReportVisibility.PUBLIC_ANON)).toBe(false);
    expect(isWithinOrgVisibility(ReportVisibility.WITHIN_BOARDS)).toBe(false);
  });

  it('classifies hierarchy-expanding values', () => {
    expect(isHierarchyVisibility(ReportVisibility.WITHIN_ORG_ANCESTORS)).toBe(
      true
    );
    expect(isHierarchyVisibility(ReportVisibility.WITHIN_ORG_DESCENDANTS)).toBe(
      true
    );
    expect(isHierarchyVisibility(ReportVisibility.WITHIN_ORG_TREE)).toBe(true);
    expect(isHierarchyVisibility(ReportVisibility.WITHIN_ORG_ONLY)).toBe(false);
    expect(isHierarchyVisibility(ReportVisibility.PUBLIC_ANON)).toBe(false);
  });
});
