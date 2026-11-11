/** Prisma parent-request adapter preserves domain identity and decodes raw
 * status/decision columns through validated aggregate rehydration. */
import {
  JoinParentRequestId,
  OrganizationId,
} from '../../domain/shared/EntityIds';
import { PrismaClient } from '@/generated/prisma/client';
import {
  JoinParentRequest,
  RawJoinParentRequestProps,
} from '../../domain/organization/JoinParentRequest';
import { JoinParentRequestRepository } from '../../domain/organization/JoinParentRequestRepository';

export class PrismaJoinParentRequestRepository implements JoinParentRequestRepository {
  constructor(private prisma: PrismaClient) {}

  async save(request: JoinParentRequest): Promise<JoinParentRequest> {
    const data = request.toJSON();

    const created = await this.prisma.organizationJoinParentRequest.create({
      data: {
        id: data.id,
        childOrgId: data.childOrgId,
        parentOrgId: data.parentOrgId,
        requestingAdminId: data.requestingAdminId,
        handlingAdminId: data.handlingAdminId,
        message: data.message,
        status: data.status,
        rejectionReason: data.rejectionReason,
        createdAt: data.createdAt,
        handledAt: data.handledAt,
      },
    });

    return JoinParentRequest.reconstitute(this.toProps(created));
  }

  async findById(id: JoinParentRequestId): Promise<JoinParentRequest | null> {
    const record = await this.prisma.organizationJoinParentRequest.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return JoinParentRequest.reconstitute(this.toProps(record));
  }

  async findPendingByChildOrgId(
    childOrgId: OrganizationId
  ): Promise<JoinParentRequest | null> {
    const record = await this.prisma.organizationJoinParentRequest.findFirst({
      where: { childOrgId, status: 'pending' },
    });

    if (!record) {
      return null;
    }

    return JoinParentRequest.reconstitute(this.toProps(record));
  }

  async findPendingByParentOrgId(
    parentOrgId: OrganizationId
  ): Promise<JoinParentRequest[]> {
    const records = await this.prisma.organizationJoinParentRequest.findMany({
      where: { parentOrgId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => JoinParentRequest.reconstitute(this.toProps(r)));
  }

  async findAllByChildOrgId(
    childOrgId: OrganizationId
  ): Promise<JoinParentRequest[]> {
    const records = await this.prisma.organizationJoinParentRequest.findMany({
      where: { childOrgId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => JoinParentRequest.reconstitute(this.toProps(r)));
  }

  async findAllByParentOrgId(
    parentOrgId: OrganizationId
  ): Promise<JoinParentRequest[]> {
    const records = await this.prisma.organizationJoinParentRequest.findMany({
      where: { parentOrgId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => JoinParentRequest.reconstitute(this.toProps(r)));
  }

  async update(request: JoinParentRequest): Promise<JoinParentRequest> {
    const data = request.toJSON();

    const updated = await this.prisma.organizationJoinParentRequest.update({
      where: { id: data.id },
      data: {
        handlingAdminId: data.handlingAdminId,
        status: data.status,
        rejectionReason: data.rejectionReason,
        handledAt: data.handledAt,
      },
    });

    return JoinParentRequest.reconstitute(this.toProps(updated));
  }

  async delete(id: JoinParentRequestId): Promise<void> {
    await this.prisma.organizationJoinParentRequest.delete({
      where: { id },
    });
  }

  private toProps(record: {
    id: string;
    childOrgId: string;
    parentOrgId: string;
    requestingAdminId: string;
    handlingAdminId: string | null;
    message: string;
    status: string;
    rejectionReason: string | null;
    createdAt: Date;
    handledAt: Date | null;
  }): RawJoinParentRequestProps {
    return {
      id: record.id,
      childOrgId: record.childOrgId,
      parentOrgId: record.parentOrgId,
      requestingAdminId: record.requestingAdminId,
      handlingAdminId: record.handlingAdminId,
      message: record.message,
      status: record.status,
      rejectionReason: record.rejectionReason,
      createdAt: record.createdAt,
      handledAt: record.handledAt,
    };
  }
}
