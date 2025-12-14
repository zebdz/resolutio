import { PrismaClient } from '@prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { HandleJoinRequestInput } from './HandleJoinRequestSchema';
import { OrganizationErrors } from './OrganizationErrors';
import { BoardRepository } from '../../domain/board/BoardRepository';

export interface HandleJoinRequestDependencies {
  prisma: PrismaClient;
  boardRepository: BoardRepository;
}

export class HandleJoinRequestUseCase {
  constructor(private deps: HandleJoinRequestDependencies) {}

  async execute(input: HandleJoinRequestInput): Promise<Result<void, string>> {
    const { organizationId, requesterId, adminId, action, rejectionReason } =
      input;

    // 1. Check if the admin is actually an admin of the organization
    const adminRole = await this.deps.prisma.organizationAdminUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: adminId,
        },
      },
    });

    if (!adminRole) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    // 2. Find the join request
    const request = await this.deps.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: requesterId,
        },
      },
    });

    if (!request) {
      return failure(OrganizationErrors.REQUEST_NOT_FOUND);
    }

    // 3. Check if request is pending
    if (request.status !== 'pending') {
      return failure(OrganizationErrors.NOT_PENDING);
    }

    // 4. Update the request based on action
    const now = new Date();

    if (action === 'accept') {
      await this.deps.prisma.organizationUser.update({
        where: {
          organizationId_userId: {
            organizationId,
            userId: requesterId,
          },
        },
        data: {
          status: 'accepted',
          acceptedAt: now,
          acceptedByUserId: adminId,
        },
      });

      // Add user to the general board
      const generalBoard =
        await this.deps.boardRepository.findGeneralBoardByOrganizationId(
          organizationId
        );

      if (generalBoard) {
        await this.deps.boardRepository.addUserToBoard(
          requesterId,
          generalBoard.id
        );
      }
    } else {
      await this.deps.prisma.organizationUser.update({
        where: {
          organizationId_userId: {
            organizationId,
            userId: requesterId,
          },
        },
        data: {
          status: 'rejected',
          rejectedAt: now,
          rejectedByUserId: adminId,
          rejectionReason: rejectionReason || null,
        },
      });
    }

    return success(undefined);
  }
}
