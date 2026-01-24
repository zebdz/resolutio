'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/app/components/catalyst/badge';
import VoterBreakdownDialog from './VoterBreakdownDialog';
import { Button } from '@/app/components/catalyst/button';

interface AnswerResult {
  answerId: string;
  answerText: string;
  voteCount: number;
  weightedVotes: number;
  percentage: number;
  voters: {
    userId: string;
    userName: string;
    weight: number;
  }[];
}

interface QuestionResult {
  questionId: string;
  questionText: string;
  questionType: 'single-choice' | 'multiple-choice';
  totalVotes: number;
  totalWeight: number;
  answers: AnswerResult[];
}

interface PollResultsData {
  pollId: string;
  totalParticipants: number;
  totalWeight: number;
  votedParticipants: number;
  questions: QuestionResult[];
}

interface PollResultsProps {
  results: PollResultsData;
  isActive: boolean;
  isFinished: boolean;
  isPollCreator: boolean;
  canViewVoters: boolean;
}

export default function PollResults({
  results,
  isActive,
  isFinished,
  isPollCreator,
  canViewVoters,
}: PollResultsProps) {
  const t = useTranslations('poll.results');
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerResult | null>(
    null
  );
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const handleViewVoters = (answer: AnswerResult) => {
    setSelectedAnswer(answer);
    setBreakdownOpen(true);
  };

  if (results.questions.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-900 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">{t('noVotesYet')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('totalParticipants')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
              {results.votedParticipants} / {results.totalParticipants}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('totalWeight')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
              {results.totalWeight.toFixed(2)}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('status')}
            </div>
            <div className="mt-1">
              <Badge
                color={isFinished ? 'zinc' : isActive ? 'green' : 'yellow'}
              >
                {isFinished
                  ? t('finished')
                  : isActive
                    ? t('active')
                    : t('upcoming')}
              </Badge>
            </div>
          </div>
        </div>

        {/* Question results */}
        {results.questions.map((question) => {
          const winner = (() => {
            if (question.questionType !== 'single-choice') return null;
            if (question.answers.length === 0) return null;

            const maxVotes = Math.max(
              ...question.answers.map((a) => a.weightedVotes)
            );
            const topAnswers = question.answers.filter(
              (a) => a.weightedVotes === maxVotes
            );

            return topAnswers.length === 1 ? topAnswers[0] : null;
          })();

          return (
            <div
              key={question.questionId}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-900"
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {question.questionText}
                </h3>
                <div className="mt-2 flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                  <span>
                    {t('votes')}: {question.totalVotes}
                  </span>
                  <span>
                    {t('voteWeight')}: {question.totalWeight.toFixed(2)}
                  </span>
                  <Badge color="zinc">
                    {question.questionType === 'single-choice'
                      ? t('singleChoice')
                      : t('multipleChoice')}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                {question.answers.map((answer) => {
                  const isWinner =
                    winner && answer.answerId === winner.answerId;

                  return (
                    <div
                      key={answer.answerId}
                      className={`p-4 rounded-lg border ${
                        isWinner
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                          : 'border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-900 dark:text-white">
                              {answer.answerText}
                            </span>
                            {isWinner && (
                              <Badge color="green">{t('winner')}</Badge>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            {answer.voteCount} {t('votes')} (
                            {answer.weightedVotes.toFixed(2)} {t('voteWeight')})
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-zinc-900 dark:text-white">
                            {answer.percentage.toFixed(1)}%
                          </div>
                          {canViewVoters && answer.voteCount > 0 && (
                            <Button
                              type="button"
                              color="zinc"
                              onClick={() => handleViewVoters(answer)}
                              className="mt-2 text-xs"
                            >
                              {t('viewVoters')}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isWinner
                              ? 'bg-green-600 dark:bg-green-500'
                              : 'bg-blue-600 dark:bg-blue-500'
                          }`}
                          style={{ width: `${answer.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!isFinished && canViewVoters && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-700 p-4 bg-amber-50 dark:bg-amber-950/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t('adminOnly')}
            </p>
          </div>
        )}
      </div>

      {/* Voter breakdown dialog */}
      {selectedAnswer && (
        <VoterBreakdownDialog
          isOpen={breakdownOpen}
          onClose={() => setBreakdownOpen(false)}
          answer={selectedAnswer}
        />
      )}
    </>
  );
}
