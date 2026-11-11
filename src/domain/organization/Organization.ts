/** Organization aggregate with explicit hierarchy placement and caller-provided
 * creation inputs. Persistence DTOs are validated, and Date projections are detached. */
import { Result, success, failure } from '../shared/Result';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import {
  SharedDomainCode,
  SharedDomainCodes,
} from '../shared/SharedDomainCodes';
import {
  OrganizationDomainCode,
  OrganizationDomainCodes,
} from './OrganizationDomainCodes';
import { OrganizationId, UserId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import {
  NewOrganizationName,
  OrganizationName,
  OrganizationDescription,
  OrganizationPlacement,
  parseOrganizationName,
  parseOrganizationDescription,
} from './OrganizationValues';
export {
  ORGANIZATION_NAME_MIN_LENGTH,
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_NAME_PATTERN,
  ORGANIZATION_DESCRIPTION_MAX_LENGTH,
} from './OrganizationValues';

/** Raw persistence/serialization representation. The hierarchy flag is root-only. */
export interface OrganizationProps {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  createdById: string;
  createdAt: Date;
  archivedAt: Date | null;
  allowMultiTreeMembership: boolean | null;
}
interface OrganizationState {
  readonly id: OrganizationId;
  name: OrganizationName;
  description: OrganizationDescription;
  readonly placement: OrganizationPlacement;
  readonly createdById: UserId;
  readonly createdAt: Instant;
  archivedAt: Instant | null;
}
type OrganizationFailure = OrganizationDomainCode | SharedDomainCode;

export class Organization {
  private constructor(private props: OrganizationState) {}

  public static create(
    name: NewOrganizationName,
    description: OrganizationDescription,
    createdById: UserId,
    placement: OrganizationPlacement,
    creation: EntityCreation<OrganizationId>,
    profanityChecker?: ProfanityChecker
  ): Result<Organization, OrganizationFailure> {
    // Validate name and description before applying the external profanity facts.
    const parsedName = parseOrganizationName(name);

    if (!parsedName.success) {
      return parsedName;
    }

    const parsedDescription = parseOrganizationDescription(description);

    if (!parsedDescription.success) {
      return parsedDescription;
    }

    if (
      profanityChecker?.containsProfanity(parsedName.value) ||
      profanityChecker?.containsProfanity(parsedDescription.value)
    ) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    return success(
      new Organization({
        id: OrganizationId.parse(creation.id),
        name: parsedName.value,
        description: parsedDescription.value,
        createdById: UserId.parse(createdById),
        placement: OrganizationPlacement.parse(placement),
        createdAt: Instant.parse(creation.now),
        archivedAt: null,
      })
    );
  }

  public static reconstitute(props: OrganizationProps): Organization {
    return new Organization({
      id: OrganizationId.parse(props.id),
      name: OrganizationName.parse(props.name),
      description: OrganizationDescription.parse(props.description),
      // Legacy roots with NULL retain the established false fallback. Child flags
      // are inherited from the root and are ignored, matching creation behavior.
      placement: OrganizationPlacement.parse(
        props.parentId === null
          ? {
              kind: 'root',
              allowMultiTreeMembership: props.allowMultiTreeMembership ?? false,
            }
          : { kind: 'child', parentId: props.parentId }
      ),
      createdById: UserId.parse(props.createdById),
      createdAt: Instant.fromDate(props.createdAt),
      archivedAt:
        props.archivedAt === null ? null : Instant.fromDate(props.archivedAt),
    });
  }

  // Getters expose validated values; mutable Date objects are detached projections.
  public get id(): OrganizationId {
    return this.props.id;
  }
  public get name(): OrganizationName {
    return this.props.name;
  }
  public get description(): OrganizationDescription {
    return this.props.description;
  }
  public get placement(): OrganizationPlacement {
    return this.props.placement;
  }
  public get parentId(): OrganizationId | null {
    return this.props.placement.kind === 'child'
      ? this.props.placement.parentId
      : null;
  }
  public get createdById(): UserId {
    return this.props.createdById;
  }
  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }
  public get archivedAt(): Date | null {
    return this.props.archivedAt === null
      ? null
      : Instant.toDate(this.props.archivedAt);
  }
  public get allowMultiTreeMembership(): boolean | null {
    return this.props.placement.kind === 'root'
      ? this.props.placement.allowMultiTreeMembership
      : null;
  }
  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  public archive(at: Instant): Result<void, OrganizationDomainCode> {
    if (this.isArchived()) {
      return failure(OrganizationDomainCodes.ORGANIZATION_ALREADY_ARCHIVED);
    }

    this.props.archivedAt = Instant.parse(at);

    return success(undefined);
  }
  public unarchive(): Result<void, OrganizationDomainCode> {
    if (!this.isArchived()) {
      return failure(OrganizationDomainCodes.ORGANIZATION_NOT_ARCHIVED);
    }

    this.props.archivedAt = null;

    return success(undefined);
  }
  public updateName(
    name: NewOrganizationName,
    profanityChecker?: ProfanityChecker
  ): Result<void, OrganizationFailure> {
    const parsed = parseOrganizationName(name);

    if (!parsed.success) {
      return parsed;
    }

    if (profanityChecker?.containsProfanity(parsed.value)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.name = parsed.value;

    return success(undefined);
  }
  public updateDescription(
    description: OrganizationDescription,
    profanityChecker?: ProfanityChecker
  ): Result<void, OrganizationFailure> {
    const parsed = parseOrganizationDescription(description);

    if (!parsed.success) {
      return parsed;
    }

    if (profanityChecker?.containsProfanity(parsed.value)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.description = parsed.value;

    return success(undefined);
  }
  public toJSON(): OrganizationProps {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      parentId: this.parentId,
      createdById: this.createdById,
      createdAt: this.createdAt,
      archivedAt: this.archivedAt,
      allowMultiTreeMembership: this.allowMultiTreeMembership,
    };
  }
}
