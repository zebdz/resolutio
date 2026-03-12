import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchOrganizationsUseCase } from '../SearchOrganizationsUseCase';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';

// Minimal mock — only the method we care about
const mockRepo = {
  searchByNameFuzzy: vi.fn(),
} as unknown as OrganizationRepository;

describe('SearchOrganizationsUseCase', () => {
  let useCase: SearchOrganizationsUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new SearchOrganizationsUseCase({
      organizationRepository: mockRepo,
    });
  });

  it('returns results from repo', async () => {
    const orgs = [
      { id: 'org-1', name: 'Alpha Beta Corp' },
      { id: 'org-2', name: 'Abstract BC' },
    ];
    (mockRepo.searchByNameFuzzy as ReturnType<typeof vi.fn>).mockResolvedValue(
      orgs
    );

    const result = await useCase.execute({
      query: 'abc',
      excludeIds: [],
      limit: 20,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual(orgs);
    }
  });

  it('returns empty array for empty query', async () => {
    const result = await useCase.execute({
      query: '',
      excludeIds: ['org-1'],
      limit: 20,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual([]);
    }

    expect(mockRepo.searchByNameFuzzy).not.toHaveBeenCalled();
  });

  it('returns empty array for whitespace-only query', async () => {
    const result = await useCase.execute({
      query: '   ',
      excludeIds: [],
      limit: 20,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual([]);
    }

    expect(mockRepo.searchByNameFuzzy).not.toHaveBeenCalled();
  });

  it('passes excludeIds and limit to repo', async () => {
    (mockRepo.searchByNameFuzzy as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    );

    await useCase.execute({
      query: 'test',
      excludeIds: ['org-1', 'org-2'],
      limit: 10,
    });

    expect(mockRepo.searchByNameFuzzy).toHaveBeenCalledWith(
      'test',
      ['org-1', 'org-2'],
      10
    );
  });

  it('trims the query before passing to repo', async () => {
    (mockRepo.searchByNameFuzzy as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    );

    await useCase.execute({
      query: '  abc  ',
      excludeIds: [],
      limit: 20,
    });

    expect(mockRepo.searchByNameFuzzy).toHaveBeenCalledWith('abc', [], 20);
  });
});
