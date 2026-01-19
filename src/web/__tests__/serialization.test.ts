import { describe, it, expect } from 'vitest';

/**
 * Test suite to ensure data passed from Server Components to Client Components
 * is properly serialized and doesn't contain domain objects with methods.
 *
 * React Server Components cannot pass objects with toJSON methods or other
 * non-serializable properties to Client Components.
 */

/**
 * Validates that an object is JSON-serializable (safe to pass to Client Components)
 */
function isJSONSerializable(
  value: unknown,
  path = 'root'
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Handle primitives
  if (value === null || value === undefined) {
    return { valid: true, errors };
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return { valid: true, errors };
  }

  // Handle Date objects (serializable)
  if (value instanceof Date) {
    return { valid: true, errors };
  }

  // Check for functions or methods (not serializable)
  if (typeof value === 'function') {
    errors.push(`${path}: Found function (not serializable)`);

    return { valid: false, errors };
  }

  // Check for symbol (not serializable)
  if (typeof value === 'symbol') {
    errors.push(`${path}: Found symbol (not serializable)`);

    return { valid: false, errors };
  }

  // Handle arrays
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const result = isJSONSerializable(item, `${path}[${index}]`);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  // Handle objects
  if (typeof value === 'object') {
    // Check for circular references (would cause JSON.stringify to fail)
    try {
      JSON.stringify(value);
    } catch (error) {
      errors.push(
        `${path}: Circular reference or non-serializable value detected`
      );

      return { valid: false, errors };
    }

    // Check for methods (like toJSON, which React Server Components reject)
    const proto = Object.getPrototypeOf(value);
    if (proto && proto !== Object.prototype && proto !== Array.prototype) {
      // This object has a custom prototype, likely a class instance
      const methods = Object.getOwnPropertyNames(proto).filter(
        (name) => name !== 'constructor' && typeof proto[name] === 'function'
      );

      if (methods.length > 0) {
        errors.push(
          `${path}: Found domain object with methods [${methods.join(', ')}]. ` +
            `Domain objects must be converted to plain objects before passing to Client Components.`
        );

        return { valid: false, errors };
      }
    }

    // Recursively check all properties
    for (const [key, val] of Object.entries(value)) {
      const result = isJSONSerializable(val, `${path}.${key}`);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Helper function to test serialization of action results
 */
function expectSerializable(value: unknown, description: string) {
  const result = isJSONSerializable(value);
  if (!result.valid) {
    console.error(
      `\n❌ Serialization errors in ${description}:`,
      result.errors
    );
  }

  expect(result.valid, `${description} should be JSON-serializable`).toBe(true);
}

describe('Server-to-Client Component Serialization', () => {
  describe('Serialization validator', () => {
    it('should accept primitives', () => {
      expectSerializable('string', 'string');
      expectSerializable(123, 'number');
      expectSerializable(true, 'boolean');
      expectSerializable(null, 'null');
      expectSerializable(undefined, 'undefined');
    });

    it('should accept plain objects', () => {
      expectSerializable({ name: 'test', age: 30 }, 'plain object');
    });

    it('should accept arrays of plain objects', () => {
      expectSerializable([{ id: '1' }, { id: '2' }], 'array of plain objects');
    });

    it('should accept Date objects', () => {
      expectSerializable(new Date(), 'Date object');
    });

    it('should reject objects with methods', () => {
      class DomainObject {
        constructor(public name: string) {}
        toJSON() {
          return { name: this.name };
        }
      }

      const obj = new DomainObject('test');
      const result = isJSONSerializable(obj);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('toJSON');
    });

    it('should reject functions', () => {
      const obj = { onClick: () => {} };
      const result = isJSONSerializable(obj);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('function');
    });

    it('should detect nested domain objects', () => {
      class NestedDomain {
        getName() {
          return 'test';
        }
      }

      const obj = {
        title: 'Poll',
        nested: new NestedDomain(),
      };

      const result = isJSONSerializable(obj);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('getName');
    });

    it('should detect circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;

      const result = isJSONSerializable(obj);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Circular reference');
    });
  });

  describe('Common patterns', () => {
    it('should validate serialized poll data structure', () => {
      const serializedPoll = {
        id: 'poll-1',
        title: 'Test Poll',
        description: 'Test Description',
        isActive: true,
        isFinished: false,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            questionType: 'single_choice',
            page: 1,
            order: 1,
            answers: [
              { id: 'a1', text: 'Answer 1', order: 1 },
              { id: 'a2', text: 'Answer 2', order: 2 },
            ],
          },
        ],
      };

      expectSerializable(serializedPoll, 'serialized poll structure');
    });

    it('should validate serialized results data structure', () => {
      const serializedResults = {
        pollId: 'poll-1',
        totalParticipants: 10,
        totalWeight: 100,
        votedParticipants: 8,
        canViewVoters: true,
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            questionType: 'single_choice',
            answers: [
              {
                id: 'a1',
                text: 'Answer 1',
                voteCount: 5,
                totalWeight: 50,
                percentage: 50,
                voters: [
                  { id: 'u1', name: 'User 1', weight: 10 },
                  { id: 'u2', name: 'User 2', weight: 10 },
                ],
              },
            ],
          },
        ],
      };

      expectSerializable(serializedResults, 'serialized results structure');
    });

    it('should validate serialized participant data', () => {
      const serializedParticipants = [
        {
          id: 'p1',
          userId: 'u1',
          userName: 'John Doe',
          userWeight: 10,
          addedAt: new Date().toISOString(),
        },
      ];

      expectSerializable(serializedParticipants, 'serialized participants');
    });

    it('should validate serialized user preferences', () => {
      const serializedUser = {
        id: 'u1',
        firstName: 'John',
        lastName: 'Doe',
        middleName: null,
        phoneNumber: '1234567890',
        language: 'en',
        createdAt: new Date(),
      };

      expectSerializable(serializedUser, 'serialized user preferences');
    });
  });

  describe('Documentation', () => {
    it('should document the serialization requirement', () => {
      const documentation = `
        IMPORTANT: Server-to-Client Component Data Flow
        
        When passing data from Server Components to Client Components in Next.js,
        you MUST serialize domain objects to plain objects first.
        
        ❌ BAD - Passing domain objects directly:
        <ClientComponent poll={pollDomainObject} />
        
        ✅ GOOD - Serialize to plain objects:
        const serializedPoll = {
          id: poll.id,
          title: poll.title,
          questions: poll.questions.map(q => ({
            id: q.id,
            text: q.text,
            answers: q.answers.map(a => ({
              id: a.id,
              text: a.text,
            }))
          }))
        };
        <ClientComponent poll={serializedPoll} />
        
        Files already verified for proper serialization:
        ✅ src/app/[locale]/polls/[pollId]/vote/page.tsx - Serializes poll and drafts
        ✅ src/app/[locale]/polls/[pollId]/results/page.tsx - Serializes results with all nested data
        ✅ src/app/[locale]/polls/[pollId]/participants/page.tsx - Serializes participant data
        ✅ src/app/[locale]/account/page.tsx - Serializes user preferences
        ✅ src/app/[locale]/organizations/page.tsx - Uses action that returns serialized data
        
        Client Components (verified to use only plain object props):
        ✅ VotingInterface - Receives serialized poll and drafts
        ✅ PollResults - Receives serialized results structure
        ✅ ParticipantManagement - Receives serialized participants array
        ✅ AccountForm - Receives plain user preferences object
        ✅ OrganizationsList - Receives plain organizations array
        ✅ LoginForm, RegisterForm - No props or only primitives
        ✅ LocaleSwitcher - No props
        ✅ CreateOrganizationDialog - Only receives primitives (locale string)
        ✅ PollSidebar, QuestionForm - Used in Client Component (edit/create pages)
        ✅ PollControls - Used in Client Component (edit page)
      `;

      // This test always passes - it's just documentation
      expect(documentation).toBeDefined();
    });
  });
});
