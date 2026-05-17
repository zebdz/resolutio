'use client';

import { useTranslations } from 'next-intl';

interface BoardsMultiPickerProps {
  boards: Array<{ id: string; name: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
}

export function BoardsMultiPicker({
  boards,
  selected,
  onChange,
}: BoardsMultiPickerProps) {
  const t = useTranslations('report');

  if (boards.length === 0) {
    return (
      <p className="text-sm italic text-zinc-500 dark:text-zinc-400">
        {t('boards.noneInOrg')}
      </p>
    );
  }

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="space-y-2">
      {boards.map((board) => {
        const checked = selected.includes(board.id);

        return (
          <label
            key={board.id}
            className="flex cursor-pointer items-center gap-3"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(board.id)}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600"
            />
            <span className="text-sm text-zinc-800 dark:text-zinc-200">
              {board.name}
            </span>
          </label>
        );
      })}
    </div>
  );
}
