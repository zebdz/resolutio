import { describe, it, expect } from 'vitest';
import { Organization } from '../Organization';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

function makeOrg(
  overrides?: Partial<Parameters<typeof Organization.reconstitute>[0]>
) {
  return Organization.reconstitute({
    id: 'org-1',
    name: 'Test Org',
    description: 'A test organization',
    parentId: null,
    createdById: 'user-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: false,
    ...overrides,
  });
}

describe('Organization.updateName', () => {
  it('should update name when valid', () => {
    const org = makeOrg();
    const result = org.updateName('New Name');

    expect(result.success).toBe(true);
    expect(org.name).toBe('New Name');
  });

  it('should trim whitespace', () => {
    const org = makeOrg();
    const result = org.updateName('  Trimmed Name  ');

    expect(result.success).toBe(true);
    expect(org.name).toBe('Trimmed Name');
  });

  it('should fail when empty', () => {
    const org = makeOrg();
    const result = org.updateName('');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_NAME_EMPTY
      );
    }

    expect(org.name).toBe('Test Org');
  });

  it('should fail when only whitespace', () => {
    const org = makeOrg();
    const result = org.updateName('   ');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_NAME_EMPTY
      );
    }
  });

  it('should succeed with single character name', () => {
    const org = makeOrg();
    const result = org.updateName('A');

    expect(result.success).toBe(true);
    expect(org.name).toBe('A');
  });

  it('should fail when name contains special characters', () => {
    const org = makeOrg();
    const result = org.updateName('Org@Name!');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_NAME_INVALID_CHARS
      );
    }

    expect(org.name).toBe('Test Org');
  });

  it('should allow unicode letters', () => {
    const org = makeOrg();
    const result = org.updateName('Организация');

    expect(result.success).toBe(true);
    expect(org.name).toBe('Организация');
  });

  it('should allow hyphens and double quotes', () => {
    const org = makeOrg();
    const result = org.updateName('Org "Name" - Test');

    expect(result.success).toBe(true);
    expect(org.name).toBe('Org "Name" - Test');
  });

  it('should allow digits in name', () => {
    const org = makeOrg();
    const result = org.updateName('Org 123');

    expect(result.success).toBe(true);
    expect(org.name).toBe('Org 123');
  });

  it('should fail when longer than 255 chars', () => {
    const org = makeOrg();
    const result = org.updateName('a'.repeat(256));

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_NAME_TOO_LONG
      );
    }

    expect(org.name).toBe('Test Org');
  });
});

describe('Organization.updateDescription', () => {
  it('should update description when valid', () => {
    const org = makeOrg();
    const result = org.updateDescription('New description');

    expect(result.success).toBe(true);
    expect(org.description).toBe('New description');
  });

  it('should trim whitespace', () => {
    const org = makeOrg();
    const result = org.updateDescription('  Trimmed  ');

    expect(result.success).toBe(true);
    expect(org.description).toBe('Trimmed');
  });

  it('should fail when empty', () => {
    const org = makeOrg();
    const result = org.updateDescription('');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_EMPTY
      );
    }

    expect(org.description).toBe('A test organization');
  });

  it('should fail when only whitespace', () => {
    const org = makeOrg();
    const result = org.updateDescription('   ');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_EMPTY
      );
    }
  });

  it('should fail when longer than 2000 chars', () => {
    const org = makeOrg();
    const result = org.updateDescription('a'.repeat(2001));

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_TOO_LONG
      );
    }

    expect(org.description).toBe('A test organization');
  });
});

describe('Organization.allowMultiTreeMembership', () => {
  it('should default to false when created without parentId', () => {
    const result = Organization.create('Test Org', 'Test desc', 'creator-1');
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.allowMultiTreeMembership).toBe(false);
    }
  });

  it('should be null when created with parentId', () => {
    const result = Organization.create(
      'Test Org',
      'Test desc',
      'creator-1',
      'parent-1'
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.allowMultiTreeMembership).toBeNull();
    }
  });

  it('should accept explicit value when no parentId', () => {
    const result = Organization.create(
      'Test Org',
      'Test desc',
      'creator-1',
      undefined,
      true
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.allowMultiTreeMembership).toBe(true);
    }
  });

  it('should ignore explicit value when parentId is provided', () => {
    const result = Organization.create(
      'Test Org',
      'Test desc',
      'creator-1',
      'parent-1',
      true
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.allowMultiTreeMembership).toBeNull();
    }
  });

  it('should reconstitute with allowMultiTreeMembership', () => {
    const org = makeOrg({ allowMultiTreeMembership: true });
    expect(org.allowMultiTreeMembership).toBe(true);
  });

  it('should include allowMultiTreeMembership in toJSON', () => {
    const org = makeOrg({ allowMultiTreeMembership: true });
    expect(org.toJSON().allowMultiTreeMembership).toBe(true);
  });
});

describe('Organization.create name validation', () => {
  it('should succeed with single character name', () => {
    const result = Organization.create('A', 'Valid desc', 'user-1');

    expect(result.success).toBe(true);
  });

  it('should fail when name contains special characters', () => {
    const result = Organization.create('Org@Name!', 'Valid desc', 'user-1');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_NAME_INVALID_CHARS
      );
    }
  });

  it('should succeed with valid unicode name', () => {
    const result = Organization.create('Организация', 'Valid desc', 'user-1');

    expect(result.success).toBe(true);
  });
});

const mockProfanityChecker: ProfanityChecker = {
  containsProfanity: (text: string) => text.includes('badword'),
};

describe('Organization profanity check', () => {
  describe('create', () => {
    it('should reject name with profanity', () => {
      const result = Organization.create(
        'badword org',
        'Valid desc',
        'user-1',
        null,
        undefined,
        mockProfanityChecker
      );
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });

    it('should reject description with profanity', () => {
      const result = Organization.create(
        'Valid Org',
        'has badword here',
        'user-1',
        null,
        undefined,
        mockProfanityChecker
      );
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });

    it('should pass clean text with profanityChecker', () => {
      const result = Organization.create(
        'Clean Org',
        'Clean desc',
        'user-1',
        null,
        undefined,
        mockProfanityChecker
      );
      expect(result.success).toBe(true);
    });

    it('should pass without profanityChecker (backward compat)', () => {
      const result = Organization.create('Any Org', 'Any desc', 'user-1');
      expect(result.success).toBe(true);
    });
  });

  describe('updateName', () => {
    it('should reject name with profanity', () => {
      const org = makeOrg();
      const result = org.updateName('badword name', mockProfanityChecker);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }

      expect(org.name).toBe('Test Org');
    });
  });

  describe('updateDescription', () => {
    it('should reject description with profanity', () => {
      const org = makeOrg();
      const result = org.updateDescription(
        'badword text',
        mockProfanityChecker
      );
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }

      expect(org.description).toBe('A test organization');
    });
  });
});
