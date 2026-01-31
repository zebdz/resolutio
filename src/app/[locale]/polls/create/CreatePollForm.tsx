'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Heading } from '@/app/components/catalyst/heading';
import { Button } from '@/app/components/catalyst/button';
import { Input } from '@/app/components/catalyst/input';
import { Textarea } from '@/app/components/catalyst/textarea';
import { Field, Label } from '@/app/components/catalyst/fieldset';
import { Select } from '@/app/components/catalyst/select';
import { PollSidebar } from '@/web/components/PollSidebar';
import { QuestionForm } from '@/web/components/QuestionForm';
import { PlusIcon } from '@heroicons/react/20/solid';
import { QuestionType } from '@/domain/poll/QuestionType';
import {
  createPollAction,
  addQuestionAction,
  updateQuestionOrderAction,
} from '@/web/actions/poll';
import { getUserBoardsAction } from '@/web/actions/board';

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

interface PollData {
  title: string;
  description: string;
  boardId: string;
  startDate: string;
  endDate: string;
}

export function CreatePollForm() {
  const router = useRouter();
  const t = useTranslations('poll');
  const tCommon = useTranslations('common');

  const [boards, setBoards] = useState<
    Array<{
      id: string;
      name: string;
      organizationName: string;
    }>
  >([]);
  const [isLoadingBoards, setIsLoadingBoards] = useState(true);

  const [pollData, setPollData] = useState<PollData>({
    title: '',
    description: '',
    boardId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user's boards
  useEffect(() => {
    async function loadBoards() {
      try {
        const result = await getUserBoardsAction();

        if (result.success) {
          setBoards(result.data);

          // Auto-select first board if available
          if (result.data.length > 0 && !pollData.boardId) {
            setPollData((prev) => ({ ...prev, boardId: result.data[0].id }));
          }
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(t('errors.loadBoards'));
      } finally {
        setIsLoadingBoards(false);
      }
    }

    loadBoards();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Get active question
  const activeQuestion = questions.find((q) => q.id === activeQuestionId);

  const handleAddQuestion = () => {
    // Determine which page to add the question to
    let targetPage = 1;
    let targetOrder = 0;

    if (questions.length > 0) {
      if (activeQuestion) {
        // Add to the same page as the active question
        targetPage = activeQuestion.page;
        const questionsOnPage = questions.filter((q) => q.page === targetPage);
        targetOrder = questionsOnPage.length;
      } else {
        // Add to the last page
        const maxPage = Math.max(...questions.map((q) => q.page));
        targetPage = maxPage;
        const questionsOnPage = questions.filter((q) => q.page === targetPage);
        targetOrder = questionsOnPage.length;
      }
    }

    const newQuestion: Question = generateQuestion(targetPage, targetOrder);

    setQuestions([...questions, newQuestion]);
    setActiveQuestionId(newQuestion.id);
  };

  const handleQuestionUpdate = (
    questionId: string,
    updates: Partial<Question>
  ) => {
    setQuestions(
      questions.map((q) => (q.id === questionId ? { ...q, ...updates } : q))
    );
  };

  const handleQuestionsReorder = (reorderedQuestions: Question[]) => {
    // Ensure answers array exists (sidebar may not include it)
    const questionsWithAnswers = reorderedQuestions.map((q) => ({
      ...q,
      answers: q.answers || [],
    }));
    setQuestions(questionsWithAnswers);
  };

  const handleQuestionDelete = (questionId: string) => {
    const updatedQuestions = questions.filter((q) => q.id !== questionId);
    setQuestions(updatedQuestions);

    // If we deleted the active question, select another one
    if (activeQuestionId === questionId) {
      setActiveQuestionId(
        updatedQuestions.length > 0 ? updatedQuestions[0].id : null
      );
    }
  };

  const handlePageDelete = (pageNumber: number) => {
    // Remove all questions on this page
    const updatedQuestions = questions.filter((q) => q.page !== pageNumber);

    // Renumber remaining pages
    const renumberedQuestions = updatedQuestions.map((q) => {
      if (q.page > pageNumber) {
        return { ...q, page: q.page - 1 };
      }

      return q;
    });

    setQuestions(renumberedQuestions);

    // If the active question was on the deleted page, clear it
    if (activeQuestion && activeQuestion.page === pageNumber) {
      setActiveQuestionId(
        renumberedQuestions.length > 0 ? renumberedQuestions[0].id : null
      );
    }
  };

  const handleAddPage = () => {
    // Find the highest page number
    const maxPage =
      questions.length > 0 ? Math.max(...questions.map((q) => q.page)) : 0;
    const newPageNumber = maxPage + 1;

    // Create a new question on the new page
    const newQuestion: Question = generateQuestion(newPageNumber, 0);

    setQuestions([...questions, newQuestion]);
    setActiveQuestionId(newQuestion.id);
  };

  const handleAddQuestionToPage = (pageNumber: number) => {
    // Get questions on this page to determine order
    const questionsOnPage = questions.filter((q) => q.page === pageNumber);
    const newOrder = questionsOnPage.length;

    const newQuestion: Question = generateQuestion(pageNumber, newOrder);

    setQuestions([...questions, newQuestion]);
    setActiveQuestionId(newQuestion.id);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Validate
      if (!pollData.title.trim()) {
        setError(t('errors.titleRequired'));

        return;
      }

      if (!pollData.description.trim()) {
        setError(t('errors.descriptionRequired'));

        return;
      }

      if (!pollData.boardId) {
        setError(t('errors.boardRequired'));

        return;
      }

      if (questions.length === 0) {
        setError(t('errors.atLeastOneQuestionRequired'));

        return;
      }

      // Validate questions
      for (const question of questions) {
        if (!question.text.trim()) {
          setError(t('errors.questionTextRequired'));

          return;
        }

        if (!question.answers || question.answers.length === 0) {
          setError(t('errors.atLeastOneAnswer'));

          return;
        }

        const validAnswers = question.answers.filter((a) => a.text.trim());

        if (validAnswers.length === 0) {
          setError(t('errors.atLeastOneAnswer'));

          return;
        }
      }

      // Create poll
      const pollFormData = new FormData();
      pollFormData.append('title', pollData.title);
      pollFormData.append('description', pollData.description);
      pollFormData.append('boardId', pollData.boardId);
      pollFormData.append('startDate', pollData.startDate);
      pollFormData.append('endDate', pollData.endDate);

      const pollResult = await createPollAction(pollFormData);

      if (!pollResult.success) {
        setError(pollResult.error);

        return;
      }

      const pollId = pollResult.data.pollId;

      // Create questions with answers
      for (const question of questions) {
        if (!question.answers) {
          continue;
        }

        const validAnswers = question.answers.filter((a) => a.text.trim());

        const questionFormData = new FormData();
        questionFormData.append('pollId', pollId);
        questionFormData.append('text', question.text);

        if (question.details) {
          questionFormData.append('details', question.details);
        }

        questionFormData.append('questionType', question.questionType);
        questionFormData.append('page', question.page.toString());
        questionFormData.append('order', question.order.toString());
        // Schema expects array of strings, not objects
        questionFormData.append(
          'answers',
          JSON.stringify(validAnswers.map((a) => a.text))
        );

        const questionResult = await addQuestionAction(questionFormData);

        if (!questionResult.success) {
          setError(questionResult.error);

          return;
        }
      }

      // Success! Redirect to polls list
      router.push('/polls');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const generateQuestion = (pageNumber: number, order: number): Question => {
    return {
      id: `temp-${Date.now()}`,
      text: '',
      details: '',
      questionType: 'single-choice',
      page: pageNumber,
      order: order,
      answers: [
        { id: `temp-a1-${Date.now()}`, text: '', order: 0 },
        { id: `temp-a2-${Date.now()}`, text: '', order: 1 },
        { id: `temp-a3-${Date.now()}`, text: '', order: 2 },
        { id: `temp-a4-${Date.now()}`, text: '', order: 3 },
      ],
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Heading className="text-3xl font-bold">{t('createPoll')}</Heading>
        <div className="flex gap-2">
          <Button
            color="zinc"
            onClick={() => router.back()}
            disabled={isSaving}
          >
            {t('cancel')}
          </Button>
          <Button color="blue" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : t('save')}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Poll Basic Info */}
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
        <Field>
          <Label>{t('selectBoard')}</Label>
          <Select
            name="boardId"
            value={pollData.boardId}
            onChange={(e) =>
              setPollData({ ...pollData, boardId: e.target.value })
            }
            disabled={isLoadingBoards || boards.length === 0}
            required
          >
            {isLoadingBoards ? (
              <option value="">{t('loadingBoards')}</option>
            ) : boards.length === 0 ? (
              <option value="">{t('noBoardsAvailable')}</option>
            ) : (
              <>
                <option value="">{t('selectABoard')}</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name} - {board.organizationName}
                  </option>
                ))}
              </>
            )}
          </Select>
        </Field>

        <Field>
          <Label>{t('pollTitle')}</Label>
          <Input
            value={pollData.title}
            onChange={(e) =>
              setPollData({ ...pollData, title: e.target.value })
            }
            placeholder={t('pollTitle')}
            required
          />
        </Field>

        <Field>
          <Label>{t('pollDescription')}</Label>
          <Textarea
            value={pollData.description}
            onChange={(e) =>
              setPollData({ ...pollData, description: e.target.value })
            }
            placeholder={t('pollDescription')}
            required
            rows={3}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field>
            <Label>{t('startDate')}</Label>
            <Input
              type="date"
              value={pollData.startDate}
              onChange={(e) =>
                setPollData({ ...pollData, startDate: e.target.value })
              }
              required
            />
          </Field>

          <Field>
            <Label>{t('endDate')}</Label>
            <Input
              type="date"
              value={pollData.endDate}
              onChange={(e) =>
                setPollData({ ...pollData, endDate: e.target.value })
              }
              required
            />
          </Field>
        </div>
      </div>

      {/* Questions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Questions Navigation */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{t('questions')}</h3>
              <Button
                type="button"
                color="zinc"
                onClick={handleAddPage}
                className="text-sm"
                title={t('addPage')}
              >
                <PlusIcon className="w-4 h-4" />
                {t('page')}
              </Button>
            </div>

            <PollSidebar
              questions={questions}
              activeQuestionId={activeQuestionId}
              onQuestionSelect={setActiveQuestionId}
              onQuestionsReorder={handleQuestionsReorder}
              onQuestionDelete={handleQuestionDelete}
              onPageDelete={handlePageDelete}
              onAddQuestionToPage={handleAddQuestionToPage}
            />
          </div>
        </div>

        {/* Main Content - Question Form */}
        <div className="lg:col-span-3">
          {activeQuestion ? (
            <QuestionForm
              questionId={activeQuestion.id}
              text={activeQuestion.text}
              details={activeQuestion.details}
              questionType={activeQuestion.questionType}
              answers={activeQuestion.answers || []}
              page={activeQuestion.page}
              order={activeQuestion.order}
              onTextChange={(text) =>
                handleQuestionUpdate(activeQuestion.id, { text })
              }
              onDetailsChange={(details) =>
                handleQuestionUpdate(activeQuestion.id, { details })
              }
              onTypeChange={(questionType) =>
                handleQuestionUpdate(activeQuestion.id, { questionType })
              }
              onAnswersChange={(answers) =>
                handleQuestionUpdate(activeQuestion.id, { answers })
              }
            />
          ) : questions.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                {t('noQuestions')}
              </p>
              <Button color="blue" onClick={handleAddQuestion}>
                <PlusIcon className="w-5 h-5 mr-2" />
                {t('addQuestion')}
              </Button>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <p className="text-zinc-500 dark:text-zinc-400">
                Select a question from the sidebar to edit
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
