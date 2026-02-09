'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CreateBoardUseCase } from '@/application/board/CreateBoardUseCase';
import { ArchiveBoardUseCase } from '@/application/board/ArchiveBoardUseCase';
import { AddBoardMemberUseCase } from '@/application/board/AddBoardMemberUseCase';
import { RemoveBoardMemberUseCase } from '@/application/board/RemoveBoardMemberUseCase';
import { CreateBoardSchema } from '@/application/board/CreateBoardSchema';
import { ArchiveBoardSchema } from '@/application/board/ArchiveBoardSchema';
import { AddBoardMemberSchema } from '@/application/board/AddBoardMemberSchema';
import { RemoveBoardMemberSchema } from '@/application/board/RemoveBoardMemberSchema';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '../lib/session';

// Action result type for client-side handling
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const organizationRepository = new PrismaOrganizationRepository(prisma);
const boardRepository = new PrismaBoardRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

// Use cases
const createBoardUseCase = new CreateBoardUseCase({
  boardRepository,
  organizationRepository,
  userRepository,
});

const archiveBoardUseCase = new ArchiveBoardUseCase({
  boardRepository,
  organizationRepository,
  userRepository,
});

const addBoardMemberUseCase = new AddBoardMemberUseCase({
  boardRepository,
  organizationRepository,
  userRepository,
});

const removeBoardMemberUseCase = new RemoveBoardMemberUseCase({
  boardRepository,
  organizationRepository,
  userRepository,
});

