'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/src/web/components/catalyst/badge';
import VoterBreakdownDialog from './VoterBreakdownDialog';
import ExportPdfButton from './ExportPdfButton';
import ExportProtocolPdfButton from './ExportProtocolPdfButton';
import { PollState } from '@/src/domain/poll/PollState';
import { User } from '@/domain/user/User';
import type { QuestionType } from '@/src/domain/poll/QuestionType';

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
  questionType: QuestionType;
  totalVotes: number;
  totalWeight: number;
  participantWeight: number;
  answers: AnswerResult[];
}

interface ProtocolSignWillingnessEntry {
  userId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  willingToSignProtocol: boolean;
}

interface PollResultsData {
  pollId: string;
  totalParticipants: number;
  totalWeight: number;
  votedParticipants: number;
  questions: QuestionResult[];
  protocolSignWillingness: ProtocolSignWillingnessEntry[];
}

interface PollResultsProps {
  results: PollResultsData;
  pollState: PollState;
  isPollCreator: boolean;
  canViewVoters: boolean;
  // Theoretical max Σ weights if every owner were registered. 0 for EQUAL
  // polls — the UI then collapses Building/Registered into a single number.
  buildingTotal: number;
}

export default function PollResults({
  results,
  pollState,
  isPollCreator,
  canViewVoters,
  buildingTotal,
}: PollResultsProps) {
  const isActive = pollState === 'ACTIVE';
  const isFinished = pollState === 'FINISHED';
  const t = useTranslations('poll.results');
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerResult | null>(
    null
  );
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [protocolOpen, setProtocolOpen] = useState(false);

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
              {buildingTotal > 0 ? t('registeredOfBuilding') : t('totalWeight')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
              {buildingTotal > 0
                ? `${results.totalWeight.toFixed(2)} / ${buildingTotal.toFixed(2)}`
                : results.totalWeight.toFixed(2)}
            </div>
            {buildingTotal > 0 && (
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {`${((results.totalWeight / buildingTotal) * 100).toFixed(2)}% ${t('ofBuilding')}`}
              </div>
            )}
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

        {/* Export PDF button — only for finished polls */}
        {isFinished && (
          <div className="flex justify-end">
            <ExportPdfButton pollId={results.pollId} />
          </div>
        )}

        {/* Question results */}
        {results.questions.map((question) => {
          const winner = (() => {
            if (question.questionType !== 'single-choice') {
              return null;
            }

            if (question.answers.length === 0) {
              return null;
            }

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
                  {buildingTotal > 0 && (
                    <span>
                      {t('participation')}:{' '}
                      {question.participantWeight.toFixed(2)}{' '}
                      {`(${((question.participantWeight / buildingTotal) * 100).toFixed(2)}% ${t('ofBuilding')})`}
                    </span>
                  )}
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
                        <div className="text-2xl font-semibold text-zinc-900 dark:text-white">
                          {answer.percentage.toFixed(1)}%
                        </div>
                      </div>

                      {canViewVoters && answer.voteCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleViewVoters(answer)}
                          className="mb-2 w-full text-left text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
                        >
                          {t('viewVoters')} &rarr;
                        </button>
                      )}

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

        {/* Protocol sign willingness section (admin only) */}
        {canViewVoters && results.protocolSignWillingness.length > 0 && (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6">
              <button
                type="button"
                onClick={() => setProtocolOpen(!protocolOpen)}
                className="flex flex-wrap items-center gap-3 text-left cursor-pointer"
              >
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {t('protocolSignWillingness')}
                </h3>
                <Badge color="green">
                  {t('willingToSignProtocolCount', {
                    count: results.protocolSignWillingness.filter(
                      (p) => p.willingToSignProtocol
                    ).length,
                  })}
                </Badge>
                <Badge color="red">
                  {t('protocolNotWillingCount', {
                    count: results.protocolSignWillingness.filter(
                      (p) => !p.willingToSignProtocol
                    ).length,
                  })}
                </Badge>
                <svg
                  className={`h-5 w-5 text-zinc-500 transition-transform ${protocolOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </button>
              <ExportProtocolPdfButton pollId={results.pollId} />
            </div>

            {protocolOpen && (
              <div className="px-6 pb-6 space-y-4">
                {/* Willing */}
                {results.protocolSignWillingness.some(
                  (p) => p.willingToSignProtocol
                ) && (
                  <div>
                    <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                      {t('willingToSignProtocol')}
                    </h4>
                    <ul className="space-y-1">
                      {results.protocolSignWillingness
                        .filter((p) => p.willingToSignProtocol)
                        .map((p) => (
                          <li
                            key={p.userId}
                            className="text-sm text-zinc-700 dark:text-zinc-300"
                          >
                            {User.formatFullName(
                              p.firstName,
                              p.lastName,
                              p.middleName
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {/* Not willing */}
                {results.protocolSignWillingness.some(
                  (p) => !p.willingToSignProtocol
                ) && (
                  <div>
                    <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                      {t('protocolNotWilling')}
                    </h4>
                    <ul className="space-y-1">
                      {results.protocolSignWillingness
                        .filter((p) => !p.willingToSignProtocol)
                        .map((p) => (
                          <li
                            key={p.userId}
                            className="text-sm text-zinc-700 dark:text-zinc-300"
                          >
                            {User.formatFullName(
                              p.firstName,
                              p.lastName,
                              p.middleName
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
