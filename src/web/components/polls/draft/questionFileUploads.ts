/** Upload picked files after their question IDs exist. Retain only failed files for retry. */
export interface QuestionFileUpload {
  questionId: string;
  file: File;
}

export type SendQuestionFile = (
  file: File,
  questionId: string
) => Promise<{ id: string } | { error: string }>;

export async function uploadQuestionFiles(
  files: QuestionFileUpload[],
  send: SendQuestionFile
) {
  const failed: (QuestionFileUpload & { error: string })[] = [];

  for (const item of files) {
    const result = await send(item.file, item.questionId);

    if ('error' in result) {
      failed.push({ ...item, error: result.error });
    }
  }

  return failed;
}
