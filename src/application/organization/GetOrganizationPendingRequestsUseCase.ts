import { Result, success, failure } from '../../domain/shared/Result';
import { UserRepository } from '../../domain/user/UserRepository';
import { OrganizationErrors } from './OrganizationErrors';

export interface GetOrganizationPendingRequestsInput {
  organizationId: string;
  adminUserId: string;
}

export interface PendingRequest {
  userId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phoneNumber: string;
  requestedAt: Date;
}

export interface GetOrganizationPendingRequestsResult {
  requests: PendingRequest[];
}

export interface GetOrganizationPendingRequestsDependencies {
  prisma: any; // PrismaClient
  userRepository: UserRepository;
}

export class GetOrganizationPendingRequestsUseCase {
  constructor(private deps: GetOrganizationPendingRequestsDependencies) {}

  async execute(
    input: GetOrganizationPendingRequestsInput
  ): Promise<Result<GetOrganizationPendingRequestsResult, string>> {
    const { organizationId, adminUserId } = input;

    // Check if organization exists
    const organization = await this.deps.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // Check admin permissions: superadmin or org admin
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(adminUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.prisma.organizationAdminUser.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: adminUserId,
          },
        },
      });

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // Get pending requests for this organization
    const pendingRequests = await this.deps.prisma.organizationUser.findMany({
      where: {
        organizationId,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const requests: PendingRequest[] = pendingRequests.map((req: any) => ({
      userId: req.user.id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      middleName: req.user.middleName || undefined,
      phoneNumber: req.user.phoneNumber,
      requestedAt: req.createdAt,
    }));

    return success({ requests });
  }
}
