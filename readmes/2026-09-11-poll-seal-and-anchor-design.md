# Poll seal and blockchain anchor — design

**Date:** 2026-09-11
**Status:** decisions resolved; Phases 1–2 complete (2026-10-26). Phase 2 awaiting review; sealing integration not started.
**Reviewed:** 2026-10-25 against the current implementation

## 1. Problem

A finished poll produces documents people take to court and to officials. Today nothing binds those
documents to the data behind them:

- All three protocol PDFs are generated on demand, each with a fresh generation date, so no two
  downloads are byte-identical and there is no canonical artifact.
- Votes are frozen after `FINISHED` by policy only (`PollVotingPolicy` refuses them). Anyone with
  database credentials can rewrite a vote row and nothing would show it.
- A voter has no way to confirm later that the vote they cast is the vote that was counted.
- The platform has no answer to the objection "the operator could have altered this after the fact".

Three goals, all wanted:

1. **Tamper evidence.** Alteration of a finished poll's record after the fact must be detectable by
   anyone holding a copy of the proof, the operator included in the threat model.
2. **Voter verifiability.** Every voter can prove their own vote is inside the sealed record, without
   learning anyone else's vote.
3. **Trust signal.** A public, no-login page per poll shows the record is sealed and anchored in
   Bitcoin, with a recipe to verify it independently.

