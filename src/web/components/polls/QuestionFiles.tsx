/** Thumbnails and original downloads for evidence the viewer can read on this question. */
import { AttachmentPreview } from './AttachmentPreview';

export function QuestionFiles({
  files = [],
}: {
  files?: readonly { id: string; fileName: string; mimeType: string }[];
}) {
  if (!files.length) {
    return null;
  }

  return (
    <ul className="my-2 space-y-1">
      {files.map((file) => (
        <li key={file.id} className="flex items-center gap-3">
          <AttachmentPreview
            source={'/api/poll-attachments/' + file.id}
            name={file.fileName}
            mimeType={file.mimeType}
          />
          <a
            className="cursor-pointer break-all text-emerald-700 underline dark:text-emerald-400"
            href={'/api/poll-attachments/' + file.id}
          >
            {file.fileName}
          </a>
        </li>
      ))}
    </ul>
  );
}
