'use client';

import { XMarkIcon } from '@heroicons/react/20/solid';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Input } from '@/app/components/catalyst/input';
import { Button } from '@/app/components/catalyst/button';

interface AnswerInputProps {
  id: string;
  text: string;
  order: number;
  onChange: (text: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function AnswerInput({
  id,
  text,
  order,
  onChange,
  onDelete,
  disabled = false,
}: AnswerInputProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 group"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        {...attributes}
        {...listeners}
        disabled={disabled}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8h16M4 16h16"
          />
        </svg>
      </button>

      {/* Answer input */}
      <div className="flex-1">
        <Input
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Answer ${order + 1}`}
          disabled={disabled}
        />
      </div>

      {/* Delete button */}
      <Button
        type="button"
        color="red"
        onClick={onDelete}
        disabled={disabled}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <XMarkIcon className="w-4 h-4" />
      </Button>
    </div>
  );
}
