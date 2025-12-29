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
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { PlusIcon } from '@heroicons/react/20/solid';
import {
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { Input } from '@/app/components/catalyst/input';
import { Textarea } from '@/app/components/catalyst/textarea';
import { Select } from '@/app/components/catalyst/select';
import { Button } from '@/app/components/catalyst/button';
import { Field, Label } from '@/app/components/catalyst/fieldset';
import { AnswerInput } from './AnswerInput';
import { QuestionType } from '@/domain/poll/QuestionType';

interface Answer {
  id: string;
  text: string;
  order: number;
}

interface QuestionFormProps {
  questionId: string;
  text: string;
  details?: string;
  questionType: QuestionType;
  answers: Answer[];
  page: number;
  order: number;
  onTextChange: (text: string) => void;
  onDetailsChange: (details: string) => void;
  onTypeChange: (type: QuestionType) => void;
  onAnswersChange: (answers: Answer[]) => void;
  disabled?: boolean;
}

export function QuestionForm({
  questionId,
  text,
  details = '',
  questionType,
  answers,
  page,
  order,
  onTextChange,
  onDetailsChange,
  onTypeChange,
  onAnswersChange,
  disabled = false,
}: QuestionFormProps) {
  const t = useTranslations('poll');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = answers.findIndex((a) => a.id === active.id);
      const newIndex = answers.findIndex((a) => a.id === over.id);

      const newAnswers = arrayMove(answers, oldIndex, newIndex).map(
        (answer, idx) => ({
          ...answer,
          order: idx,
        })
      );

      onAnswersChange(newAnswers);
    }
  };

  const handleAnswerChange = (id: string, text: string) => {
    onAnswersChange(answers.map((a) => (a.id === id ? { ...a, text } : a)));
  };

  const handleAnswerDelete = (id: string) => {
    if (answers.length <= 1) {
      return;
    } // Keep at least one answer

    const newAnswers = answers
      .filter((a) => a.id !== id)
      .map((answer, idx) => ({
        ...answer,
        order: idx,
      }));

    onAnswersChange(newAnswers);
  };

  const handleAddAnswer = () => {
    const newAnswer: Answer = {
      id: `temp-${Date.now()}`,
      text: '',
      order: answers.length,
    };

    onAnswersChange([...answers, newAnswer]);
  };

  return (
    <div className="space-y-6 p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
      {/* Question Type */}
      <Field>
        <Label>{t('questionType')}</Label>
        <div className="flex items-center gap-2">
          {questionType === 'single-choice' ? (
            <CheckCircleIcon className="w-5 h-5 text-zinc-500" />
          ) : (
            <ClipboardDocumentCheckIcon className="w-5 h-5 text-zinc-500" />
          )}
          <Select
            value={questionType}
            onChange={(e) => onTypeChange(e.target.value as QuestionType)}
            disabled={disabled}
          >
            <option value="single-choice">{t('singleChoice')}</option>
            <option value="multiple-choice">{t('multipleChoice')}</option>
          </Select>
        </div>
      </Field>

      {/* Question Text */}
      <Field>
        <Label>{t('questionText')}</Label>
        <Input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={t('questionText')}
          disabled={disabled}
          required
        />
      </Field>

      {/* Question Details */}
      <Field>
        <Label>{t('questionDetails')}</Label>
        <Textarea
          value={details}
          onChange={(e) => onDetailsChange(e.target.value)}
          placeholder={t('questionDetails')}
          disabled={disabled}
          rows={3}
        />
      </Field>

      {/* Answers */}
      <Field>
        <Label>{t('answers')}</Label>
        <div className="space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={answers.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              {answers.map((answer) => (
                <AnswerInput
                  key={answer.id}
                  id={answer.id}
                  text={answer.text}
                  order={answer.order}
                  onChange={(text) => handleAnswerChange(answer.id, text)}
                  onDelete={() => handleAnswerDelete(answer.id)}
                  disabled={disabled}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Add Answer Button */}
          <Button
            type="button"
            color="zinc"
            onClick={handleAddAnswer}
            disabled={disabled}
            className="w-full"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            {t('addAnswer')}
          </Button>
        </div>
      </Field>

      {/* Page and Order Info */}
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        {t('page')}: {page} | {t('order')}: {order + 1}
      </div>
    </div>
  );
}
