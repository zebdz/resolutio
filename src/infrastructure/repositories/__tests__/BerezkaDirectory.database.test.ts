/** Exercise migrated street-only rows through the same privacy-aware repository and DTO as member invitations. */
import { expect, it } from 'vitest';
import { PrismaUserRepository } from '../PrismaUserRepository';
import { serializeDirectoryUserSearch } from '@/web/actions/organization/serializeDirectory';
import { pollDatabase } from './pollDatabase';

it('searches and displays an opted-in street with its supplied locality without exposing a house number', async () => {
  const db = await pollDatabase();

  try {
    const person = await db.prisma.user.create({
      data: {
        firstName: 'Иван',
        lastName: 'Иванов',
        nickname: 'example_user',
        password: 'fixture',
        phoneNumber: '+79990000171',
        address: {
          create: {
            country: 'Россия',
            city: 'Ростов-на-Дону',
            street: 'Лесная',
            building: '42',
            isPrivateHouse: null,
            oneLine: 'Лесная 42',
          },
        },
        allowFindByAddress: true,
      },
    });
    const repo = new PrismaUserRepository(db.prisma);
    const [found] = await repo.searchUsers('лесн', { respectPrivacy: true });
    expect(found.addressForDisplay?.oneLine).toBe('Лесная 42');
    expect(serializeDirectoryUserSearch(found).address).toEqual({
      city: 'Ростов-на-Дону',
      street: 'Лесная',
    });
    await repo.save(found);
    expect(
      (
        await db.prisma.address.findUniqueOrThrow({
          where: { userId: person.id },
        })
      ).isPrivateHouse
    ).toBeNull();
    const { Address } = await import('@/domain/user/Address');
    expect(() =>
      Address.create({
        country: 'Россия',
        city: 'Ростов-на-Дону',
        street: 'Лесная',
        building: '',
      })
    ).toThrow('domain.user.address.buildingRequired');
    await repo.save(
      found.updateAddress(
        Address.create({
          country: 'Россия',
          city: 'Ростов-на-Дону',
          street: 'Лесная',
          building: '42',
          isPrivateHouse: true,
        })
      )
    );
    expect((await repo.findById(found.id))?.address?.building).toBe('42');
    expect(
      await db.prisma.address.count({ where: { userId: person.id } })
    ).toBe(1);
    await db.prisma.user.update({
      where: { id: person.id },
      data: { allowFindByAddress: false },
    });
    expect(await repo.searchUsers('лесн', { respectPrivacy: true })).toEqual(
      []
    );
  } finally {
    await db.close();
  }
}, 30000);

it('keeps a nonvoter in the directory while excluding them from the organization electorate', async () => {
  const { OrganizationId } = await import('@/domain/shared/EntityIds');
  const { PrismaOrganizationRepository } =
    await import('../PrismaOrganizationRepository');
  const db = await pollDatabase();

  try {
    const member = await db.prisma.user.create({
      data: {
        firstName: 'Ivan',
        lastName: 'Test',
        phoneNumber: '+79990990000',
        nickname: 'nonvoter',
        password: 'fixture',
      },
    });
    const org = await db.prisma.organization.create({
      data: { name: 'Fixture', description: 'Fixture', createdById: member.id },
    });
    await db.prisma.organizationUser.create({
      data: {
        organizationId: org.id,
        userId: member.id,
        status: 'accepted',
        votingEligible: false,
      },
    });
    const repo = new PrismaOrganizationRepository(db.prisma);
    const id = OrganizationId.parse(org.id);
    expect(
      await repo.findAcceptedMemberUserIdsIncludingDescendants(id)
    ).toEqual([member.id]);
    expect(
      await repo.findAcceptedMemberUserIdsIncludingDescendants(id, {
        votingEligibleOnly: true,
      })
    ).toEqual([]);
  } finally {
    await db.close();
  }
}, 30000);
