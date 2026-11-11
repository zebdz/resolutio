/** Parent-link request aggregate uses an explicit decision state and caller-provided
 * IDs/time. Persistence metadata is validated, and Date projections are detached. */
import { Result, success, failure } from '../shared/Result';
import {
  JoinParentRequestDomainCode,
  JoinParentRequestDomainCodes,
} from './JoinParentRequestDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import {
  SharedDomainCode,
  SharedDomainCodes,
} from '../shared/SharedDomainCodes';
import {
  OrganizationId,
  UserId,
  JoinParentRequestId,
} from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import {
  JoinParentRequestMessage,
  JoinParentRejectionReason,
  JoinParentDecision,
  parseJoinParentMessage,
  parseJoinParentRejectionReason,
} from './JoinParentRequestValues';
export {
  JOIN_PARENT_REQUEST_MESSAGE_MAX_LENGTH,
  REJECTION_REASON_MAX_LENGTH,
} from './JoinParentRequestValues';

/** Plain serialization representation retains the existing API field names. */
export interface JoinParentRequestProps {
  id: string;
  childOrgId: string;
  parentOrgId: string;
  requestingAdminId: string;
  handlingAdminId: string | null;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  rejectionReason: string | null;
  createdAt: Date;
  handledAt: Date | null;
}

export type RawJoinParentRequestProps = Omit<
  JoinParentRequestProps,
  'status'
> & { status: string };
export interface CreateJoinParentRequestProps {
  readonly childOrgId: OrganizationId;
  readonly parentOrgId: OrganizationId;
  readonly requestingAdminId: UserId;
  readonly message: JoinParentRequestMessage;
}
interface JoinParentRequestState extends CreateJoinParentRequestProps {
  readonly id: JoinParentRequestId;
  readonly createdAt: Instant;
  decision: JoinParentDecision;
}
type JoinParentRequestFailure = JoinParentRequestDomainCode | SharedDomainCode;
export class JoinParentRequest {
  private constructor(private props: JoinParentRequestState) {}
  public static create(
    props: CreateJoinParentRequestProps,
    creation: EntityCreation<JoinParentRequestId>,
    profanityChecker?: ProfanityChecker
  ): Result<JoinParentRequest, JoinParentRequestFailure> {
    const message = parseJoinParentMessage(props.message);

    if (!message.success) {
      return message;
    }

    if (profanityChecker?.containsProfanity(message.value)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    return success(
      new JoinParentRequest({
        id: JoinParentRequestId.parse(creation.id),
        childOrgId: OrganizationId.parse(props.childOrgId),
        parentOrgId: OrganizationId.parse(props.parentOrgId),
        requestingAdminId: UserId.parse(props.requestingAdminId),
        message: message.value,
        createdAt: Instant.parse(creation.now),
        decision: JoinParentDecision.parse({
          status: 'pending',
          handlingAdminId: null,
          handledAt: null,
          rejectionReason: null,
        }),
      })
    );
  }
  public static reconstitute(
    props: RawJoinParentRequestProps
  ): JoinParentRequest {
    return new JoinParentRequest({
      id: JoinParentRequestId.parse(props.id),
      childOrgId: OrganizationId.parse(props.childOrgId),
      parentOrgId: OrganizationId.parse(props.parentOrgId),
      requestingAdminId: UserId.parse(props.requestingAdminId),
      message: JoinParentRequestMessage.parse(props.message),
      createdAt: Instant.fromDate(props.createdAt),
      decision: JoinParentDecision.parse({
        status: props.status,
        handlingAdminId: props.handlingAdminId,
        handledAt:
          props.handledAt === null ? null : Instant.fromDate(props.handledAt),
        rejectionReason: props.rejectionReason,
      }),
    });
  }
  public get id(): JoinParentRequestId {
    return this.props.id;
  }
  public get childOrgId(): OrganizationId {
    return this.props.childOrgId;
  }
  public get parentOrgId(): OrganizationId {
    return this.props.parentOrgId;
  }
  public get requestingAdminId(): UserId {
    return this.props.requestingAdminId;
  }
  public get handlingAdminId(): UserId | null {
    return this.props.decision.handlingAdminId;
  }
  public get message(): JoinParentRequestMessage {
    return this.props.message;
  }
  public get status(): JoinParentDecision['status'] {
    return this.props.decision.status;
  }
  public get decision(): JoinParentDecision {
    return this.props.decision;
  }
  public get rejectionReason(): JoinParentRejectionReason | null {
    return this.props.decision.rejectionReason;
  }
  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }
  public get handledAt(): Date | null {
    return this.props.decision.handledAt === null
      ? null
      : Instant.toDate(this.props.decision.handledAt);
  }
  public isPending(): boolean {
    return this.status === 'pending';
  }
  public accept(
    adminId: UserId,
    at: Instant
  ): Result<void, JoinParentRequestDomainCode> {
    if (!this.isPending()) {
      return failure(JoinParentRequestDomainCodes.NOT_PENDING);
    }

    this.props.decision = JoinParentDecision.parse({
      status: 'accepted',
      handlingAdminId: adminId,
      handledAt: at,
      rejectionReason: null,
    });

    return success(undefined);
  }
  public reject(
    adminId: UserId,
    reason: JoinParentRejectionReason,
    at: Instant,
    profanityChecker?: ProfanityChecker
  ): Result<void, JoinParentRequestFailure> {
    if (!this.isPending()) {
      return failure(JoinParentRequestDomainCodes.NOT_PENDING);
    }

    const parsed = parseJoinParentRejectionReason(reason);

    if (!parsed.success) {
      return parsed;
    }

    if (profanityChecker?.containsProfanity(parsed.value)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.decision = JoinParentDecision.parse({
      status: 'rejected',
      handlingAdminId: adminId,
      handledAt: at,
      rejectionReason: parsed.value,
    });

    return success(undefined);
  }
  public toJSON(): JoinParentRequestProps {
    return {
      id: this.id,
      childOrgId: this.childOrgId,
      parentOrgId: this.parentOrgId,
      requestingAdminId: this.requestingAdminId,
      handlingAdminId: this.handlingAdminId,
      message: this.message,
      status: this.status,
      rejectionReason: this.rejectionReason,
      createdAt: this.createdAt,
      handledAt: this.handledAt,
    };
  }
}