export async function createBoardAction(
  formData: FormData
): Promise<ActionResult<{ boardId: string }>> {
  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Extract form data
    const input = {
      name: formData.get('name') as string,
      organizationId: formData.get('organizationId') as string,
    };

    // Validate with Zod
    const validation = CreateBoardSchema.safeParse(input);

    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      validation.error.issues.forEach((err) => {
        const path = err.path.join('.');

        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }

        fieldErrors[path].push(err.message);
      });

      return {
        success: false,
        error: t('validationFailed'),
        fieldErrors,
      };
    }

    // Execute use case
    const result = await createBoardUseCase.execute({
      ...validation.data,
      adminUserId: user.id,
    });

    if (!result.success) {
      const errorParts = result.error.split('.');
      const tError = await getTranslations(errorParts.shift());

      return {
        success: false,
        error: tError(errorParts.join('.')),
      };
    }

    return {
      success: true,
      data: {
        boardId: result.value.board.id,
      },
    };
  } catch (error) {
    console.error('Error creating board:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function archiveBoardAction(
  boardId: string
): Promise<ActionResult> {
  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Validate with Zod
    const validation = ArchiveBoardSchema.safeParse({ boardId });

    if (!validation.success) {
      return {
        success: false,
        error: t('validationFailed'),
      };
    }

    // Execute use case
    const result = await archiveBoardUseCase.execute({
      boardId: validation.data.boardId,
      adminUserId: user.id,
    });

    if (!result.success) {
      const errorParts = result.error.split('.');
      const tError = await getTranslations(errorParts.shift());

      return {
        success: false,
        error: tError(errorParts.join('.')),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    console.error('Error archiving board:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function addBoardMemberAction(
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Extract form data
    const input = {
      boardId: formData.get('boardId') as string,
      userId: formData.get('userId') as string,
    };

    // Validate with Zod
    const validation = AddBoardMemberSchema.safeParse(input);

    if (!validation.success) {
      return {
        success: false,
        error: t('validationFailed'),
      };
    }

    // Execute use case
    const result = await addBoardMemberUseCase.execute({
      ...validation.data,
      adminUserId: user.id,
    });

    if (!result.success) {
      const errorParts = result.error.split('.');
      const tError = await getTranslations(errorParts.shift());

      return {
        success: false,
        error: tError(errorParts.join('.')),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    console.error('Error adding board member:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function removeBoardMemberAction(
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Extract form data
    const input = {
      boardId: formData.get('boardId') as string,
      userId: formData.get('userId') as string,
      reason: formData.get('reason') as string | undefined,
    };

    // Validate with Zod
    const validation = RemoveBoardMemberSchema.safeParse(input);

    if (!validation.success) {
      return {
        success: false,
        error: t('validationFailed'),
      };
    }

    // Execute use case
    const result = await removeBoardMemberUseCase.execute({
      ...validation.data,
      adminUserId: user.id,
    });

    if (!result.success) {
      const errorParts = result.error.split('.');
      const tError = await getTranslations(errorParts.shift());

      return {
        success: false,
        error: tError(errorParts.join('.')),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    console.error('Error removing board member:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function getBoardDetailsAction(boardId: string): Promise<
  ActionResult<{
    board: {
      id: string;
      name: string;
      organizationId: string;
    };
    members: Array<{
      id: string;
      firstName: string;
      lastName: string;
      phoneNumber: string;
    }>;
    organizationMembers: Array<{
      id: string;
      firstName: string;
      lastName: string;
      phoneNumber: string;
    }>;
  }>
> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Get board
    const board = await boardRepository.findById(boardId);

    if (!board) {
      return {
        success: false,
        error: 'board.errors.notFound',
      };
    }

    // Check if user is admin of the organization
    const isAdmin = await organizationRepository.isUserAdmin(
      user.id,
      board.organizationId
    );

    if (!isAdmin) {
      return {
        success: false,
        error: 'organization.errors.notAdmin',
      };
    }

    // Get board members
    const boardMembers = await prisma.boardUser.findMany({
      where: {
        boardId,
        removedAt: null,
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
      },
    });

    // Get organization members including descendants (for adding new members)
    const descendantIds = await organizationRepository.getDescendantIds(
      board.organizationId
    );
    const allOrgIds = [board.organizationId, ...descendantIds];

    const orgMembers = await prisma.organizationUser.findMany({
      where: {
        organizationId: { in: allOrgIds },
        status: 'accepted',
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
      },
    });

    return {
      success: true,
      data: {
        board: {
          id: board.id,
          name: board.name,
          organizationId: board.organizationId,
        },
        members: boardMembers.map((bm) => ({
          id: bm.user.id,
          firstName: bm.user.firstName,
          lastName: bm.user.lastName,
          phoneNumber: bm.user.phoneNumber,
        })),
        organizationMembers: [
          ...new Map(
            orgMembers.map((om) => [
              om.user.id,
              {
                id: om.user.id,
                firstName: om.user.firstName,
                lastName: om.user.lastName,
                phoneNumber: om.user.phoneNumber,
              },
            ])
          ).values(),
        ],
      },
    };
  } catch (error) {
    console.error('Error getting board details:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function getUserBoardsAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      name: string;
      organizationId: string;
      organizationName: string;
    }>
  >
> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Get boards where user is a member
    const boardUsers = await prisma.boardUser.findMany({
      where: {
        userId: user.id,
        removedAt: null,
      },
      include: {
        board: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        addedAt: 'desc',
      },
    });

    const boards = boardUsers.map((bu) => ({
      id: bu.board.id,
      name: bu.board.name,
      organizationId: bu.board.organizationId,
      organizationName: bu.board.organization.name,
    }));

    return {
      success: true,
      data: boards,
    };
  } catch (error) {
    console.error('Error getting user boards:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function searchUsersForBoardAction(
  boardId: string,
  query: string
): Promise<
  ActionResult<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      middleName?: string;
      phoneNumber: string;
    }>
  >
> {
  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Validate query
    if (!query || query.trim().length < 2) {
      return {
        success: true,
        data: [],
      };
    }

    // Get the board
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!board) {
      return {
        success: false,
        error: t('notFound'),
      };
    }

    // Check if user is admin
    const isAdmin = await organizationRepository.isUserAdmin(
      user.id,
      board.organizationId
    );

    if (!isAdmin) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Search for users
    const users = await userRepository.searchUsers(query.trim());

    // Get current board members
    const boardMemberIds = await prisma.boardUser.findMany({
      where: {
        boardId: board.id,
        removedAt: null,
      },
      select: {
        userId: true,
      },
    });

    const boardMemberIdSet = new Set(
      boardMemberIds.map((bm: { userId: string }) => bm.userId)
    );

    // Get organization member IDs (including descendants)
    const searchDescendantIds = await organizationRepository.getDescendantIds(
      board.organizationId
    );
    const searchAllOrgIds = [board.organizationId, ...searchDescendantIds];

    const orgMemberIds = await prisma.organizationUser.findMany({
      where: {
        organizationId: { in: searchAllOrgIds },
        status: 'accepted',
      },
      select: {
        userId: true,
      },
    });

    const orgMemberIdSet = new Set(
      orgMemberIds.map((om: { userId: string }) => om.userId)
    );

    // Filter users:
    // - Not already a board member
    // - Not an organization member (we only want "outside" users)
    const filteredUsers = users
      .filter((u) => !boardMemberIdSet.has(u.id))
      .filter((u) => !orgMemberIdSet.has(u.id))
      .map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        middleName: u.middleName,
        phoneNumber: u.phoneNumber.getValue(),
      }));

    return {
      success: true,
      data: filteredUsers,
    };
  } catch (error) {
    console.error('Error searching users for board:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}
