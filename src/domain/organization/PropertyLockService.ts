// Pure service: given snapshot facts for an org, decide whether a property is "locked"
// (its ownership data was frozen into at least one poll snapshot).
//
// The PropertyLockRepository (infrastructure) is responsible for producing these facts
// from (polls ⨝ poll_properties ⨝ poll_eligible_members). This service decides the
// lock logic from the facts alone — no DB coupling.
//
// Spec: readmes/2026-04-19-property-admin-design.md — "Property lock" section.

import { z } from 'zod';
import { PropertyId } from '../shared/EntityIds';

export const LockSnapshotFact = z
  .object({
    // Empty = the poll's scope was "all properties".
    explicitScopePropertyIds: z.array(PropertyId).readonly(),
    // Closed snapshot vocabulary decoded by the adapter from poll storage.
    distributionType: z.enum([
      'EQUAL',
      'OWNERSHIP_UNIT_COUNT',
      'OWNERSHIP_SIZE_WEIGHTED',
    ]),
  })
  .readonly();
export type LockSnapshotFact = z.infer<typeof LockSnapshotFact>;

export class PropertyLockService {
  isLocked(
    propertyId: PropertyId,
    facts: readonly LockSnapshotFact[]
  ): boolean {
    for (const f of facts) {
      if (this.factLocksProperty(propertyId, f)) {
        return true;
      }
    }

    return false;
  }

  private factLocksProperty(
    propertyId: PropertyId,
    fact: LockSnapshotFact
  ): boolean {
    const explicitMatch = fact.explicitScopePropertyIds.includes(propertyId);
    const isEqual = fact.distributionType === 'EQUAL';

    // Ownership poll + explicit scope includes property → locked
    if (!isEqual && explicitMatch) {
      return true;
    }

    // Ownership poll + empty scope (all properties) → locked
    if (!isEqual && fact.explicitScopePropertyIds.length === 0) {
      return true;
    }

    // EQUAL poll + explicit scope includes property → locked (ownership used as eligibility filter)
    if (isEqual && explicitMatch) {
      return true;
    }

    // EQUAL poll + empty scope → ownership never consulted → NOT locked
    return false;
  }
}
