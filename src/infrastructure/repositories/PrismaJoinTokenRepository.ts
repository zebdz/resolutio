import { PrismaClient, Prisma } from '@/generated/prisma/client';
import { JoinToken, JoinTokenProps } from '../../domain/organization/JoinToken';
import {
  JoinTokenRepository,
  JoinTokenWithCreator,
  JoinTokenSearchFilters,
} from '../../domain/organization/JoinTokenRepository';

export class PrismaJoinTokenRepository implements JoinTokenRepository {
  constructor(private prisma: PrismaClient) {}

  async save(joinToken: JoinToken): Promise<JoinToken> {
    const data = joinToken.toJSON();

    const created = await this.prisma.organizationJoinToken.create({
      data: {
        organizationId: data.organizationId,
        token: data.token,
        description: data.description,
        maxUses: data.maxUses,
        useCount: data.useCount,
        createdById: data.createdById,
        createdAt: data.createdAt,
        expiredAt: data.expiredAt,
      },
    });

    return JoinToken.reconstitute(this.toProps(created));
  }

  async update(joinToken: JoinToken): Promise<JoinToken> {
    const data = joinToken.toJSON();

    const updated = await this.prisma.organizationJoinToken.update({
      where: { id: data.id },
      data: {
        description: data.description,
        maxUses: data.maxUses,
        expiredAt: data.expiredAt,
        useCount: data.useCount,
      },
    });

    return JoinToken.reconstitute(this.toProps(updated));
  }

  async findById(id: string): Promise<JoinToken | null> {
    const record = await this.prisma.organizationJoinToken.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return JoinToken.reconstitute(this.toProps(record));
  }

  async findByToken(token: string): Promise<JoinToken | null> {
    const record = await this.prisma.organizationJoinToken.findUnique({
      where: { token },
    });

    if (!record) {
      return null;
    }

    return JoinToken.reconstitute(this.toProps(record));
  }

  async findByOrganizationId(
    organizationId: string,
    filters: JoinTokenSearchFilters
  ): Promise<{ tokens: JoinTokenWithCreator[]; totalCount: number }> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.OrganizationJoinTokenWhereInput = {
      organizationId,
      ...(filters.activeOnly ? { expiredAt: null } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                token: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                description: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [records, totalCount] = await Promise.all([
      this.prisma.organizationJoinToken.findMany({
        where,
        include: {
          createdBy: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.organizationJoinToken.count({ where }),
    ]);

    const tokens: JoinTokenWithCreator[] = records.map((record) => ({
      joinToken: JoinToken.reconstitute(this.toProps(record)),
      creatorName: record.createdBy.firstName + ' ' + record.createdBy.lastName,
    }));

    return { tokens, totalCount };
  }

  async tryIncrementUseCount(id: string): Promise<boolean> {
    const count = await this.prisma.$executeRaw`
      UPDATE organization_join_tokens
      SET use_count = use_count + 1
      WHERE id = ${id}
        AND (max_uses IS NULL OR use_count < max_uses)
    `;

    return count > 0;
  }

  private toProps(record: {
    id: string;
    organizationId: string;
    token: string;
    description: string;
    maxUses: number | null;
    useCount: number;
    createdById: string;
    createdAt: Date;
    expiredAt: Date | null;
  }): JoinTokenProps {
    return {
      id: record.id,
      organizationId: record.organizationId,
      token: record.token,
      description: record.description,
      maxUses: record.maxUses,
      useCount: record.useCount,
      createdById: record.createdById,
      createdAt: record.createdAt,
      expiredAt: record.expiredAt,
    };
  }
}
