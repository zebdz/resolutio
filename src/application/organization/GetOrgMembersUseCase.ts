import { PrismaClient } from '@/generated/prisma/client';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';

export interface OrgMember {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  nickname: string;
  joinedAt: Date | null;
}

export interface GetOrgMembersInput {
  organizationId: string;
  actorUserId: string;
  page: number;
  pageSize: number;
  query?: string;
}

export interface GetOrgMembersDependencies {
  prisma: PrismaClient;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class GetOrgMembersUseCase {
  constructor(private deps: GetOrgMembersDependencies) {}

  async execute(
    input: GetOrgMembersInput
  ): Promise<Result<{ members: OrgMember[]; totalCount: number }, string>> {
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
      status: 'accepted' as const,
      ...userFilter,
    };

    const [rows, totalCount] = await Promise.all([
      this.deps.prisma.organizationUser.findMany({
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
        orderBy: { acceptedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.deps.prisma.organizationUser.count({
        where: whereClause,
      }),
    ]);

    const members: OrgMember[] = rows.map((row) => ({
      id: row.user.id,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      middleName: row.user.middleName,
      nickname: row.user.nickname,
      joinedAt: row.acceptedAt,
    }));

    return success({ members, totalCount });
  }
}
