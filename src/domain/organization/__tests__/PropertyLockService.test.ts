import { describe, it, expect } from 'vitest';
import { PropertyLockService, LockSnapshotFact } from '../PropertyLockService';

// Snapshot fact = one row that would justify locking:
//   explicitScopePropertyIds: which properties the poll scoped (empty = all-scope)
//   distributionType: 'EQUAL' or ownership mode
// A fact is relevant for property P iff the poll's snapshot would use P's ownership data.

describe('PropertyLockService', () => {
  const svc = new PropertyLockService();

  it('returns false when no snapshot facts involve the property', () => {
    const facts: LockSnapshotFact[] = [];
    expect(svc.isLocked('prop-a', facts)).toBe(false);
  });

  it('locks when a poll with explicit scope on property has snapshots (ownership mode)', () => {
    const facts: LockSnapshotFact[] = [
      {
        explicitScopePropertyIds: ['prop-a'],
        distributionType: 'OWNERSHIP_SIZE_WEIGHTED',
      },
    ];
    expect(svc.isLocked('prop-a', facts)).toBe(true);
    expect(svc.isLocked('prop-b', facts)).toBe(false);
  });

  it('locks every property when ownership poll has empty scope (all properties)', () => {
    const facts: LockSnapshotFact[] = [
      {
        explicitScopePropertyIds: [],
        distributionType: 'OWNERSHIP_UNIT_COUNT',
      },
    ];
    expect(svc.isLocked('prop-a', facts)).toBe(true);
    expect(svc.isLocked('prop-zzz', facts)).toBe(true);
  });

  it('locks property when EQUAL poll with explicit scope includes it', () => {
    const facts: LockSnapshotFact[] = [
      {
        explicitScopePropertyIds: ['prop-a'],
        distributionType: 'EQUAL',
      },
    ];
    expect(svc.isLocked('prop-a', facts)).toBe(true);
  });

  it('does NOT lock properties when an EQUAL poll has empty scope', () => {
    const facts: LockSnapshotFact[] = [
      {
        explicitScopePropertyIds: [],
        distributionType: 'EQUAL',
      },
    ];
    expect(svc.isLocked('prop-a', facts)).toBe(false);
  });

  it('combines multiple facts (any matching fact locks)', () => {
    const facts: LockSnapshotFact[] = [
      {
        explicitScopePropertyIds: [],
        distributionType: 'EQUAL',
      },
      {
        explicitScopePropertyIds: ['prop-a'],
        distributionType: 'OWNERSHIP_SIZE_WEIGHTED',
      },
    ];
    expect(svc.isLocked('prop-a', facts)).toBe(true);
    expect(svc.isLocked('prop-b', facts)).toBe(false);
  });
});
