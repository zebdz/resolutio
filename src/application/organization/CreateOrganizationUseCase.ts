import { Organization } from '../../domain/organization/Organization';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { Board } from '../../domain/board/Board';
import { Result, success, failure } from '../../domain/shared/Result';
import { CreateOrganizationInput } from './CreateOrganizationSchema';
import { OrganizationErrors } from './OrganizationErrors';

export interface CreateOrganizationDependencies {
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
}

export class CreateOrganizationUseCase {
  constructor(private deps: CreateOrganizationDependencies) {}

  async execute(
    input: CreateOrganizationInput,
    userId: string,
    defaultBoardName: string
  ): Promise<
    Result<{ organization: Organization; generalBoard: Board }, string>
  > {
    const { name, description, parentId } = input;

    // Check if organization with this name already exists
    const existingOrg = await this.deps.organizationRepository.findByName(name);
    if (existingOrg) {
      return failure(OrganizationErrors.NAME_EXISTS);
    }

    // Validate that parent organization exists if parentId is provided
    if (parentId) {
      const parentOrg =
        await this.deps.organizationRepository.findById(parentId);
      if (!parentOrg) {
        return failure(OrganizationErrors.PARENT_NOT_FOUND);
      }

      if (parentOrg.isArchived()) {
        return failure(OrganizationErrors.PARENT_ARCHIVED);
      }
    }

    // Create the organization entity
    const organizationResult = Organization.create(
      name,
      description,
      userId,
      parentId
    );

    if (!organizationResult.success) {
      return failure(organizationResult.error);
    }

    const organization = organizationResult.value;

    // Save the organization
    const savedOrg = await this.deps.organizationRepository.save(organization);

    // Create the general board with the translated name
    const boardResult = Board.create(defaultBoardName, savedOrg.id, true);

    if (!boardResult.success) {
      return failure(boardResult.error);
    }

    const generalBoard = boardResult.value;
    const savedBoard = await this.deps.boardRepository.save(generalBoard);

    return success({
      organization: savedOrg,
      generalBoard: savedBoard,
    });
  }
}
