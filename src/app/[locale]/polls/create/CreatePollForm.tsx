'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import {
  Description,
  Field,
  Label,
} from '@/src/web/components/catalyst/fieldset';
import { Select } from '@/src/web/components/catalyst/select';
import { Switch, SwitchField } from '@/src/web/components/catalyst/switch';
import { PollSidebar } from '@/src/web/components/polls/draft/PollSidebar';
import { QuestionForm } from '@/src/web/components/polls/draft/QuestionForm';
import { Link } from '@/src/i18n/routing';
import { PlusIcon } from '@heroicons/react/20/solid';
import { QuestionType } from '@/domain/poll/QuestionType';
import {
  createPollAction,
  updatePollAction,
  updatePollWeightConfigAction,
  addQuestionAction,
} from '@/src/web/actions/poll/poll';
import { getUserBoardsAction } from '@/src/web/actions/board/board';
import {
  getUserMemberOrganizationsAction,
  getAdminOrganizationsAction,
  getOrgPropertiesTreeAction,
  getOrgOwnershipStatusAction,
} from '@/src/web/actions/organization/organization';
import { DistributionTypeSelector } from '@/src/web/components/polls/participants/DistributionTypeSelector';
import { PropertyScopeSelector } from '@/src/web/components/polls/participants/PropertyScopeSelector';
import { PropertyAggregationSelector } from '@/src/web/components/polls/participants/PropertyAggregationSelector';
import { MarkdownEditor } from '@/web/components/markdown/MarkdownEditor';
import { SaveDraftBeforeAttachModal } from '@/web/components/polls/SaveDraftBeforeAttachModal';
import { POLL_ATTACHMENT_API_PREFIX } from '@/domain/poll/PollAttachment';
import { POLL_DESCRIPTION_MAX_LENGTH } from '@/domain/poll/Poll';
import { PollAttachmentUploader } from '@/web/components/polls/PollAttachmentUploader';
import {
  listPollAttachmentsAction,
  removePollAttachmentAction,
  type PollAttachmentSummary,
} from '@/web/actions/poll/pollAttachments';
import { buildAttachmentRef } from '@/web/components/markdown/buildAttachmentRef';
import { removeAttachmentRefs } from '@/web/components/markdown/removeAttachmentRefs';

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
  organizationId: string;
  boardId: string;
  startDate: string;
  endDate: string;
}

