import { describe, it, expect } from 'vitest';
import { CreateOrganizationSchema } from '../CreateOrganizationSchema';

describe('CreateOrganizationSchema', () => {
  const validInput = {
    name: 'Test Organization',
    description: 'A test organization',
  };

  it('should default autoJoin to true when not provided', () => {
    const result = CreateOrganizationSchema.safeParse(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.autoJoin).toBe(true);
    }
  });

  it('should accept explicit autoJoin false', () => {
    const result = CreateOrganizationSchema.safeParse({
      ...validInput,
      autoJoin: false,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.autoJoin).toBe(false);
    }
  });

  it('should accept explicit autoJoin true', () => {
    const result = CreateOrganizationSchema.safeParse({
      ...validInput,
      autoJoin: true,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.autoJoin).toBe(true);
    }
  });

  it('should still validate name and description with autoJoin present', () => {
    const result = CreateOrganizationSchema.safeParse({
      name: '',
      description: '',
      autoJoin: true,
    });

    expect(result.success).toBe(false);
  });
});
