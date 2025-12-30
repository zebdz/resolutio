import { describe, it, expect } from 'vitest';

// Helper to simulate drag-and-drop reordering logic
function reorderQuestions(
  questions: Array<{ id: string; page: number; order: number }>,
  fromIndex: number,
  toIndex: number
): Array<{ id: string; page: number; order: number }> {
  // Simulate arrayMove
  const result = Array.from(questions);
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);

  // The moved question adopts the page of its new position
  const movedQuestion = result[toIndex];
  const targetPage = questions[toIndex].page;
  movedQuestion.page = targetPage;

  // Recalculate page and order based on visual grouping
  const grouped: Record<number, typeof questions> = {};
  result.forEach((q) => {
    if (!grouped[q.page]) {
      grouped[q.page] = [];
    }

    grouped[q.page].push(q);
  });

  const pageNumbers = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  const updatedQuestions: typeof questions = [];
  pageNumbers.forEach((pageNum, pageIdx) => {
    const questionsInPage = grouped[pageNum];
    questionsInPage.forEach((q, orderIdx) => {
      updatedQuestions.push({
        ...q,
        page: pageIdx + 1,
        order: orderIdx,
      });
    });
  });

  return updatedQuestions;
}

describe('PollSidebar drag-and-drop logic', () => {
  it('should move a question within the same page', () => {
    const questions = [
      { id: 'q1', page: 1, order: 0 },
      { id: 'q2', page: 1, order: 1 },
      { id: 'q3', page: 1, order: 2 },
    ];

    const reordered = reorderQuestions(questions, 0, 2);

    expect(reordered).toEqual([
      { id: 'q2', page: 1, order: 0 },
      { id: 'q3', page: 1, order: 1 },
      { id: 'q1', page: 1, order: 2 },
    ]);
  });

  it('should move a question from page 2 to page 1', () => {
    const questions = [
      { id: 'q1', page: 1, order: 0 },
      { id: 'q2', page: 2, order: 0 },
      { id: 'q3', page: 2, order: 1 },
      { id: 'q4', page: 2, order: 2 },
    ];

    // Move q2 (index 1) before q1 (index 0)
    const reordered = reorderQuestions(questions, 1, 0);

    // q2 should now be on page 1 (the first page since it's now first)
    expect(reordered.find((q) => q.id === 'q2')?.page).toBe(1);
    // q1 should be on page 1 too since it follows q2
    expect(reordered.find((q) => q.id === 'q1')?.page).toBe(1);

    // q3 and q4 should be on page 2
    expect(reordered.find((q) => q.id === 'q3')?.page).toBe(2);
    expect(reordered.find((q) => q.id === 'q4')?.page).toBe(2);

    // Verify the order
    expect(reordered[0].id).toBe('q2');
    expect(reordered[1].id).toBe('q1');
  });

  it('should properly renumber pages after moving questions', () => {
    const questions = [
      { id: 'q1', page: 1, order: 0 },
      { id: 'q2', page: 2, order: 0 },
      { id: 'q3', page: 3, order: 0 },
    ];

    // Move q3 to the beginning - it will join page 1
    const reordered = reorderQuestions(questions, 2, 0);

    // After moving, q3 and q1 should be on the same page (page 1)
    expect(reordered.find((q) => q.id === 'q3')?.page).toBe(1);
    expect(reordered.find((q) => q.id === 'q1')?.page).toBe(1);

    // q2 should be on page 2 (renumbered from original page 2)
    expect(reordered.find((q) => q.id === 'q2')?.page).toBe(2);

    // After consolidation, we should have 2 pages (not 3)
    const uniquePages = [...new Set(reordered.map((q) => q.page))];
    expect(uniquePages.length).toBe(2);
    expect(Math.max(...uniquePages)).toBe(2);
    expect(Math.min(...uniquePages)).toBe(1);
  });

  it('should maintain order within pages after moving', () => {
    const questions = [
      { id: 'q1', page: 1, order: 0 },
      { id: 'q2', page: 1, order: 1 },
      { id: 'q3', page: 2, order: 0 },
      { id: 'q4', page: 2, order: 1 },
    ];

    // Move q3 from page 2 to page 1
    const reordered = reorderQuestions(questions, 2, 1);

    // Check that orders are sequential within each page
    const page1Questions = reordered
      .filter((q) => q.page === 1)
      .sort((a, b) => a.order - b.order);
    const page2Questions = reordered
      .filter((q) => q.page === 2)
      .sort((a, b) => a.order - b.order);

    page1Questions.forEach((q, idx) => {
      expect(q.order).toBe(idx);
    });

    page2Questions.forEach((q, idx) => {
      expect(q.order).toBe(idx);
    });
  });
});

describe('PollSidebar page management', () => {
  it('should add a question to a specific page', () => {
    const questions = [
      { id: 'q1', page: 1, order: 0 },
      { id: 'q2', page: 2, order: 0 },
    ];

    const newQuestion = {
      id: 'q3',
      page: 1,
      order: questions.filter((q) => q.page === 1).length,
    };

    const updated = [...questions, newQuestion];

    expect(updated.filter((q) => q.page === 1)).toHaveLength(2);
    expect(updated.find((q) => q.id === 'q3')?.order).toBe(1);
  });

  it('should delete all questions on a page when page is deleted', () => {
    const questions = [
      { id: 'q1', page: 1, order: 0 },
      { id: 'q2', page: 1, order: 1 },
      { id: 'q3', page: 2, order: 0 },
      { id: 'q4', page: 3, order: 0 },
    ];

    // Delete page 1
    const afterDelete = questions.filter((q) => q.page !== 1);

    // Renumber pages
    const renumbered = afterDelete.map((q) => {
      if (q.page > 1) {
        return { ...q, page: q.page - 1 };
      }

      return q;
    });

    expect(renumbered).toHaveLength(2);
    expect(renumbered.find((q) => q.id === 'q1')).toBeUndefined();
    expect(renumbered.find((q) => q.id === 'q2')).toBeUndefined();
    expect(renumbered.find((q) => q.id === 'q3')?.page).toBe(1);
    expect(renumbered.find((q) => q.id === 'q4')?.page).toBe(2);
  });
});
