'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { PlusIcon } from '@heroicons/react/20/solid';
import { QuestionType } from '@/domain/poll/QuestionType';

interface Answer {
  id: string;
  text: string;
  order: number;
}

interface Question {
  id: string;
  text: string;
  details?: string;
  questionType: QuestionType;
  page: number;
  order: number;
  answers?: Answer[];
}

interface PollSidebarProps {
  questions: Question[];
  activeQuestionId: string | null;
  onQuestionSelect: (questionId: string) => void;
  onQuestionsReorder: (questions: Question[]) => void;
  onQuestionDelete?: (questionId: string) => void;
  onPageDelete?: (pageNumber: number) => void;
  onAddQuestionToPage?: (pageNumber: number) => void;
  disabled?: boolean;
}

interface QuestionItemProps {
  question: Question;
  isActive: boolean;
  onDelete?: (questionId: string) => void;
  onClick: () => void;
}

function QuestionItem({
  question,
  isActive,
  onClick,
  onDelete,
}: QuestionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const TypeIcon =
    question.questionType === 'single-choice'
      ? CheckCircleIcon
      : ClipboardDocumentCheckIcon;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (onDelete) {
      onDelete(question.id);
    }
  };

  const t = useTranslations('poll');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group flex items-center gap-2 p-2 rounded-md cursor-pointer
        ${
          isActive
            ? 'bg-zinc-100 dark:bg-zinc-800'
            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
        }
      `}
      onClick={onClick}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        {...attributes}
        {...listeners}
      >
        <TypeIcon className="w-5 h-5" />
      </button>

      {/* Question text */}
      <div className="flex-1 text-sm truncate">
        {question.text || t('untitledQuestion')}
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          aria-label="Delete question"
        >
          <TrashIcon className="w-4 h-4 text-red-500" />
        </button>
      )}
    </div>
  );
}

interface PageGroupProps {
  pageNumber: number;
  questions: Question[];
  activeQuestionId: string | null;
  onQuestionSelect: (questionId: string) => void;
  onQuestionDelete?: (questionId: string) => void;
  onPageDelete?: (pageNumber: number) => void;
  onAddQuestionToPage?: (pageNumber: number) => void;
}

function PageGroup({
  pageNumber,
  questions,
  activeQuestionId,
  onQuestionSelect,
  onQuestionDelete,
  onPageDelete,
  onAddQuestionToPage,
}: PageGroupProps) {
  const [isOpen, setIsOpen] = useState(true);
  const t = useTranslations('poll');

  const handlePageDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMessage = t('deletePageConfirm', { page: pageNumber });

    if (onPageDelete && confirm(confirmMessage)) {
      onPageDelete(pageNumber);
    }
  };

  const handleAddQuestion = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (onAddQuestionToPage) {
      onAddQuestionToPage(pageNumber);
    }
  };

  return (
    <div className="space-y-1">
      {/* Page Header */}
      <div className="group flex items-center gap-1 w-full">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center gap-2 p-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-md"
        >
          {isOpen ? (
            <ChevronDownIcon className="w-4 h-4" />
          ) : (
            <ChevronRightIcon className="w-4 h-4" />
          )}
          {t('page')} {pageNumber}
          <span className="ml-auto text-xs text-zinc-500">
            {questions.length}
          </span>
        </button>
        {onAddQuestionToPage && (
          <button
            type="button"
            onClick={handleAddQuestion}
            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            aria-label={`${t('addQuestion')} to ${t('page')} ${pageNumber}`}
            title={t('addQuestion')}
          >
            <PlusIcon className="w-5 h-5 text-blue-500" />
          </button>
        )}
        {onPageDelete && questions.length > 0 && (
          <button
            type="button"
            onClick={handlePageDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            aria-label={`${t('delete')} ${t('page')} ${pageNumber}`}
          >
            <TrashIcon className="w-4 h-4 text-red-500" />
          </button>
        )}
      </div>

      {/* Questions */}
      {isOpen && (
        <div className="pl-4 space-y-1">
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            {questions.map((question) => (
              <QuestionItem
                key={question.id}
                question={question}
                isActive={activeQuestionId === question.id}
                onClick={() => onQuestionSelect(question.id)}
                onDelete={onQuestionDelete}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

export function PollSidebar({
  questions,
  activeQuestionId,
  onQuestionSelect,
  onQuestionsReorder,
  onQuestionDelete,
  onPageDelete,
  onAddQuestionToPage,
  disabled = false,
}: PollSidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const t = useTranslations('poll');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group questions by page
  const questionsByPage = questions.reduce(
    (acc, question) => {
      if (!acc[question.page]) {
        acc[question.page] = [];
      }

      acc[question.page].push(question);

      return acc;
    },
    {} as Record<number, Question[]>
  );

  // Sort pages
  const pages = Object.keys(questionsByPage)
    .map(Number)
    .sort((a, b) => a - b);

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedQuestions = arrayMove(questions, oldIndex, newIndex);

    // When a question moves, it should adopt the page of its new position
    const movedQuestion = reorderedQuestions[newIndex];
    const targetPage = questions[newIndex].page;
    movedQuestion.page = targetPage;

    // Now recalculate order and consolidate pages
    const grouped: Record<number, Question[]> = {};
    reorderedQuestions.forEach((q) => {
      if (!grouped[q.page]) {
        grouped[q.page] = [];
      }

      grouped[q.page].push(q);
    });

    const pageNumbers = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b);

    const updatedQuestions: Question[] = [];
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

    onQuestionsReorder(updatedQuestions);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  if (questions.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {t('noQuestions')}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-2">
        {pages.map((pageNumber) => (
          <PageGroup
            key={pageNumber}
            pageNumber={pageNumber}
            questions={questionsByPage[pageNumber].sort(
              (a, b) => a.order - b.order
            )}
            activeQuestionId={activeQuestionId}
            onQuestionSelect={onQuestionSelect}
            onQuestionDelete={onQuestionDelete}
            onPageDelete={onPageDelete}
            onAddQuestionToPage={onAddQuestionToPage}
          />
        ))}
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="bg-white dark:bg-zinc-900 p-2 rounded-md shadow-lg border border-zinc-200 dark:border-zinc-800">
            {questions.find((q) => q.id === activeId)?.text ||
              t('untitledQuestion')}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
