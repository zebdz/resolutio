import { PrismaClient } from '@/generated/prisma/client';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';

export interface OrgAdmin {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  nickname: string;
  createdAt: Date;
}

export interface GetOrgAdminsPaginatedInput {
  organizationId: string;
  actorUserId: string;
  page: number;
  pageSize: number;
  query?: string;
}

export interface GetOrgAdminsPaginatedDependencies {
  prisma: PrismaClient;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class GetOrgAdminsPaginatedUseCase {
  constructor(private deps: GetOrgAdminsPaginatedDependencies) {}

  async execute(
    input: GetOrgAdminsPaginatedInput
  ): Promise<Result<{ admins: OrgAdmin[]; totalCount: number }, string>> {
    const { organizationId, actorUserId, page, pageSize, query } = input;

    // Check org exists
    const organization =
      await this.deps.organizationRepository.findById(organizationId);

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // Check authorization: org member, admin, or superadmin
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(actorUserId);

    if (!isSuperAdmin) {
      const isMember = await this.deps.organizationRepository.isUserMember(
        actorUserId,
        organizationId
      );
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        actorUserId,
        organizationId
      );

      if (!isMember && !isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    const skip = (page - 1) * pageSize;

    const userFilter = query
      ? {
          user: {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' as const } },
              { lastName: { contains: query, mode: 'insensitive' as const } },
              { middleName: { contains: query, mode: 'insensitive' as const } },
              { nickname: { contains: query, mode: 'insensitive' as const } },
            ],
          },
        }
      : {};

    const whereClause = {
      organizationId,
      ...userFilter,
    };

    const [rows, totalCount] = await Promise.all([
      this.deps.prisma.organizationAdminUser.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              nickname: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.deps.prisma.organizationAdminUser.count({
        where: whereClause,
      }),
    ]);

    const admins: OrgAdmin[] = rows.map((row) => ({
      id: row.user.id,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      middleName: row.user.middleName,
      nickname: row.user.nickname,
      createdAt: row.createdAt,
    }));

    return success({ admins, totalCount });
  }
}
