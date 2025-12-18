import { PrismaClient } from '@/generated/prisma/client';
import { Result, success } from '../../domain/shared/Result';

export interface PendingRequest {
  organizationId: string;
  organizationName: string;
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  };
  requestedAt: Date;
}

export interface GetPendingRequestsResult {
  requests: PendingRequest[];
}

export interface GetPendingRequestsDependencies {
  prisma: PrismaClient;
}

export class GetPendingRequestsUseCase {
  constructor(private deps: GetPendingRequestsDependencies) {}

  async execute(
    adminId: string
  ): Promise<Result<GetPendingRequestsResult, string>> {
    // 1. Get all organizations where user is admin
    const adminRoles = await this.deps.prisma.organizationAdminUser.findMany({
      where: {
        userId: adminId,
      },
      include: {
        organization: true,
      },
    });

    if (adminRoles.length === 0) {
      return success({ requests: [] });
    }

    const organizationIds = adminRoles.map((role) => role.organizationId);

    // 2. Get all pending requests for those organizations
    const pendingRequests = await this.deps.prisma.organizationUser.findMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 3. Map to result format
    const requests: PendingRequest[] = pendingRequests.map((req) => ({
      organizationId: req.organizationId,
      organizationName: req.organization.name,
      requester: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        phoneNumber: req.user.phoneNumber,
      },
      requestedAt: req.createdAt,
    }));

    return success({ requests });
  }
}
