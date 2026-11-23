# Poll State Machine Refactor

## Summary

Replace `active`/`finished` boolean flags with a `state` enum. Separate snapshot creation from activation to allow participant modifications before voting opens.

## States

```
draft → ready → active → finished
```

- **draft**: initial state, freely editable
- **ready**: snapshot taken, awaiting activation
- **active**: voting open
- **finished**: voting closed

## Transitions

| From   | To       | Condition                       |
| ------ | -------- | ------------------------------- |
| draft  | ready    | take snapshot                   |
| ready  | draft    | discard snapshot (0 votes only) |
| ready  | active   | open voting                     |
| active | ready    | pause/deactivate                |
| active | finished | close voting                    |

## Rules

- First vote freezes snapshot permanently (no participant changes ever after)
- `ready → draft` blocked if any votes exist
- Questions editable only if 0 votes (existing rule)
- Participants hidden from voters until `active` state

## Schema Changes

### Prisma

```prisma
enum PollState {
  DRAFT
  READY
  ACTIVE
  FINISHED
}

model Poll {
  // remove: active Boolean, finished Boolean
  state PollState @default(DRAFT)
  // ... rest unchanged
}
```

## Implementation Phases (TDD)

### Phase 1: Domain Types

- [x] Create `PollState` enum in domain

### Phase 2: Domain Tests & Implementation

- [x] Write failing tests for Poll entity state transitions
- [x] Update `Poll` entity: replace `active`/`finished` with `state`
- [x] Make tests pass

### Phase 3: Schema

- [x] Update Prisma schema (add PollState enum, remove active/finished)
- [x] Run migration
- [x] Update PrismaPollRepository for new state field

### Phase 4: Use Case Tests & Implementation

- [x] Write failing tests for `TakeSnapshotUseCase` (draft → ready)
- [x] Implement `TakeSnapshotUseCase`
- [x] Simplify `ActivatePollUseCase` (now only ready → active)
- [x] Implement `DiscardSnapshotUseCase` (ready → draft, 0 votes only)
- [x] Update `DeactivatePollUseCase` tests & impl (active → ready)
- [x] Update `FinishPollUseCase` tests & impl (active → finished)
- [x] Update participant modification logic (canModifyParticipants)
- [x] Fix all test files to use new state machine
- [x] Fix infrastructure repositories (PrismaPollRepository, PrismaParticipantRepository)
- [x] Fix web actions (poll.ts, vote.ts)

### Phase 5: Actions & UI

- [x] Update server actions for new state machine (takeSnapshotAction, discardSnapshotAction)
- [x] Update poll management UI with new state buttons (PollControls, PollCard)
- [x] Update EditPollForm to use state instead of isActive/isFinished
- [x] Add localization strings (en.json, ru.json)

## Questions

None - all clarified.
