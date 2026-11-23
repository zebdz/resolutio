/** Board aggregate owns its validated identity, name and lifecycle timestamps.
 * Creation/archive receive explicit inputs; persistence DTOs are decoded and copied. */
import { Result, success, failure } from '../shared/Result';
import { BoardDomainCodes, BoardDomainCode } from './BoardDomainCodes';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { BoardId, OrganizationId } from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import { EntityCreation } from '../shared/EntityCreation';
import { BoardName, parseBoardName } from './BoardName';

export { BOARD_NAME_MAX_LENGTH } from './BoardName';
export type BoardFailure =
  | BoardDomainCode
  | typeof SharedDomainCodes.CONTAINS_PROFANITY;

export interface BoardProps {
  readonly id: BoardId;
  readonly name: BoardName;
  readonly organizationId: OrganizationId;
  readonly createdAt: Instant;
  archivedAt: Instant | null;
}

/** Raw persistence/serialization boundary; decoded before becoming aggregate state. */
export interface BoardData {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  archivedAt: Date | null;
}

export class Board {
  private constructor(private readonly props: BoardProps) {}

  public static create(
    name: BoardName,
    organizationId: OrganizationId,
    creation: EntityCreation<BoardId>,
    profanityChecker?: ProfanityChecker
  ): Result<Board, BoardFailure> {
    // Validate name
    const parsedName = parseBoardName(name);

    if (!parsedName.success) {
      return parsedName;
    }

    const normalizedName = parsedName.value;

    if (profanityChecker?.containsProfanity(normalizedName)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    const id = BoardId.safeParse(creation?.id);
    const organization = OrganizationId.safeParse(organizationId);
    const now = Instant.safeParse(creation?.now);

    if (!id.success || !organization.success || !now.success) {
      return failure(BoardDomainCodes.BOARD_INVALID_DATA);
    }

    return success(
      new Board({
        id: id.data,
        name: normalizedName,
        organizationId: organization.data,
        createdAt: now.data,
        archivedAt: null,
      })
    );
  }

  public static reconstitute(data: BoardData): Board {
    try {
      return new Board({
        id: BoardId.parse(data.id),
        name: BoardName.parse(data.name),
        organizationId: OrganizationId.parse(data.organizationId),
        createdAt: Instant.fromDate(data.createdAt),
        archivedAt:
          data.archivedAt === null ? null : Instant.fromDate(data.archivedAt),
      });
    } catch {
      throw new Error(BoardDomainCodes.BOARD_INVALID_DATA);
    }
  }

  // Getters
  public get id(): BoardId {
    return this.props.id;
  }

  public get name(): BoardName {
    return this.props.name;
  }

  public get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  public get createdAt(): Instant {
    return this.props.createdAt;
  }

  public get archivedAt(): Instant | null {
    return this.props.archivedAt;
  }

  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  public archive(at: Instant): Result<void, BoardDomainCode> {
    if (this.isArchived()) {
      return failure(BoardDomainCodes.BOARD_ALREADY_ARCHIVED);
    }

    const validated = Instant.safeParse(at);

    if (!validated.success) {
      return failure(BoardDomainCodes.BOARD_INVALID_DATA);
    }

    this.props.archivedAt = validated.data;

    return success(undefined);
  }

  public toJSON(): BoardData {
    return {
      id: this.id,
      name: this.name,
      organizationId: this.organizationId,
      createdAt: Instant.toDate(this.createdAt),
      archivedAt:
        this.archivedAt === null ? null : Instant.toDate(this.archivedAt),
    };
  }
}
