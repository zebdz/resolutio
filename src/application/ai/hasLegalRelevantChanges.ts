export interface LegalRelevantContent {
  title: string;
  description: string;
  questions: {
    id: string;
    text: string;
    answers: { id: string; text: string }[];
  }[];
}

/**
 * Compares two snapshots of poll content and returns true if anything the
 * AI legal check would analyze has changed (title, description, question
 * texts, answer texts, or the set of questions/answers itself).
 *
 * Changes to dates, state, or ordering don't affect legality analysis.
 */
export function hasLegalRelevantChanges(
  original: LegalRelevantContent,
  current: LegalRelevantContent
): boolean {
  if (original.title !== current.title) {
    return true;
  }

  if (original.description !== current.description) {
    return true;
  }

  if (original.questions.length !== current.questions.length) {
    return true;
  }

  for (let qi = 0; qi < original.questions.length; qi++) {
    const oq = original.questions[qi];
    const cq = current.questions.find((q) => q.id === oq.id);

    if (!cq) {
      return true;
    }

    if (oq.text !== cq.text) {
      return true;
    }

    if (oq.answers.length !== cq.answers.length) {
      return true;
    }

    for (const oa of oq.answers) {
      const ca = cq.answers.find((a) => a.id === oa.id);

      if (!ca) {
        return true;
      }

      if (oa.text !== ca.text) {
        return true;
      }
    }
  }

  // Check for new questions not in original
  for (const cq of current.questions) {
    if (!original.questions.find((q) => q.id === cq.id)) {
      return true;
    }
  }

  return false;
}
