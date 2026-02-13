import { Result, success, failure } from '../shared/Result';
import { JoinParentRequestDomainCodes } from './JoinParentRequestDomainCodes';

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

export class JoinParentRequest {
  private constructor(private props: JoinParentRequestProps) {}

  public static create(
    childOrgId: string,
    parentOrgId: string,
    requestingAdminId: string,
    message: string
  ): Result<JoinParentRequest, string> {
    if (!message || message.trim().length === 0) {
      return failure(JoinParentRequestDomainCodes.MESSAGE_EMPTY);
    }

    if (message.length > 2000) {
      return failure(JoinParentRequestDomainCodes.MESSAGE_TOO_LONG);
    }

    const request = new JoinParentRequest({
      id: '',
      childOrgId,
      parentOrgId,
      requestingAdminId,
      handlingAdminId: null,
      message: message.trim(),
      status: 'pending',
      rejectionReason: null,
      createdAt: new Date(),
      handledAt: null,
    });

    return success(request);
  }

  public static reconstitute(props: JoinParentRequestProps): JoinParentRequest {
    return new JoinParentRequest(props);
  }

  public get id(): string {
    return this.props.id;
  }

  public get childOrgId(): string {
    return this.props.childOrgId;
  }

  public get parentOrgId(): string {
    return this.props.parentOrgId;
  }

  public get requestingAdminId(): string {
    return this.props.requestingAdminId;
  }

  public get handlingAdminId(): string | null {
    return this.props.handlingAdminId;
  }

  public get message(): string {
    return this.props.message;
  }

  public get status(): 'pending' | 'accepted' | 'rejected' {
    return this.props.status;
  }

  public get rejectionReason(): string | null {
    return this.props.rejectionReason;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get handledAt(): Date | null {
    return this.props.handledAt;
  }

  public isPending(): boolean {
    return this.props.status === 'pending';
  }

  public accept(adminId: string): Result<void, string> {
    if (!this.isPending()) {
      return failure(JoinParentRequestDomainCodes.NOT_PENDING);
    }

    this.props.status = 'accepted';
    this.props.handlingAdminId = adminId;
    this.props.handledAt = new Date();

    return success(undefined);
  }

  public reject(adminId: string, reason: string): Result<void, string> {
    if (!this.isPending()) {
      return failure(JoinParentRequestDomainCodes.NOT_PENDING);
    }

    if (!reason || reason.trim().length === 0) {
      return failure(JoinParentRequestDomainCodes.REJECTION_REASON_REQUIRED);
    }

    this.props.status = 'rejected';
    this.props.handlingAdminId = adminId;
    this.props.rejectionReason = reason.trim();
    this.props.handledAt = new Date();

    return success(undefined);
  }

  public toJSON(): JoinParentRequestProps {
    return {
      ...this.props,
    };
  }
}