export function CreatePollForm() {
  const router = useRouter();
  const t = useTranslations('poll');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [organizations, setOrganizations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [boards, setBoards] = useState<
    Array<{
      id: string;
      name: string;
      organizationId: string;
      organizationName: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // An open poll is voted on by every verified platform user, always at
  // weight 1 — it has no board scope and no weight configuration.
  const [pollType, setPollType] = useState<'ORGANIZATION' | 'OPEN'>(
    'ORGANIZATION'
  );
  const isOpenPoll = pollType === 'OPEN';

  // Opt-in secrecy. Named is the default: the org reads who voted for what
  // while the poll runs. Immutable after creation, so this is the only place
  // it is ever set.
  const [anonymous, setAnonymous] = useState(false);

  // Weight config state
  const [distributionType, setDistributionType] = useState<
    'EQUAL' | 'OWNERSHIP_UNIT_COUNT' | 'OWNERSHIP_SIZE_WEIGHTED'
  >('EQUAL');
  const [propertyAggregation, setPropertyAggregation] = useState<
    'RAW_SUM' | 'NORMALIZE_PER_PROPERTY'
  >('RAW_SUM');
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [properties, setProperties] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [descendantGroups, setDescendantGroups] = useState<
    Array<{
      orgId: string;
      orgName: string;
      properties: Array<{ id: string; name: string }>;
    }>
  >([]);
  const [orgHasOwnershipData, setOrgHasOwnershipData] = useState(false);
  const [userHasOwnership, setUserHasOwnership] = useState(false);
  const [adminOrgIds, setAdminOrgIds] = useState<Set<string>>(new Set());

  // Merge direct org memberships with orgs derived from board memberships
  const allOrganizations = useMemo(() => {
    const orgIds = new Set(organizations.map((o) => o.id));
    const boardOrgs = boards
      .filter((b) => !orgIds.has(b.organizationId))
      .map((b) => ({ id: b.organizationId, name: b.organizationName }));
    const uniqueBoardOrgs = boardOrgs.filter(
      (org, i, arr) => arr.findIndex((o) => o.id === org.id) === i
    );

    return [...organizations, ...uniqueBoardOrgs];
  }, [organizations, boards]);

  const [pollData, setPollData] = useState<PollData>({
    title: '',
    description: '',
    organizationId: '',
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
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >();
  const [questionFieldErrors, setQuestionFieldErrors] = useState<{
    questionId: string;
    errors: Record<string, string[]>;
  } | null>(null);

  // Captured once, when a save is rejected for length — not recomputed as the
  // author types. Cleared on the next save attempt.
  const [descriptionLengthAtError, setDescriptionLengthAtError] = useState<
    number | null
  >(null);

  // Single place where field errors land, so the length snapshot cannot be
  // forgotten on one of the save paths.
  const applyFieldErrors = (errors?: Record<string, string[]>) => {
    setFieldErrors(errors);
    setDescriptionLengthAtError(
      errors?.description ? pollData.description.length : null
    );
  };

  // Deferred-attachment state. A poll row must exist before a file can be
  // linked to it, so the first upload attempt on an unsaved poll parks the
  // file here, opens the modal, and resolves once a draft has been saved.
  const [draftPollId, setDraftPollId] = useState<string | null>(null);
  // Mirrors draftPollId for async callbacks: handlePickAttachment is created
  // before the modal saves the draft, so reading the state after an await
  // would still see null.
  const draftPollIdRef = useRef<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  const pendingResolveRef = useRef<
    ((r: { id: string } | { error: string }) => void) | null
  >(null);

  const [attachments, setAttachments] = useState<PollAttachmentSummary[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<
    string | null
  >(null);

  const refreshAttachments = async (pollId: string) => {
    const result = await listPollAttachmentsAction(pollId);

    if (result.success) {
      setAttachments(result.data);
    }
  };

  // Routes through handleUploadAttachment, so an unsaved poll still gets the
  // draft-save modal before the file is linked.
  const handlePickAttachment = async (file: File) => {
    setUploadingAttachment(true);

    const result = await handleUploadAttachment(file);

    setUploadingAttachment(false);

    if ('id' in result) {
      setPollData((prev) => ({
        ...prev,
        description:
          prev.description +
          buildAttachmentRef({
            fileName: file.name,
            mimeType: file.type,
            apiPrefix: POLL_ATTACHMENT_API_PREFIX,
            id: result.id,
          }),
      }));

      // draftPollId is set by the modal flow before the upload resolves.
      const owner = draftPollIdRef.current;

      if (owner) {
        await refreshAttachments(owner);
      }
    }
  };

  const handleRemoveAttachment = async (id: string) => {
    setRemovingAttachmentId(id);
    setAttachmentError(null);

    const result = await removePollAttachmentAction(id);

    setRemovingAttachmentId(null);

    if (!result.success) {
      setAttachmentError(result.error);

      return;
    }

    setPollData((prev) => ({
      ...prev,
      description: removeAttachmentRefs(
        prev.description,
        POLL_ATTACHMENT_API_PREFIX,
        id
      ),
    }));

    if (draftPollIdRef.current) {
      await refreshAttachments(draftPollIdRef.current);
    }
  };

  // Once the poll row exists, poll type, anonymity, organization and board can
  // no longer change: `anonymous` is set once at creation by design and the
  // others have no update path. Locking the controls is honest about that;
  // leaving them editable would silently discard the author's choice on save.
  const draftSaved = draftPollId !== null;

  const uploadAttachment = async (
    pollId: string,
    file: File
  ): Promise<{ id: string } | { error: string }> => {
    setAttachmentError(null);

    const formData = new FormData();
    formData.append('pollId', pollId);
    formData.append('file', file);

    try {
      const res = await fetch('/api/poll-attachments', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        const message = json.error ?? tCommon('generic');
        setAttachmentError(message);

        return { error: message };
      }

      return { id: json.id as string };
    } catch {
      setAttachmentError(tCommon('generic'));

      return { error: tCommon('generic') };
    }
  };

  const handleUploadAttachment = (
    file: File
  ): Promise<{ id: string } | { error: string }> => {
    if (draftPollId) {
      return uploadAttachment(draftPollId, file);
    }

    // No poll id yet — hold the file, open the modal, and resolve this promise
    // once the draft has been saved or the author has cancelled.
    return new Promise((resolve) => {
      pendingFileRef.current = file;
      pendingResolveRef.current = resolve;
      setDraftError(null);
      setModalOpen(true);
    });
  };

  // Load organizations and boards
  useEffect(() => {
    async function loadData() {
      try {
        const [orgsResult, boardsResult, adminOrgsResult] = await Promise.all([
          getUserMemberOrganizationsAction(),
          getUserBoardsAction(),
          getAdminOrganizationsAction(),
        ]);

        if (orgsResult.success) {
          setOrganizations(orgsResult.data);
        } else {
          setError(orgsResult.error);
        }

        if (boardsResult.success) {
          setBoards(boardsResult.data);
        }

        if (adminOrgsResult.success) {
          setAdminOrgIds(
            new Set(adminOrgsResult.data.organizations.map((o) => o.id))
          );
        }
      } catch (err) {
        setError(t('errors.loadOrganizations'));
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first org when allOrganizations becomes available
  useEffect(() => {
    if (allOrganizations.length > 0 && !pollData.organizationId) {
      setPollData((prev) => ({
        ...prev,
        organizationId: allOrganizations[0].id,
      }));
    }
  }, [allOrganizations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch properties + ownership when org selection changes
  useEffect(() => {
    if (!pollData.organizationId) {
      setProperties([]);
      setDescendantGroups([]);
      setOrgHasOwnershipData(false);
      setUserHasOwnership(false);
      setDistributionType('EQUAL');
      setPropertyIds([]);

      return;
    }

    async function loadOrgWeightData() {
      const [treeResult, ownershipResult] = await Promise.all([
        getOrgPropertiesTreeAction(pollData.organizationId),
        getOrgOwnershipStatusAction(pollData.organizationId),
      ]);

      if (treeResult.success) {
        setProperties(treeResult.data.direct);
        setDescendantGroups(treeResult.data.descendantGroups);
      } else {
        setProperties([]);
        setDescendantGroups([]);
      }

      if (ownershipResult.success) {
        setOrgHasOwnershipData(ownershipResult.data.orgHasOwnershipData);
        setUserHasOwnership(ownershipResult.data.userHasOwnership);
      } else {
        setOrgHasOwnershipData(false);
        setUserHasOwnership(false);
      }

      // Reset weight config when org changes
      setDistributionType('EQUAL');
      setPropertyIds([]);
      setPropertyAggregation('RAW_SUM');
    }

    void loadOrgWeightData();
  }, [pollData.organizationId]);

  // Filter boards by selected organization
  const filteredBoards = boards.filter(
    (b) => b.organizationId === pollData.organizationId
  );

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

  // Poll fields shared by the create and update paths. Both the final submit
  // and the just-in-time draft save go through here, so they cannot drift.
  const buildPollFormData = (): FormData => {
    const fd = new FormData();
    fd.append('title', pollData.title);
    fd.append('description', pollData.description);
    fd.append('organizationId', pollData.organizationId);

    if (pollData.boardId) {
      fd.append('boardId', pollData.boardId);
    }

    fd.append('startDate', pollData.startDate);
    fd.append('endDate', pollData.endDate);
    fd.append('pollType', pollType);
    fd.append('anonymous', String(anonymous));
    fd.append('distributionType', distributionType);
    fd.append('propertyAggregation', propertyAggregation);
    fd.append('propertyIds', JSON.stringify(propertyIds));

    return fd;
  };

  type PersistResult =
    | { success: true; pollId: string }
    | { success: false; error: string };

  const persistPoll = async (): Promise<PersistResult> => {
    const result = await createPollAction(buildPollFormData());

    if (!result.success) {
      applyFieldErrors(result.fieldErrors);

      return { success: false, error: result.error };
    }

    return { success: true, pollId: result.data.pollId };
  };

  // The draft already exists, so push the current field values onto it rather
  // than creating a second poll.
  //
  // updatePollAction only persists title, description and dates, so the weight
  // configuration is synced separately — otherwise a weighting chosen after
  // the draft was saved would be silently discarded. Poll type, anonymity,
  // organization and board have no update path at all, which is why the form
  // locks those controls once a draft exists.
  const updateExistingDraft = async (
    pollId: string
  ): Promise<PersistResult> => {
    const fd = buildPollFormData();
    fd.append('pollId', pollId);

    const result = await updatePollAction(fd);

    if (!result.success) {
      applyFieldErrors(result.fieldErrors);

      return { success: false, error: result.error };
    }

    if (!isOpenPoll) {
      const weightResult = await updatePollWeightConfigAction({
        pollId,
        distributionType,
        propertyAggregation,
        propertyIds,
      });

      if (!weightResult.success) {
        return { success: false, error: weightResult.error };
      }
    }

    return { success: true, pollId };
  };

  // Validates only the poll's own fields — a DRAFT with no questions is
  // valid, since POLL_NO_QUESTIONS is enforced on the DRAFT → READY move.
  const validatePollFields = (): string | null => {
    if (!pollData.organizationId) {
      return t('errors.orgRequired');
    }

    if (!pollData.title.trim()) {
      return t('errors.titleRequired');
    }

    if (!pollData.description.trim()) {
      return t('errors.descriptionRequired');
    }

    return null;
  };

  const handleSaveDraftForAttachment = async () => {
    setSavingDraft(true);
    setDraftError(null);

    const invalid = validatePollFields();

    if (invalid) {
      // Keep the modal open so the author can see which field is missing.
      setDraftError(invalid);
      setSavingDraft(false);

      return;
    }

    const persisted = await persistPoll();

    setSavingDraft(false);

    if (!persisted.success) {
      setDraftError(persisted.error);

      return;
    }

    draftPollIdRef.current = persisted.pollId;
    setDraftPollId(persisted.pollId);
    setModalOpen(false);

    const file = pendingFileRef.current;
    const resolve = pendingResolveRef.current;
    pendingFileRef.current = null;
    pendingResolveRef.current = null;

    if (file && resolve) {
      resolve(await uploadAttachment(persisted.pollId, file));
    }
  };

  const handleCancelDraft = () => {
    setModalOpen(false);

    const resolve = pendingResolveRef.current;
    pendingFileRef.current = null;
    pendingResolveRef.current = null;

    // Resolving with an error means the editor inserts no ref, so the pasted
    // file simply does not appear.
    resolve?.({ error: '' });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      applyFieldErrors(undefined);
      setQuestionFieldErrors(null);

      // Validate
      if (!pollData.organizationId) {
        setError(t('errors.orgRequired'));

        return;
      }

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

      // If a draft was already saved to host an attachment, update that poll
      // rather than creating a second one.
      const persisted = draftPollId
        ? await updateExistingDraft(draftPollId)
        : await persistPoll();

      if (!persisted.success) {
        setError(persisted.error);

        return;
      }

      const pollId = persisted.pollId;

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
          if (questionResult.fieldErrors) {
            const uniqueMessages = [
              ...new Set(
                Object.values(questionResult.fieldErrors).flatMap(
                  (msgs) => msgs
                )
              ),
            ];
            setError(uniqueMessages.join('; '));

            // Remap answers.N indices from filtered array back to original
            const remappedErrors: Record<string, string[]> = {};
            const originalAnswers = question.answers || [];
            const validIndices = originalAnswers
              .map((a, i) => (a.text.trim() ? i : -1))
              .filter((i) => i !== -1);

            for (const [key, msgs] of Object.entries(
              questionResult.fieldErrors
            )) {
              const match = key.match(/^answers\.(\d+)$/);

              if (match) {
                const filteredIdx = parseInt(match[1], 10);
                const originalIdx = validIndices[filteredIdx];

                if (originalIdx !== undefined) {
                  remappedErrors[`answers.${originalIdx}`] = msgs;
                } else {
                  remappedErrors[key] = msgs;
                }
              } else {
                remappedErrors[key] = msgs;
              }
            }

            setQuestionFieldErrors({
              questionId: question.id,
              errors: remappedErrors,
            });
            setActiveQuestionId(question.id);
          } else {
            setError(questionResult.error);
          }

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Heading className="text-3xl font-bold">{t('createPoll')}</Heading>
        <div className="p-12 text-center text-zinc-500 dark:text-zinc-400">
          {t('loadingOrganizations')}
        </div>
      </div>
    );
  }

  if (organizations.length === 0 && boards.length === 0) {
    return (
      <div className="space-y-6">
        <Heading className="text-3xl font-bold">{t('createPoll')}</Heading>
        <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-lg text-zinc-500 dark:text-zinc-400">
            {t('noMembership')}
          </p>
          <Link
            href="/organizations"
            className="mt-4 inline-block rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
          >
            {t('browseOrganizations')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Heading className="text-3xl font-bold">{t('createPoll')}</Heading>
        <div className="flex gap-2">
          <Button
            color="zinc"
            onClick={() => router.back()}
            disabled={isSaving}
          >
            {t('cancel')}
          </Button>
          <Button color="brand-green" onClick={handleSave} disabled={isSaving}>
            {isSaving ? tCommon('saving') : t('save')}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && !fieldErrors && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Poll Basic Info */}
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
        {draftSaved && (
          <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {t('saveDraftModal.lockedAfterDraft')}
          </p>
        )}

        <Field>
          <Label>{t('type.label')}</Label>
          <Select
            name="pollType"
            value={pollType}
            disabled={draftSaved}
            onChange={(e) => {
              const next = e.target.value as 'ORGANIZATION' | 'OPEN';
              setPollType(next);

              // Open polls are org-wide and always equal-weight; drop any
              // board or weight choices made before the switch.
              if (next === 'OPEN') {
                setPollData((prev) => ({ ...prev, boardId: '' }));
                setDistributionType('EQUAL');
                setPropertyAggregation('RAW_SUM');
                setPropertyIds([]);
              }
            }}
          >
            <option value="ORGANIZATION">{t('type.organization')}</option>
            <option value="OPEN">{t('type.open')}</option>
          </Select>
          {isOpenPoll && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {t('type.openExplainer')}
            </p>
          )}
        </Field>

        <SwitchField>
          <Label>{t('anonymous.label')}</Label>
          <Description>{t('anonymous.description')}</Description>
          <Switch
            name="anonymous"
            checked={anonymous}
            onChange={setAnonymous}
            disabled={draftSaved}
          />
        </SwitchField>

        <Field>
          <Label>{t('selectOrganization')}</Label>
          <Select
            name="organizationId"
            value={pollData.organizationId}
            onChange={(e) =>
              setPollData({
                ...pollData,
                organizationId: e.target.value,
                boardId: '',
              })
            }
            disabled={isLoading || allOrganizations.length === 0 || draftSaved}
            required
          >
            {isLoading ? (
              <option value="">{t('loadingOrganizations')}</option>
            ) : allOrganizations.length === 0 ? (
              <option value="">{t('noOrganizationsAvailable')}</option>
            ) : (
              <>
                <option value="">{t('selectAnOrganization')}</option>
                {allOrganizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </>
            )}
          </Select>
        </Field>

        {!isOpenPoll && (
          <Field>
            <Label>{t('selectBoard')}</Label>
            <Select
              name="boardId"
              value={pollData.boardId}
              onChange={(e) =>
                setPollData({ ...pollData, boardId: e.target.value })
              }
              disabled={isLoading || !pollData.organizationId || draftSaved}
            >
              <option value="">{t('orgWidePoll')}</option>
              {filteredBoards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

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
          <MarkdownEditor
            value={pollData.description}
            onChange={(next) => {
              setPollData({ ...pollData, description: next });
              setFieldErrors(undefined);
            }}
            apiPrefix={POLL_ATTACHMENT_API_PREFIX}
            maxLength={POLL_DESCRIPTION_MAX_LENGTH}
            onUploadAttachment={handleUploadAttachment}
          />
          {fieldErrors?.description && (
            <p className="text-sm text-red-600">{fieldErrors.description[0]}</p>
          )}
          {descriptionLengthAtError !== null && (
            <p className="text-sm text-red-600">
              {t('descriptionCharacterCount', {
                current: descriptionLengthAtError.toLocaleString(locale),
                max: POLL_DESCRIPTION_MAX_LENGTH.toLocaleString(locale),
              })}
            </p>
          )}
          <PollAttachmentUploader
            attachments={attachments}
            uploading={uploadingAttachment}
            removingId={removingAttachmentId}
            error={attachmentError}
            onPickFile={handlePickAttachment}
            onRemove={handleRemoveAttachment}
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

      {/* Weight distribution section — only if org has ownership data or user
          is admin. Open polls are fixed at one person, one vote. */}
      {!isOpenPoll &&
        (userHasOwnership || adminOrgIds.has(pollData.organizationId)) &&
        pollData.organizationId && (
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              {t('distribution.label')}
            </h3>
            <DistributionTypeSelector
              value={distributionType}
              onChange={setDistributionType}
              ownershipDisabledReason={
                !orgHasOwnershipData
                  ? t('distribution.ownershipOptionDisabledTooltip')
                  : null
              }
            />
            {(properties.length >= 2 ||
              descendantGroups.some((g) => g.properties.length > 0)) && (
              <PropertyScopeSelector
                properties={properties}
                descendantGroups={descendantGroups}
                selectedIds={propertyIds}
                onChange={setPropertyIds}
                mode={distributionType === 'EQUAL' ? 'equal' : 'ownership'}
              />
            )}
            <PropertyAggregationSelector
              value={propertyAggregation}
              onChange={setPropertyAggregation}
              visible={
                (distributionType === 'OWNERSHIP_UNIT_COUNT' ||
                  distributionType === 'OWNERSHIP_SIZE_WEIGHTED') &&
                (propertyIds.length === 0
                  ? properties.length +
                    descendantGroups.reduce(
                      (sum, g) => sum + g.properties.length,
                      0
                    )
                  : propertyIds.length) >= 2
              }
            />
          </div>
        )}

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
              fieldErrors={
                questionFieldErrors?.questionId === activeQuestion.id
                  ? questionFieldErrors.errors
                  : undefined
              }
            />
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
                {t('selectQuestionToEdit')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Save Button */}
      <div className="flex justify-end gap-2">
        <Button color="zinc" onClick={() => router.back()} disabled={isSaving}>
          {t('cancel')}
        </Button>
        <Button color="brand-green" onClick={handleSave} disabled={isSaving}>
          {isSaving ? tCommon('saving') : t('save')}
        </Button>
      </div>

      <SaveDraftBeforeAttachModal
        open={modalOpen}
        saving={savingDraft}
        error={draftError}
        onSave={handleSaveDraftForAttachment}
        onCancel={handleCancelDraft}
      />
    </div>
  );
}
