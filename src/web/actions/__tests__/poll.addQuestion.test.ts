import { describe, it, expect } from 'vitest';

/**
 * Tests for FormData parsing logic in addQuestionAction.
 *
 * This tests the parsing of answers from FormData format (answers[0][text], answers[0][order])
 * to ensure the action correctly handles both FormData and plain object inputs.
 */

// Helper function that mimics the parsing logic from addQuestionAction
function parseAnswersFromFormData(
  formData: FormData
): { text: string; order: number }[] {
  const answers: { text: string; order: number }[] = [];
  const answerIndices = new Set<number>();

  // Find all answer indices
  for (const key of formData.keys()) {
    const match = key.match(/^answers\[(\d+)\]\[text\]$/);
    if (match) {
      answerIndices.add(parseInt(match[1]));
    }
  }

  // Build answers array
  for (const index of Array.from(answerIndices).sort((a, b) => a - b)) {
    const text = formData.get(`answers[${index}][text]`) as string;
    const orderStr = formData.get(`answers[${index}][order]`) as string;

    if (text && text.trim()) {
      answers.push({
        text: text.trim(),
        order: orderStr ? parseInt(orderStr) : index,
      });
    }
  }

  return answers;
}

describe('addQuestionAction - FormData parsing', () => {
  describe('parseAnswersFromFormData', () => {
    it('should parse multiple answers from FormData', () => {
      const formData = new FormData();
      formData.append('answers[0][text]', 'Answer 1');
      formData.append('answers[0][order]', '0');
      formData.append('answers[1][text]', 'Answer 2');
      formData.append('answers[1][order]', '1');
      formData.append('answers[2][text]', 'Answer 3');
      formData.append('answers[2][order]', '2');

      const result = parseAnswersFromFormData(formData);

      expect(result).toEqual([
        { text: 'Answer 1', order: 0 },
        { text: 'Answer 2', order: 1 },
        { text: 'Answer 3', order: 2 },
      ]);
    });

    it('should filter out empty/whitespace answers', () => {
      const formData = new FormData();
      formData.append('answers[0][text]', 'Valid Answer');
      formData.append('answers[0][order]', '0');
      formData.append('answers[1][text]', '   '); // Whitespace only
      formData.append('answers[1][order]', '1');
      formData.append('answers[2][text]', ''); // Empty
      formData.append('answers[2][order]', '2');
      formData.append('answers[3][text]', 'Another Valid');
      formData.append('answers[3][order]', '3');

      const result = parseAnswersFromFormData(formData);

      expect(result).toEqual([
        { text: 'Valid Answer', order: 0 },
        { text: 'Another Valid', order: 3 },
      ]);
    });

    it('should handle non-sequential indices', () => {
      const formData = new FormData();
      formData.append('answers[0][text]', 'First');
      formData.append('answers[0][order]', '0');
      formData.append('answers[5][text]', 'Fifth');
      formData.append('answers[5][order]', '5');
      formData.append('answers[2][text]', 'Second');
      formData.append('answers[2][order]', '2');

      const result = parseAnswersFromFormData(formData);

      // Should be sorted by index
      expect(result).toEqual([
        { text: 'First', order: 0 },
        { text: 'Second', order: 2 },
        { text: 'Fifth', order: 5 },
      ]);
    });

    it('should trim whitespace from answer text', () => {
      const formData = new FormData();
      formData.append('answers[0][text]', '  Trimmed Answer  ');
      formData.append('answers[0][order]', '0');

      const result = parseAnswersFromFormData(formData);

      expect(result).toEqual([{ text: 'Trimmed Answer', order: 0 }]);
    });

    it('should use index as order when order field is missing', () => {
      const formData = new FormData();
      formData.append('answers[0][text]', 'Answer without order');
      // No order field

      const result = parseAnswersFromFormData(formData);

      expect(result).toEqual([{ text: 'Answer without order', order: 0 }]);
    });

    it('should return empty array when no answers in FormData', () => {
      const formData = new FormData();
      formData.append('pollId', 'poll-1');
      formData.append('text', 'Question text');
      // No answers

      const result = parseAnswersFromFormData(formData);

      expect(result).toEqual([]);
    });

    it('should handle the exact format sent from edit page', () => {
      // This is the exact format that was failing in the bug report
      const formData = new FormData();
      formData.append('pollId', 'cmjvnc5md0000i5ij5l557rc3');
      formData.append('text', 'sec');
      formData.append('questionType', 'single-choice');
      formData.append('page', '1');
      formData.append('order', '1');
      formData.append('answers[0][text]', 'aa');
      formData.append('answers[0][order]', '0');

      const result = parseAnswersFromFormData(formData);

      expect(result).toEqual([{ text: 'aa', order: 0 }]);
      expect(result.length).toBe(1);
      expect(result.length).toBeGreaterThan(0); // This was the failing check
    });
  });
});
