'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Button } from '@/src/web/components/catalyst/button';
import { Field, Label } from '@/src/web/components/catalyst/fieldset';
import { Input } from '@/src/web/components/catalyst/input';
import { Textarea } from '@/src/web/components/catalyst/textarea';
import {
  getPollByIdAction,
  updatePollAction,
  canEditPollAction,
  canManagePollAction,
  addQuestionAction,
  updateQuestionAction,
  deleteQuestionAction,
  updateQuestionOrderAction,
  createAnswerAction,
  updateAnswerAction,
  deleteAnswerAction,
} from '@/src/web/actions/poll/poll';
import {
  getLegalCheckAction,
  markLegalCheckStaleAction,
} from '@/web/actions/ai/getLegalCheck';
import { hasLegalRelevantChanges } from '@/application/ai/hasLegalRelevantChanges';
import type {
  LegalAnnotation as LegalAnnotationType,
  LegalAnalysisSummary as LegalAnalysisSummaryType,
} from '@/application/ai/legalAnalysisSchema';
import { Link } from '@/src/i18n/routing';
import { QuestionType } from '@/domain/poll/QuestionType';
import { PollState } from '@/src/domain/poll/PollState';
import { PollSidebar } from '@/src/web/components/polls/draft/PollSidebar';
import { QuestionForm } from '@/src/web/components/polls/draft/QuestionForm';
import PollControls from '@/src/web/components/polls/draft/PollControls';
import { LegalCheckControls } from '@/src/web/components/polls/legal/LegalCheckControls';
import { LegalAnnotation } from '@/src/web/components/polls/legal/LegalAnnotation';
import { LegalAnalysisSummary } from '@/src/web/components/polls/legal/LegalAnalysisSummary';
import { PlusIcon } from '@heroicons/react/20/solid';
import { validateHeaderName } from 'http';

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
  startDate: string;
  endDate: string;
  state: PollState;
}

