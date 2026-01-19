'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { submitDraftAction, finishVotingAction } from '@/web/actions/vote';
import { Button } from '@/app/components/catalyst/button';
import VotingQuestion from './VotingQuestion';
import VotingProgress from './VotingProgress';
import VotingControls from './VotingControls';
import { toast } from 'sonner';

interface Question {
  id: string;
  text: string;
  details: string | null;
  page: number;
  order: number;
  questionType: 'single-choice' | 'multiple-choice';
  answers: Answer[];
}

interface Answer {
  id: string;
  text: string;
  order: number;
}

interface Poll {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

interface VoteDraft {
  id: string;
  questionId: string;
  answerId: string;
}

interface VotingInterfaceProps {
  poll: Poll;
  userDrafts: VoteDraft[];
  pollId: string;
}

export default function VotingInterface({
  poll,
  userDrafts: initialDrafts,
  pollId,
}: VotingInterfaceProps) {
  const t = useTranslations('poll.voting');
  const router = useRouter();

  // Group questions by page
  const questionsByPage = poll.questions.reduce(
    (acc, question) => {
      if (!acc[question.page]) {
        acc[question.page] = [];
      }

      acc[question.page].push(question);

      return acc;
    },
    {} as Record<number, Question[]>
  );

  const pages = Object.keys(questionsByPage)
    .map(Number)
    .sort((a, b) => a - b);

  const [currentPage, setCurrentPage] = useState(pages[0] || 1);
  const [drafts, setDrafts] = useState<Record<string, string[]>>(() => {
    // Initialize drafts from server data
    const draftMap: Record<string, string[]> = {};
    if (initialDrafts && Array.isArray(initialDrafts)) {
      initialDrafts.forEach((draft) => {
        if (!draftMap[draft.questionId]) {
          draftMap[draft.questionId] = [];
        }

        draftMap[draft.questionId].push(draft.answerId);
      });
    }

    return draftMap;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const currentQuestions = questionsByPage[currentPage] || [];

  // Calculate progress
  const totalQuestions = poll.questions.length;
  const answeredQuestions = Object.keys(drafts).filter(
    (questionId) => drafts[questionId].length > 0
  ).length;
  const progressPercentage = Math.round(
    (answeredQuestions / totalQuestions) * 100
  );

  const handleAnswerSelect = async (
    questionId: string,
    answerId: string,
    isSingleChoice: boolean
  ) => {
    setIsSaving(true);

    try {
      const currentAnswers = drafts[questionId] || [];
      const isCurrentlySelected = currentAnswers.includes(answerId);

      // Update local state immediately for better UX
      setDrafts((prev) => {
        if (isSingleChoice) {
          return { ...prev, [questionId]: [answerId] };
        } else {
          const current = prev[questionId] || [];
          const newAnswers = current.includes(answerId)
            ? current.filter((id) => id !== answerId)
            : [...current, answerId];

          return { ...prev, [questionId]: newAnswers };
        }
      });

      // Save to server
      // For multiple-choice: if unselecting, pass shouldRemove flag
      const result = await submitDraftAction({
        pollId,
        questionId,
        answerId,
        isSingleChoice,
        shouldRemove: !isSingleChoice && isCurrentlySelected, // Remove if it was selected in multiple-choice
      });

      if (result.success) {
        toast.success(t('autoSaved'));
      } else {
        toast.error(result.error);
        // Revert on error
        setDrafts((prev) => ({ ...prev }));
      }
    } catch (error) {
      toast.error(t('savingError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrevious = () => {
    const currentIndex = pages.indexOf(currentPage);
    if (currentIndex > 0) {
      setCurrentPage(pages[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    const currentIndex = pages.indexOf(currentPage);
    if (currentIndex < pages.length - 1) {
      setCurrentPage(pages[currentIndex + 1]);
    }
  };

  const handleFinish = async () => {
    if (answeredQuestions < totalQuestions) {
      toast.error(t('allQuestionsRequired'));

      return;
    }

    setIsFinishing(true);

    try {
      const result = await finishVotingAction(pollId);

      if (result.success) {
        toast.success(t('votingComplete'));
        router.push('/polls');
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(t('finishingError'));
    } finally {
      setIsFinishing(false);
    }
  };

  const isFirstPage = currentPage === pages[0];
  const isLastPage = currentPage === pages[pages.length - 1];
  const canFinish = answeredQuestions === totalQuestions && !isSaving;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <VotingProgress
        current={answeredQuestions}
        total={totalQuestions}
        percentage={progressPercentage}
        pages={pages}
        currentPage={currentPage}
        onPageClick={setCurrentPage}
      />

      {/* Questions for current page */}
      <div className="space-y-8">
        {currentQuestions
          .sort((a, b) => a.order - b.order)
          .map((question) => (
            <VotingQuestion
              key={question.id}
              question={question}
              selectedAnswers={drafts[question.id] || []}
              onAnswerSelect={(answerId) =>
                handleAnswerSelect(
                  question.id,
                  answerId,
                  question.questionType === 'single-choice'
                )
              }
              disabled={isSaving || isFinishing}
            />
          ))}
      </div>

      {/* Navigation Controls */}
      <VotingControls
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
        canFinish={canFinish}
        isSaving={isSaving}
        isFinishing={isFinishing}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onFinish={handleFinish}
      />
    </div>
  );
}
