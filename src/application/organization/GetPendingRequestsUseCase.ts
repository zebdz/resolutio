import { PrismaClient } from '@/generated/prisma/client';
import { Result, success } from '../../domain/shared/Result';

export interface PendingRequest {
  organizationId: string;
  organizationName: string;
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  requestedAt: Date;
}

export interface GetPendingRequestsResult {
  requests: PendingRequest[];
  totalCount: number;
}

export interface GetPendingRequestsPagination {
  page: number;
  pageSize: number;
}

export interface GetPendingRequestsDependencies {
  prisma: PrismaClient;
}

export class GetPendingRequestsUseCase {
  constructor(private deps: GetPendingRequestsDependencies) {}

  async execute(
    adminId: string,
    pagination?: GetPendingRequestsPagination
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
      return success({ requests: [], totalCount: 0 });
    }

    const organizationIds = adminRoles.map((role) => role.organizationId);

    const whereClause = {
      organizationId: {
        in: organizationIds,
      },
      status: 'pending' as const,
    };

    // 2. Get total count
    const totalCount = await this.deps.prisma.organizationUser.count({
      where: whereClause,
    });

    // 3. Get pending requests with optional pagination
    const findManyArgs: any = {
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
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
    };

    if (pagination && pagination.page > 0 && pagination.pageSize > 0) {
      findManyArgs.skip = (pagination.page - 1) * pagination.pageSize;
      findManyArgs.take = pagination.pageSize;
    }

    const pendingRequests =
      await this.deps.prisma.organizationUser.findMany(findManyArgs);

    // 4. Map to result format
    const requests: PendingRequest[] = pendingRequests.map((req: any) => ({
      organizationId: req.organizationId,
      organizationName: req.organization.name,
      requester: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        middleName: req.user.middleName,
      },
      requestedAt: req.createdAt,
    }));

    return success({ requests, totalCount });
  }
}