An anchor proves that the committed bytes existed no later than the Bitcoin timestamp. It does not
prove that a ballot was authorized, a tally was calculated correctly, or the poll actually finished at
the claimed `finishedAt`. Inclusion of a voter's original receipt and consistency of disclosed
sections are separate checks. See [OpenTimestamps](https://opentimestamps.org/#how-it-works).

## 2. Ubiquitous language

| Term                                     | Meaning                                                                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **seal** (RU: _цифровая печать_)         | The immutable canonical record of a finished poll, reduced to one root digest.                                                                                               |
| **sealed record**                        | The manifest plus its five sections. What the seal commits to.                                                                                                               |
| **manifest**                             | Small JSON listing the hash of every section. Its hash is the root digest.                                                                                                   |
| **root digest** (RU: _контрольный хеш_)  | `sha256` of the canonical manifest. The one value that is anchored.                                                                                                          |
| **section**                              | A separately disclosable part of the record: `poll`, `tallies`, `register`, `signers`, `votes`.                                                                              |
| **vote leaf**                            | Hash of one vote row plus a secret salt. Leaves form the `votes` Merkle tree.                                                                                                |
| **anchor** (RU: _фиксация в блокчейне_)  | An OpenTimestamps proof tying a root digest to a Bitcoin block.                                                                                                              |
| **receipt** (RU: _квитанция голоса_)     | The cast-time record retained by the voter: secret code, original leaf preimages and hashes, and chosen answer texts. The code alone is not evidence of the original ballot. |
| **bundle**                               | Everything one party needs to verify without us: manifest, allowed sections or leaves, proof.                                                                                |
| **verify** (RU: _проверить подлинность_) | Recompute hashes from a bundle and compare them with the anchored root digest.                                                                                               |

Russian wording confirmed on 2026-09-11.

## 3. Decisions

### 3.1 Settled choices

- **OpenTimestamps on Bitcoin** is the anchor backend. Free, no wallet, no key on the VPS, nothing to
  fund, offline-verifiable proofs. Latency of hours is acceptable. Spike on 2026-09-11: all four public
  calendars and both block explorers reachable from the dev machine and from the production VPS in under
  two seconds; `opentimestamps@0.4.9` stamped and reported "pending" cleanly. The client is slow-moving
  (last release January 2021), so it lives behind our own port.
- **Anonymous polls are sealed too**, with the same structure as named polls. The manifest-plus-sections
  shape exists precisely so each viewer verifies only what the existing results policy lets them see.
- **Public verification page shows hashes only.** Root digest, section hashes, anchor status, proof file.
  Record contents download only under `PollResultsPolicy`. No org poll leaks to the world.
- **Sealing is eventually consistent with finishing.** `Poll` and `PollSeal` are separate aggregates,
  one transaction each. Vote acceptance and finishing serialize on the poll row; a policy check
  before a later insert is insufficient (§5.3). Names and other external metadata are captured by
  the successful sealing attempt, not when the poll finishes. A successfully saved seal is always
  read from its immutable snapshot, never rebuilt from current joins. An unsuccessful attempt may
  read newer metadata on retry; `metadataCapturedAt` makes that timing explicit.
- **Domain events without an event bus.** `Poll.finish()` raises `PollFinished`; the application
  dispatches it after the poll transaction commits to explicit sealing and notification handlers.
  Recovery reconciles persisted state if the process stops before dispatch (§5.3). No broker or
  general-purpose event bus is introduced.
- **Archived questions and answers are included** in the `poll` section with their `archivedAt`. They
  are hidden from tallies and protocols exactly as today; including them forecloses the claim that a
  question was quietly dropped. Removal is refused while submitted, active, or finished, so no vote can
  reference an archived answer.
- **One receipt secret per participant per poll**, created in the same transaction as the votes. Leaf
  salts derive from it, so the voter holds one code. The secret is also stored, so in-app verification
  can check inclusion of the current record for a voter who saved nothing. Detecting a pre-seal
  rewrite requires comparison with the original downloaded or emailed receipt; the operator knows
  the secret too.
- **Receipts and bundles go out by email** when the user has a confirmed email. No SMS.
- **Bundle emails go out when a seal has its first usable proof**, including after recovery from a
  failed build or submission. A pending proof can be upgraded if the calendars subsequently supply
  its Bitcoin attestation; it is not yet a confirmed anchor. The confirmed proof is downloadable later.
- **Polls finished before this ships are never sealed.** A late anchor would carry a misleading time.
  `polls.finished_at` marks polls eligible for sealing.
- **`@noble/hashes`** provides synchronous SHA-256 and HMAC in Node and the browser; the same domain
  code verifies on both sides. `opentimestamps` is also a new dependency, isolated behind its port.
- **Immutability triggers** on `votes` and `poll_seals`. Not prevention against a superuser, but casual
  updates and deletes are rejected. The bypass is not an authorization boundary; auditing requires
  explicit PostgreSQL logging configuration. Inserts are separately gated by the voting cutoff.
- **Verify the sealed record.** Final covered results and protocols read the sealed snapshot. A
  footer references that record; it does not authenticate PDF bytes. Storing and hashing canonical
  PDF artifacts is out of scope.
- **The signers protocol is covered.** Freeze signing willingness, names and consented phone numbers
  in a separate `signers` section when sealing succeeds. Its hash is public; its contents remain
  admin-only under `canViewSignWillingness`, including for named polls.
- **Independent verification ships as a standalone CLI first.** It checks exported receipts and
  bundles without the running application. The hosted browser checks remain; a downloadable browser
  verifier is deferred.

### 3.2 Threat model

| Scenario                                                                          | Outcome                                                                                                                                                                             |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disclosed vote or tally altered after anchoring, by anyone including the operator | Rehashing the changed disclosed data disagrees with the anchored commitment. A holder of hashes alone cannot inspect undisclosed contents.                                          |
| Seal row deleted and poll re-sealed                                               | Retained bundles preserve the original commitment. A replacement root differs; its timestamp need not be strictly later if both roots land in one block.                            |
| Vote altered or deleted between cast and seal                                     | Comparison with the voter's original receipt detects changed or unavailable expected leaves. A secret alone cannot detect this rewrite; withheld paths do not prove non-inclusion.  |
| Vote forged before sealing for a voter who never checks a receipt                 | **Not prevented.** Only voter-signed ballots would; out of scope (§17).                                                                                                             |
| Superuser bypasses the triggers                                                   | Not prevented. Detectable as above if the write happens after sealing.                                                                                                              |
| Operator lies on the in-browser verify page                                       | Independently run verifier checks the saved receipt, disclosed sections, Merkle paths and manifest; `ots` verifies the timestamp. The hosted page cannot establish trust in itself. |
| PDF contents changed while retaining a valid footer                               | The footer alone does not detect this. Compare contents with the sealed record; exact PDF-byte authentication is out of scope.                                                      |

## 4. The sealed record

### 4.1 Structure

The exact unpublished v1 field shapes, nullability and decimal formats now live in the
[domain format reference](../src/domain/seal/README.md), with strict schemas and independent golden
fixtures. This section remains the behavioral design; application integration follows the phased plan.

```
root digest = sha256(canonical(manifest))

manifest = {
  version: 1,
  algorithm: "sha256",
  pollId,
  sealedAt,
  sections: {
    poll:     { hash },
    tallies:  { hash },
    register: { hash },
    signers:  { hash },
    votes:    { root, leafCount }
  }
}
```

Each section hash is `sha256` of that section's canonical bytes. The `votes` section is a Merkle tree
whose root replaces a flat hash, so one leaf can be proven without disclosing the rest.

### 4.2 Section contents

**`poll`** — id, title, description (raw markdown), pollType, anonymous, organizationId and
organization name, boardId and board name, metadataCapturedAt, startDate, endDate, finishedAt,
distributionType, propertyAggregation, weightCriteria, propertyIds, createdBy, createdAt; every question
with id, order, text, details, questionType, archivedAt and its answers with id, order, text,
archivedAt; attachment metadata (id, file name, size, mime type). Attachment contents are not hashed in
this version.

**`tallies`** — per non-archived question: per non-archived answer `{ answerId, voteCount, totalWeight }`,
plus `totalVotes`, `totalWeight`, `participantWeight` (unique-voter dedupe, same arithmetic as
`GetNamedProtocolUseCase`); then `totalParticipants` and `totalParticipantWeight`. This mirrors the
results page; the `votes` tree, by contrast, contains every vote row.

**`register`** — every participant: userId, lastName, firstName, middleName, weight, snapshotAt, voted,
and the property holdings printed in the named protocol (property/asset ids and names, size, unit,
ownership share). Holdings use the participant's weight snapshot as in `GetNamedProtocolUseCase`;
their resolved values and labels are then frozen in this section. Decimal holding values use defined
decimal strings, not binary floating-point serialization. Names are convenience; userId is
authoritative. Open polls list only voters, since they join on vote.

Capture mutable metadata from the consistent database snapshot used by the successful sealing
attempt; `metadataCapturedAt` records that snapshot's capture time. Names and labels may therefore
reflect changes after `finishedAt`. Persist the captured values with the seal, and use them in all
later covered renderings. Signing willingness and consented phone numbers stay in the separately
protected `signers` section, never in the member-visible register.

**`signers`** — the administrative signer list: one entry per voter with a recorded, non-null
`willingToSignProtocol` decision, containing userId, lastName, firstName, middleName,
willingToSignProtocol and phoneNumber. Use the same sealing-time names as the register. Store a phone
only when willingness is true and a number is available; otherwise phoneNumber is null. Voters with
no recorded decision and non-voters are omitted rather than treated as having declined. An empty
list is still a canonical section with its own hash.

The signers PDF uses title, organization and board labels from `poll`, plus the frozen `signers`
entries. It shows willing voters with consented phones, and declining voters with names only. This
records willingness, not actual signatures. Contents are downloadable only under
`PollResultsPolicy.canViewSignWillingness`; the public manifest exposes their hash only.

**`votes`** — one leaf per vote row (multi-choice voters have several). Leaf preimage:

```
{ pollId, questionId, answerId, userId, weight, castAt, salt }
```

### 4.3 Canonical form

- Normalize domain text to NFC as an explicit preprocessing step, then serialize with **RFC 8785**
  (JCS): recursively sorted keys, no whitespace, UTF-8. Persist and distribute that normalized
  representation. JCS itself preserves strings; verification must not silently normalize changed
  received bytes. Reject noncanonical section bytes, invalid Unicode and unsupported values.
  See [RFC 8785 §3.1](https://www.rfc-editor.org/info/rfc8785/).
- Dates as ISO 8601 UTC with milliseconds, `YYYY-MM-DDTHH:mm:ss.sssZ`.
- Weights are **never JSON numbers**. They are strings with exactly six fractional digits, matching
  `Decimal(15,6)`. Inside the seal context weights are integers in millionths (`bigint`), so tallies are
  exact and reproducible by an independent verifier with no floating-point caveats. The application
  mapper converts the entities' `number` weights with `toFixed(6)`, which is exact for every value the
  column can hold (magnitude below 10⁹ keeps the double error below 5·10⁻⁷).
- Integers (counts, order, version) are JSON numbers.
- Ordering: questions and answers by `order` then id; register and signers by userId; `propertyIds` by id;
  attachments by id; holdings by property id then asset id; tallies follow the canonical question
  and answer order; **leaves by leaf hash**. Use locale-independent comparisons. Leaf order must not
  follow userId or cast time, or a leaf's position would reveal who voted.
- `version` in the manifest lets a future format coexist with old seals. A verifier refuses an unknown
  version with `SEAL_VERSION_UNSUPPORTED`.

### 4.4 Leaves and the Merkle tree

```
salt       = hex( HMAC-SHA256(key = decodeHex(receiptSecret), msg = utf8(questionId + ":" + answerId)) )
leaf       = sha256( 0x00 || canonical(leaf preimage) )
node       = sha256( 0x01 || left || right )
empty tree = sha256( "" )
```

- Prefix bytes separate leaves from nodes (Certificate Transparency convention) so a leaf can never be
  passed off as an internal node.
- Hashes in JSON are lowercase hex; `left` and `right` in node hashing are decoded 32-byte hashes.
- Leaves sorted ascending by hash, then paired left to right. An unpaired node is carried up unchanged.
- An inclusion path is the list of `{ hash, side }` siblings from leaf to root.
- With only a few answers per question, an unsalted leaf could be brute-forced against the participant
  list. The HMAC salt makes every leaf opaque to anyone without that voter's secret.

### 4.5 Receipts

- 32 random bytes from `crypto.randomBytes`, shown as 64 hex characters, generated inside
  `FinishVotingUseCase` and persisted with the votes in one transaction.
- The versioned receipt JSON contains the code, poll/user ids, every original canonical leaf
  preimage and hash, chosen questions and answers as text, and the poll title. The UI and email
  render the same receipt. A saved receipt is the input to later comparison; pasting just its code
  can only check the current supplied record.
- Persist the `Vote.createdAt` used as `castAt` in both organization and open-poll vote transactions.
  Current adapters omit it and use the database default, so they must change. Construct the receipt
  only after a successful commit from the exact persisted values; do not mint a new timestamp when
  returning, emailing, reloading or sealing the vote.
- For an original receipt, compare the complete expected leaf set with the supplied own-leaf set,
  recompute original hashes, and verify every path. A mismatch, omitted leaf or extra own leaf must
  not produce a successful original-receipt check. A re-downloaded receipt is not independent
  evidence of what was issued at cast time.
- A participant who never votes has no secret. "Voted implies has a secret" is an invariant the builder
  checks; a violation refuses the seal with `SEAL_MISSING_RECEIPT_SECRET`.

### 4.6 Disclosure matrix

| Item                                              | Who                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| manifest, root digest, anchor status, proof file  | anyone, no session                                                         |
| `poll` and `tallies` sections                     | `PollResultsPolicy.canViewResults`                                         |
| `register` section, full leaf list with preimages | `PollResultsPolicy.canViewVoterNames` (admin-only if anonymous)            |
| `signers` section                                 | `PollResultsPolicy.canViewSignWillingness` (admin-only for all poll types) |
| own leaves with preimages, own inclusion paths    | the voter                                                                  |
| receipt secret                                    | its owner only, never in any admin serialization                           |

## 5. Lifecycle

```
vote cast     FinishVotingUseCase
              votes + receipt secret in one transaction
              receipt shown on screen; receipt email if confirmed email

poll finish   FinishPollUseCase
              lock poll row, re-read state, commit FINISHED + finishedAt
              dispatch PollFinished after commit
              SealPollUseCase      capture complete record, save seal
              AnchorSealUseCase    submit root digest to calendars
              NotifyPollFinishedUseCase   optional rootDigest + verify path
              record and claim initial bundle delivery per confirmed-email participant:
                manifest, own leaves + paths (JSON), available proof (.ots)

recovery      UpgradeAnchorsUseCase   (cron every 15 min)
              missing seals → seal; seals without an active anchor → submit
              due failures → retry; pending proofs → upgrade and verify
              discover missing initial bundle deliveries, then send pending deliveries

verify page   nudge only this poll's stale pending anchor through the same claimed worker
```

### 5.1 Anchor states

| State        | Meaning                                                                              |
| ------------ | ------------------------------------------------------------------------------------ |
| `SUBMITTED`  | Calendars accepted the digest; pending proof stored.                                 |
| `CONFIRMED`  | Proof upgraded **and** verified through the explorer; height and time stored.        |
| `FAILED`     | Submission failed; `attempts`, `lastError`, `nextAttemptAt` drive backoff.           |
| `SUPERSEDED` | Pending for more than three days; replaced by a fresh submission of the same digest. |

Backoff after a failure: 5 min, 15 min, 1 h, 6 h, then every 24 h. Upgrade attempts on a `SUBMITTED`
anchor run on every poller tick, but not more often than every 10 minutes from the lazy verify-page
nudge. A seal has at most one **active** anchor: the one not `SUPERSEDED`. No active anchor is a
recoverable state, not a completed workflow. A database constraint enforces this uniqueness.
Supersession and the replacement's persisted state are saved together; external submission happens
outside the transaction. Persisted claims prevent overlapping workers from applying stale results.

`FAILED` permits null proof and submission time. `SUBMITTED` requires a usable proof with a pending
attestation for the requested digest and a submission time. `CONFIRMED` additionally requires a
verified Bitcoin attestation, height and time. Synthetic test proofs never count as Bitcoin anchors.

### 5.2 Verification flows

- **Anyone**: open `/verify/[pollId]`, read the digest and anchor, download proof and manifest, run
  an independent verifier to hash the canonical manifest, then `ots verify` for its timestamp.
  The recipe must distinguish the digest from a text file containing that digest and include a
  tested command. Pending proofs are shown as pending, never as verified Bitcoin evidence.
- **Member / admin**: same page, signed in; download the sections the policy allows; the page
  recomputes section hashes and the manifest hash, comparing with the digest embedded in the proof.
  Bitcoin verification is a separate result from section consistency.
- **Voter with the original receipt**: `/polls/[pollId]/verify-my-vote` imports the downloaded or
  emailed receipt locally, compares its complete original leaf set with the supplied own leaves,
  recomputes hashes and verifies paths to the votes root, then verifies the manifest-to-proof link.
  Keep receipt secrets local to the verifier. Only that voter's leaves and paths are returned.
- **Voter without the original receipt**: the stored or pasted code can check current-record
  inclusion, but the result explicitly says the original cast-time record was not compared. Do not
  report protection against pre-seal rewriting in this mode.
- **Answer labels**: load the canonical `poll` section only when `canViewResults` permits it; verify
  its hash before resolving question/answer ids to displayed text. An independently retained copy
  can be imported locally. Without an authorized or retained section, show receipt labels as
  cast-time claims and ids as proven data; do not label server-supplied text as sealed.
- **Independent verification**: ship a standalone CLI using the same pure core to check receipt,
  section, path and manifest consistency from local files without calling our site or database.
  `ots` checks the timestamp, not our custom bundle format. Supply installation/run instructions,
  fixtures and nonzero exit codes for failed checks. The separate downloadable browser tool is
  deferred; the hosted browser checks described above remain in scope.

### 5.3 Atomic cutoff and recoverable work

- Every vote transaction locks the parent poll row before checking that it is still `ACTIVE` and
  accepting a complete ballot. Finishing locks that same row before checking the transition and
  storing `FINISHED` with `finishedAt`. Therefore a vote commits before finish or is rejected after
  it; an earlier application-policy check does not authorize a later insert. Enforce this at the
  database write boundary, including a vote-insert guard for alternate write paths.
- Other poll-state writers use the same lock and expected-state check, so an in-flight deactivate or
  stale full-row save cannot overwrite `FINISHED`. Poll and seal remain separate transactions.
- The complete snapshot reader includes archived questions/answers, attachment metadata,
  participants, persisted votes and required metadata. Read and save the seal in one repeatable-read
  transaction, with no network calls, so the successful attempt commits a consistent snapshot.
  Failed attempts may recapture newer external metadata. `getPollById()` is unsuitable: it filters
  archived items and selects only attachment ids.
- Reconciliation scans four independent conditions: eligible finished polls without seals; seals
  without active anchors; due active anchors; and participants without a recorded initial bundle
  delivery once a usable proof exists. A crash between steps must leave discoverable work.
- Persist a per-poll work claim with owner, expiry and monotonically increasing fencing token.
  Network calls run outside database transactions. Saving their results checks the current token;
  an expired worker cannot overwrite a newer result. Bound batches and reuse this mechanism for
  cron, immediate dispatch and verify-page nudges.
- Bundle deliveries have a unique `(sealId, userId)` record and states `PENDING`, `SENDING`, `SENT`,
  `FAILED`, `UNKNOWN`. Reconciliation can create missing records and claim `PENDING` once. A known
  send failure becomes `FAILED`; an interrupted send whose outcome cannot be established becomes
  `UNKNOWN`. Neither is automatically resent in this version. Deferred first delivery is supported;
  exactly-once email delivery is not claimed.

## 6. Domain layer

New bounded context `src/domain/seal/`. It imports nothing from `src/domain/poll/`; the application
layer maps a complete poll-record snapshot into a plain `SealInput` (the anti-corruption layer, §8).
The domain/application core owns ports; Prisma, OpenTimestamps, email and web adapters depend inward.
The builder and aggregates enforce invariants; use cases load, invoke, save and dispatch events.

Phase 1's type review separates those raw DTOs from the validated domain model. Core IDs, receipt
secrets, salts, digests, timestamps and constrained anchor values use distinct validated types;
vote/register rows retain bounded `RowWeight` values and tally arithmetic returns unbounded
`Weight` values. Anchor states form a discriminated union with state-specific required evidence.
Boundary codecs preserve all v1 bytes and revalidate persisted data. See the
[domain type and codec contract](../src/domain/seal/README.md#domain-types-and-boundary-codecs).

| File                     | Contents                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PollSeal.ts`            | Aggregate root: id, pollId, version, algorithm, manifest, rootDigest, sealedAt, canonical section bytes, canonical vote preimages, ordered leaf hashes, anchors. Methods: `activeAnchor()`, `submitAnchor(proof)`, `confirmAnchor(proof, height, time)`, `failAnchor(error, nextAttemptAt)`, `supersedeAnchor()`. Illegal transitions return `SEAL_ANCHOR_ILLEGAL_TRANSITION`. |
| `SealAnchor.ts`          | Entity inside the aggregate: readonly SUBMITTED/CONFIRMED/FAILED/SUPERSEDED variants, validated IDs/times/proofs and state-specific required fields. Strict persistence decoder; pure transitions.                                                                                                                                                                             |
| `SealedRecordBuilder.ts` | Pure factory `build(input: SealInput, sealedAt: Date): Result<PollSeal, string>`. Validates invariants, computes sections, tree, manifest, root.                                                                                                                                                                                                                               |
| `SealInput.ts`           | Plain input types: poll data, participants with optional receipt secret, votes with weight strings, and signer decisions with sealing-time names and consent-gated phone numbers.                                                                                                                                                                                              |
| `Canonical.ts`           | Explicit NFC input preparation, RFC 8785 serialization and strict canonical-byte verification; date and decimal formatting.                                                                                                                                                                                                                                                    |
| `MerkleTree.ts`          | `build(leaves)`, `root`, `pathFor(leafHash)`, `verifyPath(leaf, path, root)`.                                                                                                                                                                                                                                                                                                  |
| `VoteLeaf.ts`            | `parseVotePreimage`, `votePreimageData`, typed `deriveSalt(secret, questionId, answerId)` and `hashLeaf(preimage)`. Bounded RowWeight values stay distinct from unbounded tally sums.                                                                                                                                                                                          |
| `Weight.ts`              | Value object: millionths as `bigint`, `fromDecimalString`, `toDecimalString`, `add`, `equals`. Row codecs retain the bounded RowWeight brand; sums return Weight.                                                                                                                                                                                                              |
| `AnchorProvider.ts`      | Port: typed Digest input, pending/simulated or Bitcoin evidence variants with owned AnchorProof bytes, BitcoinHeight and UtcTimestamp. Adapters must verify actual proof contents.                                                                                                                                                                                             |
| `PollSealRepository.ts`  | Aggregate port: `save(seal)`, `findByPollId`, `findByRootDigest`, `saveAnchors(seal, claimToken)`. Save all changed anchor entities atomically through the root; immutable record fields never change.                                                                                                                                                                         |
| `SealDomainCodes.ts`     | `SEAL_POLL_NOT_FINISHED`, `SEAL_INCONSISTENT_RECORD`, `SEAL_MISSING_RECEIPT_SECRET`, `SEAL_ANCHOR_ILLEGAL_TRANSITION`, `SEAL_VERSION_UNSUPPORTED`, `SEAL_LEAF_NOT_FOUND`.                                                                                                                                                                                                      |

Changes in the poll context:

- `Poll.ts`: `finishedAt: Date | null` in props; `finish(now)` sets it and raises `PollFinished`; getter;
  reconstitute round-trips it without raising a new event. Mutable metadata is captured later by sealing.
- `PollParticipant.ts`: `receiptSecret: string | null`, set once via `assignReceiptSecret(secret)`;
  refuses a second assignment.

`Canonical`, `MerkleTree`, `VoteLeaf`, and `Weight` have no I/O and no Node-only imports, so the
browser verifier imports them directly.

## 7. Data layer

```prisma
model Poll {
  // ...
  finishedAt DateTime? @map("finished_at")
  revision   Int       @default(0) // optimistic lifecycle guard
  seal       PollSeal?
}

model PollParticipant {
  // ...
  receiptSecret String? @map("receipt_secret")
  ballotSnapshot Json? @map("ballot_snapshot") // versioned original labels, selections, weights and times
}

model PollSeal {
  id              String   @id @default(cuid())
  pollId          String   @unique @map("poll_id")
  version         Int
  algorithm       String
  rootDigest      String   @unique @map("root_digest")
  manifest        Json
  sectionPoll     String   @map("section_poll")      // canonical bytes, exactly as hashed
  sectionTallies  String   @map("section_tallies")
  sectionRegister String   @map("section_register")
  sectionSigners  String   @map("section_signers")    // admin-only canonical signer list
  votePreimages   Json     @map("vote_preimages")      // private canonical inputs; salts, never receipt secrets
  leaves          Json                                 // ordered leaf hashes
  sealedAt        DateTime @map("sealed_at")

  poll    Poll         @relation(fields: [pollId], references: [id], onDelete: Cascade)
  anchors SealAnchor[]

  @@map("poll_seals")
}

enum SealAnchorStatus {
  SUBMITTED
  CONFIRMED
  FAILED
  SUPERSEDED
}

model SealAnchor {
  id             String           @id @default(cuid())
  sealId         String           @map("seal_id")
  provider       String
  status         SealAnchorStatus
  pendingProof   Bytes?           @map("pending_proof") // absent after a failed initial submission
  confirmedProof Bytes?           @map("confirmed_proof")
  bitcoinHeight  Int?             @map("bitcoin_height")
  bitcoinTime    DateTime?        @map("bitcoin_time")
  attempts       Int              @default(0)
  lastError      String?          @map("last_error")
  nextAttemptAt  DateTime?        @map("next_attempt_at")
  submittedAt    DateTime?        @map("submitted_at") // set only after an accepted submission
  confirmedAt    DateTime?        @map("confirmed_at")
  createdAt      DateTime         @default(now()) @map("created_at")

  seal PollSeal @relation(fields: [sealId], references: [id], onDelete: Cascade)

  @@index([sealId])
  @@index([status, nextAttemptAt])
  @@map("seal_anchors")
}
```

Additional workflow persistence: a per-poll claim row `(pollId, owner, leaseUntil, fencingToken)`
and per-recipient bundle delivery rows `(sealId, userId, status, attemptStartedAt, completedAt,
lastError)`, unique on `(sealId, userId)`. These are operational records, not extra domain aggregates.
Persist claim validation and the resulting aggregate update in one transaction. Enforce anchor-state
proof requirements with database checks as well as aggregate invariants. A partial unique index on
`seal_anchors(seal_id) WHERE status <> 'SUPERSEDED'` permits at most one active anchor.

Mutable metadata is persisted in the seal's canonical sections, with `metadataCapturedAt` in the
`poll` section. `sectionSigners` stores its own canonical bytes, separately from the member-visible
register, and the manifest commits to its hash. No finish-time source snapshot or canonical PDF
artifact store is required.

The migration also installs the immutability triggers below. These alone do not establish the voting
cutoff: add the vote-insert guard and coordinated state transitions specified in §5.3.

```sql
CREATE FUNCTION reject_row_mutation() RETURNS trigger AS $$
BEGIN
  -- Deliberate bypass, scoped to one transaction:
  --   SET LOCAL app.allow_immutable_mutation = 'on';
  -- Operator convention: use SET LOCAL; this setting itself is not access control.
  IF current_setting('app.allow_immutable_mutation', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'rows in % are immutable', TG_TABLE_NAME;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER votes_immutable      BEFORE UPDATE OR DELETE ON votes      FOR EACH ROW EXECUTE FUNCTION reject_row_mutation();
CREATE TRIGGER poll_seals_immutable BEFORE UPDATE OR DELETE ON poll_seals FOR EACH ROW EXECUTE FUNCTION reject_row_mutation();
```

Row triggers do not fire on `TRUNCATE`, so `prisma/seed.ts` keeps working. No existing test deletes
vote rows: `PrismaVoteRepository.test.ts` mocks Prisma and `ReportFlow.integration.test.ts` uses
in-memory fakes. The `SET LOCAL` bypass exists for deliberate operator use and for future
database-backed tests; the application code never sets it. `seal_anchors` stays mutable by design,
which is why anchor state is not on the seal row.

Backfill, run as a restartable Node script: assign a `receipt_secret` only where it is missing for a
participant with votes in an `ACTIVE` or `READY` poll. A paused `READY` poll can contain votes and later
finish. Never replace an existing secret or backfill `finished_at`; polls already `FINISHED` remain
ineligible. During rollout, disable vote/finish writes across old and new instances, migrate, backfill,
verify coverage, deploy all writers, then re-enable writes. This prevents mixed-version writes or a
finish racing past the backfill. Retrying the script preserves secrets already assigned.

Migrated voters have no original cast-time receipt from before deployment. They may export the
current record and later verify inclusion, but must not be told this detects earlier alterations.

Run `yarn prisma:generate` after `prisma migrate dev`.

Ops note, not code: revoke `UPDATE` and `DELETE` on `votes` and `poll_seals` from the application's
database role.

## 8. Application layer

New directory `src/application/seal/`:

| Use case / service            | Behaviour                                                                                                                                                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SealingTransaction.ts`       | Application port providing a transaction-scoped snapshot reader and seal repository. The adapter uses repeatable-read; no Prisma transaction type crosses into the core.                                                                                          |
| `PollRecordSnapshotReader.ts` | Application read port for the complete sealing-time snapshot, including archived items and attachment metadata. Shares the repeatable-read transaction that saves the seal; existing seals reuse their stored sections.                                           |
| `SealInputMapper.ts`          | Anti-corruption layer. Maps the complete snapshot DTO into `SealInput`, never imports poll entities into the seal domain. Weights via `toFixed(6)`, cast times from persisted votes.                                                                              |
| `SealWorkRepository.ts`       | Application workflow port: discover missing seals, unanchored seals, due anchors and missing/pending initial deliveries; claim work with expiry and fencing tokens; record delivery outcomes.                                                                     |
| `SealPollUseCase`             | Idempotent under concurrent calls. Claims work, requires `FINISHED` with `finishedAt`, and uses `SealingTransaction` to read, map, build and save one consistent snapshot. Returns the existing seal after a uniqueness race; never replaces it.                  |
| `AnchorSealUseCase`           | Claims work, checks active state, calls `provider.submit(rootDigest)` outside a transaction; on success `submitAnchor`, on failure `failAnchor` with backoff. Saves only with the current fencing token.                                                          |
| `UpgradeAnchorsUseCase`       | Reconciles every condition in §5.3, including a saved seal with no anchor and initial bundle delivery after delayed sealing. Runs bounded batches of sealing, submission, upgrade and delivery handlers.                                                          |
| `GetSealUseCase`              | Public read model: manifest, rootDigest, sealedAt, active anchor status, height, time. No auth.                                                                                                                                                                   |
| `GetSealSectionsUseCase`      | Assembles `ResultsViewerFacts` as `GetNamedProtocolUseCase` does; returns `poll` + `tallies` under `canViewResults`, `register` + leaf preimages under `canViewVoterNames`, and `signers` only under `canViewSignWillingness`. Fails closed.                      |
| `GetVoteProofUseCase`         | Returns only the authenticated user's sealed leaf preimages, hashes, paths and manifest. Eligibility comes from sealed participation; current policy separately gates the canonical `poll` section. No own sealed votes: `seal.errors.notAVoter`.                 |
| `GetSealedProtocolUseCase`    | Reads final results and protocol inputs from immutable seal sections, with the existing results/export policies. No live name, holdings, vote or phone joins. The signers protocol uses sealed `poll` + `signers` sections and requires `canViewSignWillingness`. |
| `SendVoteReceiptEmailService` | Renders and sends the receipt when `user.emailConfirmedAt` is set. Failures logged, never surfaced to the voter.                                                                                                                                                  |
| `SendSealBundleEmailService`  | Claims a pending initial delivery; checks current confirmed email; sends manifest, own leaves and paths, authorized label data, and available proof. Records outcome; never resends `SENT`, `FAILED` or `UNKNOWN`.                                                |
| `SealErrors.ts`               | `seal.errors.notFound`, `seal.errors.pollNotFinished`, `seal.errors.notAVoter`, `seal.errors.forbidden`, `seal.errors.anchorUnavailable`.                                                                                                                         |

Changed:

- **`FinishVotingUseCase`** generates the secret, passes it into the transactional repository call,
  returns `VoteReceiptView` instead of `void`, and triggers the receipt email. `ParticipantRepository`
  gains `castVotes(participantId, votes, willingToSignProtocol, receiptSecret)` for organization polls
  (today's `createVotes` + `updateWillingToSignProtocol` were two calls); `joinAndVote` gains the
  secret parameter for open polls. Both lock and re-check the poll inside the transaction and persist
  exact vote timestamps. Cleanup or receipt-email failure after commit must not discard the receipt
  or encourage another cast. A repeated request returns the already committed receipt rather than
  generating another secret or ballot.
- **`FinishPollUseCase`** uses a repository operation with the shared poll lock and expected-state
  check. After commit, dispatch `PollFinished` to sealing and notification handlers; sealing then
  triggers anchoring and eligible initial bundle delivery. A sealing/anchoring failure never rolls
  back finishing or suppresses the finish notification. Persisted-state reconciliation covers a
  crash between these calls. Notifications carry a root digest only when a seal already exists.
- **`NotifyPollFinishedUseCase`** accepts the optional root digest.

### Phase 2 implementation notes

`castVotes` and `joinAndVote` return a committed `RecordedBallot`: an immutable versioned snapshot,
or an explicit legacy marker when original cast data does not exist. The application translates
that snapshot into `VoteReceiptView` after commit. Snapshot version 1 retains original labels,
secret, exact weights and persisted timestamps; receipt replay never joins live labels. The seal
context remains independent of poll entities. New snapshots are validated before being saved.

The poll policy and new atomic ports use validated poll/user/question/answer/participant IDs,
exact `BallotWeight`, `PollRevision`, immutable `PollInstant` and closed failure codes. Legacy
request/database facts are decoded before entering the policy; lifecycle, poll kind and question
kind are closed alternatives. OPEN polls retain weight 1; organization polls may have other weights.
`PollFinished` carries a validated persisted ID and instant, and validation failures leave the poll
unchanged. Raw wire receipts, database rows, labels, boolean facts and local counts intentionally
remain primitives. The separate [domain migration](../plans/archive/2026-10-26-domain-type-migration.md)
carries these rules through older contracts without starting sealing Phase 3.

Detached lifecycle saves compare the loaded `PollRevision` under the poll row lock. PostgreSQL
increments it for every poll update, including narrow writers. Reload a poll before saving it again.
Snapshot discard uses the application-owned `PollSnapshotTransaction`: after authorization, lock
and reload the poll, read vote existence, invoke `Poll.discardSnapshot(hasVotes)`, then explicitly
save the poll and remove its participant snapshot in that transaction. The domain owns the state
and vote rules; the Prisma adapter owns locking, mapping and rollback, including failed `Result`s.
Generic `updatePoll` persists only the poll and never infers snapshot removal from a state pair.
SQL guards additionally make finished state/time, votes, and issued receipt data immutable, with
the documented operator bypass.

The owner receipt lookup uses repeatable-read so participant metadata and vote presence cannot
observe different commits. A concurrent request that loses an earlier eligibility/draft check
rechecks committed evidence before reporting failure. Both cast and finish tolerate post-commit
cleanup failures. The participant-list server action explicitly excludes receipt credentials.

`yarn db:backfill-receipts` is the restartable operator command after migration, with vote/finish
writers paused. It fills missing secrets only for ACTIVE/READY voters and leaves original snapshot
and legacy finish-time fields null. See [Testing](Testing.md#disposable-postgresql-tests) for the
isolated database harness. Application databases have not been migrated as part of Phase 2.

## 9. Infrastructure layer

| File                                                                | Contents                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/infrastructure/anchor/OpenTimestampsAnchorProvider.ts`         | Wraps `opentimestamps`. `submit`: `DetachedTimestampFile.fromHash(OpSHA256, digest)` → `stamp` with configured calendars → `serializeToBytes`. `upgrade`: deserialize → `upgrade` → if `isTimestampComplete()` then `verify` with `esplora` URL and `ignoreBitcoinNode: true` → height and time. Console output of the library suppressed for the call; every call under a timeout. |
| `src/infrastructure/anchor/StubAnchorProvider.ts`                   | Returns synthetic proofs; `upgrade` completes on the second call. Dev/tests only; UI clearly labels simulated anchoring.                                                                                                                                                                                                                                                            |
| `src/infrastructure/anchor/anchorProviderFactory.ts`                | Production requires explicit `ANCHOR_PROVIDER=opentimestamps`; unset, `stub` or unknown values fail startup. Unset defaults to stub only in dev/tests. Validate required poller configuration too.                                                                                                                                                                                  |
| `src/infrastructure/repositories/PrismaPollRecordSnapshotReader.ts` | Implements the application read port with a consistent complete snapshot, including archived questions/answers, attachment metadata and resolved protocol fields. Does not reuse the filtered UI poll reader.                                                                                                                                                                       |
| `src/infrastructure/repositories/PrismaSealWorkRepository.ts`       | Implements reconciliation queries, fenced claims and initial bundle delivery tracking. Also discovers saved seals without anchors.                                                                                                                                                                                                                                                  |
| `src/infrastructure/repositories/PrismaPollSealRepository.ts`       | `save` inserts the immutable record and its canonical vote preimages. `saveAnchors` persists the aggregate's anchor changes atomically with claim validation; active-anchor uniqueness is enforced by SQL.                                                                                                                                                                          |
| `src/application/auth/EmailSender.ts`                               | `EmailMessage.attachments?: Array<{ filename: string; content: Buffer \| string; contentType: string }>`. Nodemailer passes them through; the stub ignores them.                                                                                                                                                                                                                    |
| `src/app/api/internal/anchors/upgrade/route.ts`                     | `POST` only. `Authorization: Bearer <ANCHOR_POLLER_SECRET>` compared in constant time. Runs `UpgradeAnchorsUseCase`. Returns counts.                                                                                                                                                                                                                                                |

Cron on the VPS:

```
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $ANCHOR_POLLER_SECRET" http://127.0.0.1:3000/api/internal/anchors/upgrade
```

Ops note: restrict the route to `127.0.0.1` in nginx.

## 10. Web layer

### 10.1 New

| File                                                      | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/[locale]/verify/[pollId]/page.tsx`               | Public, no session required (session loaded if present). Root digest, section hashes, anchor status with block height and time and explorer links, proof and manifest downloads, "verify it yourself" recipe using the standalone CLI followed by `ots verify`, the disclaimer that in-browser checks are served by us, sign-in links to the voter check and the record download. Nudges a stale pending anchor (throttled). |
| `src/web/components/seal/VerifySealPanel.tsx`             | Client. Checks canonical section bytes, hashes and manifest-to-proof digest; distinguishes record consistency from Bitcoin confirmation.                                                                                                                                                                                                                                                                                     |
| `src/app/[locale]/polls/[pollId]/verify-my-vote/page.tsx` | Voter page; serializes own sealed leaves, paths, manifest, and only policy-authorized label data.                                                                                                                                                                                                                                                                                                                            |
| `src/web/components/seal/VoteProofVerifier.tsx`           | Client. Imports original receipt locally, compares its entire leaf set, verifies paths and manifest-to-proof digest. Checks the `poll` section before presenting sealed labels. Code-only mode explicitly checks current-record inclusion only.                                                                                                                                                                              |
| `src/web/components/seal/VoteReceiptPanel.tsx`            | Shown by `VotingInterface` after a successful finish: code with copy button, chosen answers, leaf hashes, JSON download, "sent to your email" or the confirm-email nudge.                                                                                                                                                                                                                                                    |
| `src/web/components/seal/SealStatusBadge.tsx`             | not sealed / sealing pending / anchoring pending / anchored on `<date>`, block `<n>` / anchoring failed. Used on the results page and `PollCard`.                                                                                                                                                                                                                                                                            |
| `src/web/lib/pdf/sealFooter.ts`                           | Shared footer: root digest, anchor line, verify URL, QR (pdfmake `qr` element).                                                                                                                                                                                                                                                                                                                                              |
| `src/app/api/polls/[pollId]/seal/manifest/route.ts`       | `GET`, public JSON.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/app/api/polls/[pollId]/seal/proof/route.ts`          | `GET`, public; confirmed proof if present, else pending; `application/octet-stream`, `<pollId>.ots`.                                                                                                                                                                                                                                                                                                                         |
| `src/app/api/polls/[pollId]/seal/sections/route.ts`       | `GET`, session required; `GetSealSectionsUseCase`; 403 on refusal.                                                                                                                                                                                                                                                                                                                                                           |
| `src/app/api/polls/[pollId]/seal/my-proof/route.ts`       | `GET`, session required; `GetVoteProofUseCase`; JSON bundle download.                                                                                                                                                                                                                                                                                                                                                        |

### 10.2 Changed

| File                                                                                                       | Change                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/components/polls/voting/VotingInterface.tsx`                                                          | Renders `VoteReceiptPanel` from the action's receipt view after finishing.                                                                                                                                                                                                                                |
| `web/actions/poll/*` finish-voting action                                                                  | Serializes `VoteReceiptView` to the client for the voter only.                                                                                                                                                                                                                                            |
| `app/[locale]/polls/[pollId]/results/page.tsx`                                                             | Loads `GetSealUseCase`; passes plain seal status; links to verify, voter check, record download per policy.                                                                                                                                                                                               |
| `web/components/polls/results/PollResults.tsx`                                                             | `SealStatusBadge` and the three links.                                                                                                                                                                                                                                                                    |
| `web/components/polls/PollCard.tsx`                                                                        | `SealStatusBadge` for finished polls, linking to `/verify/[pollId]`. Visible to everyone who sees the card; the page itself is public.                                                                                                                                                                    |
| `web/lib/pdf/pollResultsPdfGenerator.ts`, `namedProtocolPdfGenerator.ts`, `protocolSignersPdfGenerator.ts` | Render final covered contents from the sealed protocol read model; footer describes record coverage. Active named-poll exports remain preliminary and unsealed. The signers PDF uses frozen names, willingness and consented phones from its admin-only section; PDF-byte authentication is out of scope. |
| the three PDF routes                                                                                       | Apply export policies and use immutable sealed inputs for final covered documents. Active or historical unsealed documents remain clearly unsealed; sealing-pending output must not claim authentication.                                                                                                 |
| `application/notification/NotifyPollFinishedUseCase.ts`                                                    | Optional `rootDigest` in notification `data`; body text gains the "sealed" sentence when present.                                                                                                                                                                                                         |
| `web/utils/notificationActionUrl.ts`                                                                       | Poll-finished notification links to the results page as today; the verify link lives on that page.                                                                                                                                                                                                        |

The final results page also reads sealed tallies when a seal exists. A document's valid footer must
never hide divergence between current joins and the sealed record. Freeze property holdings and
labels used by the named protocol. The final signers PDF renders the sealed `signers` list, including
its captured phone values, under the existing admin-only export policy. Record verification must say
that PDF bytes themselves are not authenticated. Download-time generation dates and presentation changes do not change the seal;
verification compares the disclosed record with its commitment, not the generated PDF file hash.

### 10.3 Responsiveness

Digests are 64-character hex: `break-all`, monospace, copy buttons. QR and hashes must remain legible on
phones; the verify page is a single column below `md`.

## 11. Emails

Two templates through `NextIntlEmailTemplateRenderer`, both plain text plus HTML, both locales:

- **Vote receipt** (`email.voteReceipt.*`): poll title, time, the chosen answers, the receipt code,
  the leaf hashes, a sentence on retaining the original record, the verify URL; attach the exact
  versioned cast-time `receipt.json`. Confirmation of email possession is not evidence of a saved receipt.
- **Seal bundle** (`email.sealBundle.*`): poll title, root digest, sealed time, the verify URL, a
  sentence that pending proofs usually complete within hours but depend on the public calendars;
  attachments `bundle.json` (manifest, own leaves and paths, authorized canonical label data) and
  `<pollId>.ots`. Send after the first usable proof, even when produced by recovery. No other
  voter's preimages, receipt secrets or admin-only signer data enter this email.

## 12. Localization

New namespaces in `messages/en.json` and `messages/ru.json`:

- `seal.status.*` — `notSealed`, `sealingPending`, `anchoringPending`, `anchored`, `anchoringFailed`
- `seal.verify.*` — page title, labels for digest, sections, anchor, block, time, explorer, downloads,
  recipe, disclaimer, sign-in prompts
- `seal.myVote.*` — title, import-receipt prompt, paste-code prompt, originalReceiptVerified,
  currentRecordIncluded, originalReceiptMissing, labelsUnverified, mismatch, notInTree, proofIncomplete
- `seal.receipt.*` — title, code, copy, copied, download, emailed, addEmail, yourAnswers, leafHash
- `seal.pdf.*` — `rootDigest`, `anchored`, `anchoringPending`, `notSealed`, `verifyAt`
- `seal.errors.*` and `domain.seal.*` — one key per code in §6 and §8
- `email.voteReceipt.*`, `email.sealBundle.*`
- `notification.pollFinished.sealed` — the added sentence

Counts and dates in messages use parameters; block heights and times are never hardcoded.

## 13. Security and privacy

- Receipt secrets are serialized only to their owner. `GetSealSectionsUseCase` never returns secrets,
  not even to admins.
- Imported original receipts are processed locally. The operator's stored secret is not an
  independent commitment to the original ballot; success labels distinguish those checks.
- Public surfaces expose commitments and their metadata (poll id, times, version and leaf count),
  not record contents. Sibling hashes are opaque; hash ordering does not encode voter identity.
- Poll ids are cuids; the public page discloses nothing guessable and never the poll title.
- Every page filters on the server and passes plain objects; no domain object crosses to a client
  component; `viewerFacts` never leaves the server.
- The poller route: bearer secret from env, constant-time comparison, `POST` only, no body, 401 on
  failure without detail.
- The bundle email carries the voter's own answers in clear text. Email is less private than the app;
  the voter opted in by confirming an email, and the receipt panel says a copy was sent.
- Signer consent and consented phone numbers never enter the member-visible register. The `signers`
  section requires `canViewSignWillingness` even for named polls; public responses expose its hash
  only. Declining voters' phones are absent from the snapshot, not merely hidden during rendering.
  Own-vote proofs and participant bundle emails never include this administrative list. Own-vote
  proof access does not grant access to the whole `poll` section after results permissions are lost.
- Rate limiting: middleware covers the public page and API routes; every server action starts with
  `checkRateLimit()`.

## 14. Failure handling

| Failure                                          | Handling                                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seal build refused (invariant)                   | Logged with the domain code; poll stays `FINISHED`; results page shows "sealing pending"; poller retries; a persistent refusal surfaces in logs for the superadmin. |
| Seal save fails                                  | Same as above.                                                                                                                                                      |
| Process stops after seal save, before submission | Reconciliation discovers the seal without an active anchor and submits it.                                                                                          |
| Calendars unreachable on submit                  | Persist `FAILED` with null proof/submission time if never accepted; backoff per §5.1; never substitute a stub.                                                      |
| Concurrent workers or expired claim              | Unique active-anchor constraint and fencing prevent duplicate active state or stale writes; reload authoritative state.                                             |
| Upgrade pending beyond three days                | `SUPERSEDED`; fresh submission of the same digest.                                                                                                                  |
| Explorer verification fails after upgrade        | Upgraded bytes kept; state stays `SUBMITTED`; retried next tick.                                                                                                    |
| Receipt email fails                              | Logged; the voter still sees the receipt on screen.                                                                                                                 |
| Sealing or submission delayed                    | Once usable proof exists, reconciliation creates and sends missing initial bundle deliveries.                                                                       |
| Bundle email fails                               | Persist `FAILED` per recipient; no automatic retry in this version.                                                                                                 |
| Process stops during email send                  | Expired `SENDING` becomes `UNKNOWN`; outcome is ambiguous, so do not automatically resend.                                                                          |
| Original receipt missing                         | Permit current-record inclusion checks, clearly state that the original cast-time ballot was not compared.                                                          |
| Expected receipt leaf missing or changed         | Original-receipt verification fails; do not accept a freshly generated replacement receipt as the original.                                                         |
| Production provider unset or stub                | Fail startup; synthetic proofs never reach production verification surfaces.                                                                                        |
| Proof file requested before anchoring            | 404 with `seal.errors.anchorUnavailable`.                                                                                                                           |
| Unknown manifest version                         | `SEAL_VERSION_UNSUPPORTED` in verifiers; page shows "cannot verify this version".                                                                                   |

## 15. Testing

TDD: before implementing each new domain object, write a failing test demonstrating how a client of
the domain model uses it. Then implement behavior through the aggregate/value-object API. Use
in-memory port fakes for orchestration, plus real-database tests for locking and persistence guarantees
that mocks cannot establish. No application/framework types enter domain tests.

- **`Canonical.test.ts`** — golden fixtures with exact bytes and digests: key order, NFC, six-decimal
  weights, dates, archived items, nested arrays, attachment/property/holding order, explicit NFC input
  preparation and rejection of changed/noncanonical received bytes. Node and browser share fixtures.
  A change in output is a format change and bumps `version`.
- **`Weight.test.ts`** — exact millionths arithmetic; `toFixed(6)` round-trip for the column's bounds.
- **`MerkleTree.test.ts`** — roots for zero through five leaves, path generation and verification,
  prefix separation (a leaf's bytes used as a node hash fails), one flipped byte fails the path,
  ordering by hash.
- **`VoteLeaf.test.ts`** — salt derivation deterministic; different secrets differ; any field change
  changes the leaf.
- **`SealedRecordBuilder.test.ts`** — fixture poll yields the expected manifest; tallies equal
  `GetNamedProtocolUseCase` numbers for the same votes; archived questions present in `poll`, absent in
  `tallies`; anonymous, named, and open polls share one shape; missing secret refuses; vote by a
  non-participant refuses. All five section commitments are present, including an empty signers list.
  Signers include recorded true/false decisions, omit missing decisions, and retain phones only for
  consenting voters; changing any captured signer field changes the section and root hashes.
- **`PollSeal.test.ts`** — anchor transitions, illegal transitions refused, `activeAnchor` after
  supersession; initial `FAILED` without proof, `SUBMITTED` requiring proof, and no successful Bitcoin
  verification from a synthetic proof.
- **Use cases** — `SealPollUseCase` idempotent and refuses non-finished; `AnchorSealUseCase` states on
  provider failure; `UpgradeAnchorsUseCase` backoff schedule, three-day supersession, seals finished
  polls without a seal but never polls with `finishedAt` null; discovers seals without anchors;
  initial bundle delivery after delayed sealing/submission; fenced concurrent workers;
  `GetSealSectionsUseCase` full matrix
  {anonymous, named} × {admin, member, open-poll voter, outsider}; `GetVoteProofUseCase` returns own
  leaves only; `FinishVotingUseCase` creates the secret and original receipt, returns the same receipt
  on a repeat request and still returns it after draft-cleanup failure; `FinishPollUseCase` returns
  success and dispatches notifications when sealing fails. Label disclosure is separately authorized.
- **Adapter** — `OpenTimestampsAnchorProvider` with the library's `stamp`, `upgrade`, `verify` stubbed;
  one live test against the public calendars, skipped unless `OTS_LIVE_TEST=1`.
- **Routes** — manifest 200 without a session; sections 403 for an outsider; finished anonymous-poll
  member receives 200 with `poll` + `tallies` only, without register, signers or other voters' preimages.
  Named-poll members may receive the register but never the signers section; admins may receive
  signers for either poll type. Public responses expose only its hash, and own-proof/bundle payloads
  omit the signer list. My-proof 403 for a non-voter; poller 401 without the secret and 200 with it.
- **Final results and PDFs** — sealed values remain unchanged after live name/organization/holding
  data changes; covered contents and footer agree; active named polls remain preliminary/unsealed.
  Signer fields never leak to members; signers PDF names, willingness and phones stay frozen after
  live data changes, and declining voters never have a phone column. Verify that the footer describes
  record verification without claiming PDF-byte authentication.
- **Verifiers** — importing the original receipt rejects a changed ballot even when the server
  knows the same secret and provides a valid new Merkle path; missing/extra own leaves fail; altered
  answer labels fail the `poll`-section hash. Code-only mode never reports original-receipt agreement.
  Tampered sections, manifest and proof digests fail; pending timestamp is not reported as confirmed.
  Independent tooling runs from exported fixtures without contacting our app.
- **Snapshot adapter** — archived questions/answers and full attachment metadata survive loading;
  vote preimages are persisted with the seal and returned without reconstructing them from live rows.
  Metadata changes between finishing and successful sealing appear in the captured record; changes
  after sealing do not. A failed seal transaction can recapture newer metadata on retry.
- **Migration** — active and paused `READY` voters receive missing secrets; reruns preserve them;
  already finished polls stay ineligible; migrated voters are not presented as holding original receipts.
- **Configuration** — missing, unknown or stub production provider fails startup; dev/test simulations
  remain explicitly labeled.
- **Database integration** — coordinated vote/finish interleavings: an accepted vote is included or
  rejected before persistence; no successful late insert after `FINISHED`; stale poll updates cannot
  reopen it. Receipt leaf hashes equal sealed hashes after a full database round trip, including
  timestamps. Trigger rejects update/delete; `SET LOCAL` bypass is confined to its transaction.
  Initial failed submissions persist without proofs; concurrent workers cannot create two active
  anchors or apply stale results. Delivery uniqueness and interrupted-send states survive restarts.

## 16. Configuration

| Variable               | Meaning                                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANCHOR_PROVIDER`      | Explicit `opentimestamps` required in production; missing, stub or unknown fails startup. Unset/stub allowed only in dev/tests.                                                                                                     |
| `OTS_CALENDAR_URLS`    | Comma-separated; defaults to the four public calendars.                                                                                                                                                                             |
| `OTS_ESPLORA_URL`      | Defaults to `https://blockstream.info/api`.                                                                                                                                                                                         |
| `OTS_TIMEOUT_MS`       | Per call; default 15000.                                                                                                                                                                                                            |
| `ANCHOR_POLLER_SECRET` | Bearer for the internal route.                                                                                                                                                                                                      |
| `NEXT_PUBLIC_API_URL`  | Origin for verify URLs in emails and PDFs, fallback `https://resolutio.site`, exactly as the report share pages build `SITE_ORIGIN`. No email carries an absolute link today (password reset uses OTP codes), so this is the first. |

## 17. Out of scope

- Voter-signed ballots (passkeys). The only design that prevents pre-seal forgery.
- Interim anchoring while a poll runs.
- Attachment content hashing.
- Exact PDF-byte authentication or canonical PDF artifact storage.
- Downloadable browser verifier in this version; standalone CLI and hosted checks are in scope.
- Retroactive sealing of polls finished before deploy.
- SMS delivery of receipts.
- A superadmin screen for anchors; env configuration only.
- Amending a seal. A seal is final; a corrected decision is a new poll.
- Cryptographic verification of tallies against leaves for anonymous polls by non-admins.
- Automatically retrying failed or outcome-unknown bundle email sends. Deferred first delivery after
  recovery is in scope.
- General-purpose event bus or message broker; explicit domain-event dispatch and reconciliation are
  in scope.

## 18. Resolved questions

Answered 2026-09-11 during review:

1. Russian terms in §2 — confirmed.
2. Verify link on `PollCard` — for everyone (§10.2).
3. Base URL for verify links — `NEXT_PUBLIC_API_URL` with the report pages' fallback (§16).
4. Trigger bypass — added as a transaction-scoped `SET LOCAL` setting (§7); no existing test needed it.

Answered 2026-10-25 after the implementation review:

5. **Q1 — PDF guarantee:** verify the sealed record. Final covered PDFs render from it; their exact
   bytes are not authenticated and canonical PDF artifact storage is out of scope.
6. **Q2 — metadata capture:** when sealing succeeds. Capture a consistent snapshot in the successful
   seal transaction, record `metadataCapturedAt`, and accept metadata changes after finishing but
   before sealing. Existing seals always reuse their stored values.
7. **Q3 — independent verifier:** standalone CLI first, operating on exported receipt/bundle files
   with the shared verification core and `ots` for timestamp verification. Defer the downloadable
   browser tool; keep the hosted browser checks.
8. **Q4 — signers protocol:** included. Add the fifth canonical `signers` section, with its hash in
   the public manifest and its contents gated by `canViewSignWillingness`. Freeze names, willingness
   and consented phones when sealing succeeds; final signer PDFs use those values. The record shows
   willingness to sign, not actual signatures. Participant emails and own-vote bundles exclude it.

## 19. Unresolved questions

None. All four review decisions are recorded in §18 and reflected in the design above.