export function EditPollForm() {
  const router = useRouter();
  const params = useParams();
  const pollId = params.pollId as string;
  const t = useTranslations('poll');
  const tCommon = useTranslations('common');
  const tLegal = useTranslations('legalCheck');

  const [pollData, setPollData] = useState<PollData>({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    state: PollState.DRAFT,
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [originalQuestions, setOriginalQuestions] = useState<Question[]>([]);
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >();
  const [questionFieldErrors, setQuestionFieldErrors] = useState<{
    questionId: string;
    errors: Record<string, string[]>;
  } | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canManage, setCanManage] = useState(false);

  // Legal check state
  const [legalAnnotations, setLegalAnnotations] = useState<
    LegalAnnotationType[]
  >([]);
  const [legalSummary, setLegalSummary] =
    useState<LegalAnalysisSummaryType | null>(null);
  const [legalCheckModel, setLegalCheckModel] = useState<string>('');
  const [legalCheckDate, setLegalCheckDate] = useState<Date | undefined>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [legalCheckError, setLegalCheckError] = useState<string | null>(null);
  const [isLegalCheckStale, setIsLegalCheckStale] = useState(false);

  const handleCheckLegality = useCallback(
    async (model: string) => {
      setIsAnalyzing(true);
      setLegalCheckError(null);
      setLegalCheckModel(model);
      setLegalCheckDate(undefined);

      try {
        const res = await fetch(`/api/polls/${pollId}/legal-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model }),
        });
        const body = await res.json();

        if (!res.ok || !body.success) {
          setLegalCheckError(body.error ?? tLegal('errors.providerError'));

          return;
        }

        setLegalAnnotations(body.data.annotations);
        setLegalSummary(body.data.summary);
        setLegalCheckDate(new Date());
        setIsLegalCheckStale(false);
      } catch (err) {
        setLegalCheckError(
          err instanceof Error ? err.message : tLegal('errors.providerError')
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    [pollId, tLegal]
  );

  const loadPoll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if poll can be edited
      const canEditResult = await canEditPollAction(pollId);

      if (!canEditResult.success) {
        setError(canEditResult.error);
        setIsLoading(false);

        return;
      }

      if (!canEditResult.data.canEdit) {
        let errorMessage = t('errors.cannotModifyFinished');

        if (canEditResult.data.reason === 'active') {
          errorMessage = t('errors.cannotModifyActive');
        } else if (canEditResult.data.reason === 'hasVotes') {
          errorMessage = t('errors.cannotModifyHasVotes');
        } else if (canEditResult.data.reason === 'notCreator') {
          errorMessage = t('errors.notPollCreator');
        }

        setError(errorMessage);
        setCanEdit(false);
        setIsLoading(false);

        return;
      }

      setCanEdit(true);

      // Check if user can manage poll
      const manageResult = await canManagePollAction(pollId);

      if (manageResult.success) {
        setCanManage(manageResult.data);
      }

      // Load poll data
      const result = await getPollByIdAction(pollId);

      if (result.success) {
        const poll = result.data;

        setPollData({
          title: poll.title,
          description: poll.description,
          startDate: new Date(poll.startDate).toISOString().split('T')[0],
          endDate: new Date(poll.endDate).toISOString().split('T')[0],
          state: poll.state,
        });
        setOriginalTitle(poll.title);
        setOriginalDescription(poll.description);

        // Load questions
        if (poll.questions && poll.questions.length > 0) {
          const loadedQuestions = poll.questions.map((q: any) => ({
            id: q.id,
            text: q.text,
            details: q.details || '',
            questionType: q.questionType as QuestionType,
            page: q.page,
            order: q.order,
            answers: q.answers
              ? q.answers.map((a: any) => ({
                  id: a.id,
                  text: a.text,
                  order: a.order,
                }))
              : [],
          }));

          setQuestions(loadedQuestions);
          setOriginalQuestions(JSON.parse(JSON.stringify(loadedQuestions))); // Deep copy
          setActiveQuestionId(loadedQuestions[0].id);
        }

        // Load latest persisted legal check (admin-only; errors ignored)
        const legalCheckResult = await getLegalCheckAction(pollId);

        if (legalCheckResult.success && legalCheckResult.data) {
          setLegalAnnotations(legalCheckResult.data.annotations);
          setLegalSummary(legalCheckResult.data.summary);
          setLegalCheckModel(legalCheckResult.data.model);
          setLegalCheckDate(new Date(legalCheckResult.data.checkedAt));
          setIsLegalCheckStale(legalCheckResult.data.isStale);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(t('errors.pollNotFound'));
    } finally {
      setIsLoading(false);
    }
  }, [pollId, t]);

  // Load poll data
  useEffect(() => {
    loadPoll();
  }, [loadPoll]);

  // Get active question
  const activeQuestion = questions.find((q) => q.id === activeQuestionId);

  const handleAddQuestion = () => {
    // Determine which page to add the question to
    let targetPage = 1;
    let targetOrder = 0;

    if (questions.length > 0) {
      if (activeQuestion) {
        targetPage = activeQuestion.page;
        const questionsOnPage = questions.filter((q) => q.page === targetPage);
        targetOrder = questionsOnPage.length;
      } else {
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
    const questionsWithAnswers = reorderedQuestions.map((q) => ({
      ...q,
      answers: q.answers || [],
    }));
    setQuestions(questionsWithAnswers);
  };

  const handleQuestionDelete = (questionId: string) => {
    const updatedQuestions = questions.filter((q) => q.id !== questionId);
    setQuestions(updatedQuestions);

    if (activeQuestionId === questionId) {
      setActiveQuestionId(
        updatedQuestions.length > 0 ? updatedQuestions[0].id : null
      );
    }
  };

  const handlePageDelete = (pageNumber: number) => {
    const updatedQuestions = questions.filter((q) => q.page !== pageNumber);

    const renumberedQuestions = updatedQuestions.map((q) => {
      if (q.page > pageNumber) {
        return { ...q, page: q.page - 1 };
      }

      return q;
    });

    setQuestions(renumberedQuestions);

    if (activeQuestion && activeQuestion.page === pageNumber) {
      setActiveQuestionId(
        renumberedQuestions.length > 0 ? renumberedQuestions[0].id : null
      );
    }
  };

  const handleAddPage = () => {
    const maxPage =
      questions.length > 0 ? Math.max(...questions.map((q) => q.page)) : 0;
    const newPageNumber = maxPage + 1;

    const newQuestion: Question = generateQuestion(newPageNumber, 0);

    setQuestions([...questions, newQuestion]);
    setActiveQuestionId(newQuestion.id);
  };

  const handleAddQuestionToPage = (pageNumber: number) => {
    const questionsOnPage = questions.filter((q) => q.page === pageNumber);
    const newOrder = questionsOnPage.length;

    const newQuestion: Question = generateQuestion(pageNumber, newOrder);

    setQuestions([...questions, newQuestion]);
    setActiveQuestionId(newQuestion.id);
  };

  const handleSave = async () => {
    console.log('saving poll...');

    try {
      setIsSaving(true);
      setError(null);
      setFieldErrors(undefined);
      setQuestionFieldErrors(null);

      // Validate
      if (!pollData.title.trim()) {
        setError(t('errors.titleRequired'));

        return;
      }

      if (!pollData.description.trim()) {
        setError(t('errors.descriptionRequired'));

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

      // Update poll basic info
      const pollFormData = new FormData();
      pollFormData.append('pollId', pollId);
      pollFormData.append('title', pollData.title);
      pollFormData.append('description', pollData.description);
      pollFormData.append('startDate', pollData.startDate);
      pollFormData.append('endDate', pollData.endDate);

      const pollResult = await updatePollAction(pollFormData);

      if (!pollResult.success) {
        setError(pollResult.error);
        setFieldErrors(pollResult.fieldErrors);

        return;
      }

      // Track question changes
      const currentQuestionIds = new Set(questions.map((q) => q.id));
      const originalQuestionIds = new Set(originalQuestions.map((q) => q.id));

      // Find deleted questions (in original but not in current)
      const deletedQuestionIds = originalQuestions
        .filter((q) => !currentQuestionIds.has(q.id))
        .map((q) => q.id);

      // Delete removed questions
      for (const questionId of deletedQuestionIds) {
        if (!questionId.startsWith('temp-')) {
          const deleteResult = await deleteQuestionAction(questionId);

          if (!deleteResult.success) {
            setError(deleteResult.error);

            return;
          }
        }
      }

      // Process each current question
      for (const question of questions) {
        const isNew = question.id.startsWith('temp-');

        if (isNew) {
          // Create new question with answers
          const validAnswers = (question.answers || [])
            .filter((a) => a.text.trim())
            .map((a) => a.text.trim());

          const formData = new FormData();
          formData.append('pollId', pollId);
          formData.append('text', question.text);

          if (question.details) {
            formData.append('details', question.details);
          }

          formData.append('questionType', question.questionType);
          formData.append('page', question.page.toString());
          formData.append('order', question.order.toString());
          formData.append('answers', JSON.stringify(validAnswers));

          const addResult = await addQuestionAction(formData);

          if (!addResult.success) {
            if (addResult.fieldErrors) {
              const fieldMessages = [
                ...new Set(
                  Object.values(addResult.fieldErrors).flatMap((msgs) => msgs)
                ),
              ].join('; ');
              setError(fieldMessages);
              setQuestionFieldErrors({
                questionId: question.id,
                errors: addResult.fieldErrors,
              });
              setActiveQuestionId(question.id);
            } else {
              setError(addResult.error);
            }

            return;
          }
        } else {
          // Check if question was modified
          const original = originalQuestions.find((q) => q.id === question.id);

          if (!original) {
            continue;
          }

          // Check if question properties changed (text, details, type)
          if (
            question.text !== original.text ||
            question.details !== original.details ||
            question.questionType !== original.questionType
          ) {
            const updateResult = await updateQuestionAction({
              questionId: question.id,
              text: question.text,
              details: question.details || null,
              questionType: question.questionType,
            });

            if (!updateResult.success) {
              if (updateResult.fieldErrors) {
                const fieldMessages = [
                  ...new Set(
                    Object.values(updateResult.fieldErrors).flatMap(
                      (msgs) => msgs
                    )
                  ),
                ].join('; ');
                setError(fieldMessages);
                setQuestionFieldErrors({
                  questionId: question.id,
                  errors: updateResult.fieldErrors,
                });
                setActiveQuestionId(question.id);
              } else {
                setError(updateResult.error);
              }

              return;
            }
          }

          // Handle answer changes for existing question
          const originalAnswerIds = new Set(
            original.answers?.map((a) => a.id) || []
          );
          const currentAnswerIds = new Set(
            question.answers?.map((a) => a.id) || []
          );

          // Find and delete removed answers
          const deletedAnswerIds = Array.from(originalAnswerIds).filter(
            (id) => !currentAnswerIds.has(id)
          );

          for (const answerId of deletedAnswerIds) {
            if (!answerId.startsWith('temp-')) {
              const deleteAnswerResult = await deleteAnswerAction(answerId);

              if (!deleteAnswerResult.success) {
                setError(deleteAnswerResult.error);

                return;
              }
            }
          }

          // Process answers
          if (question.answers) {
            for (let i = 0; i < question.answers.length; i++) {
              const answer = question.answers[i];

              if (!answer.text.trim()) {
                continue;
              }

              const isNewAnswer = answer.id.startsWith('temp-');

              if (isNewAnswer) {
                // Create new answer for existing question
                const createAnswerResult = await createAnswerAction({
                  questionId: question.id,
                  text: answer.text,
                  order: i,
                });

                if (!createAnswerResult.success) {
                  if (createAnswerResult.fieldErrors) {
                    const fieldMessages = [
                      ...new Set(
                        Object.values(createAnswerResult.fieldErrors).flatMap(
                          (msgs) => msgs
                        )
                      ),
                    ].join('; ');
                    setError(fieldMessages);
                    setQuestionFieldErrors({
                      questionId: question.id,
                      errors: { [`answers.${i}`]: [fieldMessages] },
                    });
                    setActiveQuestionId(question.id);
                  } else {
                    setError(createAnswerResult.error);
                  }

                  return;
                }
              } else {
                // Check if answer was modified
                const originalAnswer = original.answers?.find(
                  (a) => a.id === answer.id
                );

                if (!originalAnswer) {
                  continue;
                }

                if (
                  answer.text !== originalAnswer.text ||
                  i !== originalAnswer.order
                ) {
                  const updateAnswerResult = await updateAnswerAction({
                    answerId: answer.id,
                    text: answer.text,
                    order: i,
                  });

                  if (!updateAnswerResult.success) {
                    if (updateAnswerResult.fieldErrors) {
                      const fieldMessages = [
                        ...new Set(
                          Object.values(updateAnswerResult.fieldErrors).flatMap(
                            (msgs) => msgs
                          )
                        ),
                      ].join('; ');
                      setError(fieldMessages);
                      setQuestionFieldErrors({
                        questionId: question.id,
                        errors: { [`answers.${i}`]: [fieldMessages] },
                      });
                      setActiveQuestionId(question.id);
                    } else {
                      setError(updateAnswerResult.error);
                    }

                    return;
                  }
                }
              }
            }
          }
        }
      }

      // Update question order/page if any changed
      const orderUpdates = questions
        .filter((q) => !q.id.startsWith('temp-')) // Only existing questions
        .map((question) => {
          const original = originalQuestions.find((o) => o.id === question.id);

          return {
            question,
            original,
            changed:
              original &&
              (question.page !== original.page ||
                question.order !== original.order),
          };
        })
        .filter((item) => item.changed)
        .map((item) => ({
          questionId: item.question.id,
          page: item.question.page,
          order: item.question.order,
        }));

      if (orderUpdates.length > 0) {
        const orderUpdateResult = await updateQuestionOrderAction({
          pollId,
          updates: orderUpdates,
        });

        if (!orderUpdateResult.success) {
          setError(orderUpdateResult.error);

          return;
        }
      }

      // Mark legal check stale if content the AI analyzes changed
      if (legalSummary) {
        const changed = hasLegalRelevantChanges(
          {
            title: originalTitle,
            description: originalDescription,
            questions: originalQuestions.map((q) => ({
              id: q.id,
              text: q.text,
              answers: (q.answers ?? []).map((a) => ({
                id: a.id,
                text: a.text,
              })),
            })),
          },
          {
            title: pollData.title,
            description: pollData.description,
            questions: questions.map((q) => ({
              id: q.id,
              text: q.text,
              answers: (q.answers ?? []).map((a) => ({
                id: a.id,
                text: a.text,
              })),
            })),
          }
        );

        if (changed) {
          await markLegalCheckStaleAction(pollId);
        }
      }

      // Reload to sync original state (so unsaved-change detection resets)
      await loadPoll();
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

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500 dark:text-zinc-400">{tCommon('loading')}</p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Heading className="text-3xl font-bold">{t('editPoll')}</Heading>
          <Link href="/polls">
            <Button color="zinc">{tCommon('back')}</Button>
          </Link>
        </div>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          {error || t('errors.cannotModifyFinished')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Heading className="text-3xl font-bold">{t('editPoll')}</Heading>
        <div className="flex gap-2">
          <Link href="/polls">
            <Button color="zinc">{tCommon('cancel')}</Button>
          </Link>
          <Button
            color="brand-green"
            onClick={handleSave}
            disabled={isSaving || questions.length === 0}
          >
            {isSaving ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && !fieldErrors && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Poll Controls */}
      {canManage && (
        <PollControls
          pollId={pollId}
          state={pollData.state}
          hasQuestions={questions.length > 0}
          onStateChange={loadPoll}
        />
      )}

      {/* Legal check controls (admin only, non-draft polls) */}
      {canManage && pollData.state !== PollState.DRAFT && (
        <div className="space-y-2">
          <LegalCheckControls
            isAnalyzing={isAnalyzing}
            hasUnsavedChanges={hasLegalRelevantChanges(
              {
                title: originalTitle,
                description: originalDescription,
                questions: originalQuestions.map((q) => ({
                  id: q.id,
                  text: q.text,
                  answers: (q.answers ?? []).map((a) => ({
                    id: a.id,
                    text: a.text,
                  })),
                })),
              },
              {
                title: pollData.title,
                description: pollData.description,
                questions: questions.map((q) => ({
                  id: q.id,
                  text: q.text,
                  answers: (q.answers ?? []).map((a) => ({
                    id: a.id,
                    text: a.text,
                  })),
                })),
              }
            )}
            onCheckLegality={handleCheckLegality}
          />
          {legalCheckError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {legalCheckError}
            </div>
          )}
        </div>
      )}

      {/* Poll Basic Info */}
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
        <Field>
          <Label>{t('pollTitle')}</Label>
          <Input
            value={pollData.title}
            invalid={!!fieldErrors?.title}
            onChange={(e) => {
              setPollData({ ...pollData, title: e.target.value });
              setFieldErrors(undefined);
            }}
            placeholder={t('pollTitle')}
            required
          />
          {fieldErrors?.title && (
            <p className="text-sm text-red-600">{fieldErrors.title[0]}</p>
          )}
        </Field>

        <Field>
          <Label>{t('pollDescription')}</Label>
          <Textarea
            value={pollData.description}
            invalid={!!fieldErrors?.description}
            onChange={(e) => {
              setPollData({ ...pollData, description: e.target.value });
              setFieldErrors(undefined);
            }}
            placeholder={t('pollDescription')}
            required
            rows={3}
          />
          {fieldErrors?.description && (
            <p className="text-sm text-red-600">{fieldErrors.description[0]}</p>
          )}
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
            <>
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
                fieldErrors={
                  questionFieldErrors?.questionId === activeQuestion.id
                    ? questionFieldErrors.errors
                    : undefined
                }
              />

              {/* Inline legal annotations for this question */}
              {legalAnnotations
                .filter((a) => a.questionId === activeQuestion.id)
                .map((annotation, index) => (
                  <LegalAnnotation
                    key={`${annotation.questionId}-${annotation.answerId ?? 'q'}-${index}`}
                    annotation={annotation}
                  />
                ))}
            </>
          ) : questions.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                {t('noQuestions')}
              </p>
              <Button color="brand-green" onClick={handleAddQuestion}>
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

      {/* Legal analysis summary */}
      {canManage && pollData.state !== PollState.DRAFT && legalSummary && (
        <>
          {isLegalCheckStale && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
              {tLegal('summary.stale')}
            </div>
          )}
          <LegalAnalysisSummary
            summary={legalSummary}
            annotations={legalAnnotations}
            model={legalCheckModel}
            checkedAt={legalCheckDate}
          />
        </>
      )}
    </div>
  );
}
