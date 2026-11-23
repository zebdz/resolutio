/** Display weighted results at the stored precision. Render the sealed winner by identity
 * and calculate a unique positive leader for live results. */
export function printWeight(weight: number, exact?: string): string {
  return (exact ?? weight.toFixed(6)).replace(/(\.\d{2}\d*?)0+$/, '$1');
}

export function leadingAnswer<T extends { answerId?: string }>(
  questionType: string,
  answers: readonly T[],
  weight: (answer: T) => number,
  winningAnswerId?: string | null
): T | null {
  if (winningAnswerId !== undefined) {
    return (
      answers.find((answer) => answer.answerId === winningAnswerId) ?? null
    );
  }

  if (questionType !== 'single-choice') {
    return null;
  }

  let highest = 0;
  let winner: T | null = null;

  for (const answer of answers) {
    const current = weight(answer);

    if (current > highest) {
      highest = current;
      winner = answer;
    } else if (current === highest) {
      winner = null;
    }
  }

  return winner;
}
