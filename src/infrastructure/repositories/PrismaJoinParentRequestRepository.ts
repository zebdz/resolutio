import { PrismaClient } from '@/generated/prisma/client';
import {
  JoinParentRequest,
  JoinParentRequestProps,
} from '../../domain/organization/JoinParentRequest';
import { JoinParentRequestRepository } from '../../domain/organization/JoinParentRequestRepository';

export class PrismaJoinParentRequestRepository implements JoinParentRequestRepository {
  constructor(private prisma: PrismaClient) {}

  async save(request: JoinParentRequest): Promise<JoinParentRequest> {
    const data = request.toJSON();

    const created = await this.prisma.organizationJoinParentRequest.create({
      data: {
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

  async findById(id: string): Promise<JoinParentRequest | null> {
    const record = await this.prisma.organizationJoinParentRequest.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return JoinParentRequest.reconstitute(this.toProps(record));
  }

  async findPendingByChildOrgId(
    childOrgId: string
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
    parentOrgId: string
  ): Promise<JoinParentRequest[]> {
    const records = await this.prisma.organizationJoinParentRequest.findMany({
      where: { parentOrgId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => JoinParentRequest.reconstitute(this.toProps(r)));
  }

  async findAllByChildOrgId(childOrgId: string): Promise<JoinParentRequest[]> {
    const records = await this.prisma.organizationJoinParentRequest.findMany({
      where: { childOrgId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => JoinParentRequest.reconstitute(this.toProps(r)));
  }

  async findAllByParentOrgId(
    parentOrgId: string
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

  async delete(id: string): Promise<void> {
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
  }): JoinParentRequestProps {
    return {
      id: record.id,
      childOrgId: record.childOrgId,
      parentOrgId: record.parentOrgId,
      requestingAdminId: record.requestingAdminId,
      handlingAdminId: record.handlingAdminId,
      message: record.message,
      status: record.status as 'pending' | 'accepted' | 'rejected',
      rejectionReason: record.rejectionReason,
      createdAt: record.createdAt,
      handledAt: record.handledAt,
    };
  }
}
