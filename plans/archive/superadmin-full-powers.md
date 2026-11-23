# Superadmin: full org-admin powers + cross-org poll access

## Phase 1: Poll content editing — superadmin bypass [x]

Use cases updated with "creator OR superadmin" auth:

- UpdatePollUseCase
- AddQuestionUseCase (added userId to input)
- UpdateQuestionUseCase
- DeleteQuestionUseCase
- UpdateQuestionOrderUseCase (added userId to input)
- CreateAnswerUseCase
- UpdateAnswerUseCase
- DeleteAnswerUseCase

Web action updated: canEditPollAction

## Phase 2: Poll participant management — superadmin bypass [x]

Use cases needing "org admin OR superadmin" auth:

- GetParticipantsUseCase
- RemoveParticipantUseCase
- UpdateParticipantWeightUseCase
- GetWeightHistoryUseCase

## Phase 3: Organization management — superadmin bypass [x]

- HandleJoinRequestUseCase
- GetOrganizationPendingRequestsUseCase
- GetOrganizationDetailsUseCase

## Phase 4: Web actions — superadmin poll visibility [x]

- getPollByIdAction
- getPollsByBoardIdAction
