# Seal domain and v1 format

Pure seal bounded context. The application supplies a complete, consistent snapshot, persisted vote
times, receipt secrets, IDs and clock values. This directory performs no I/O and imports no poll
entities. `SealedRecordBuilder.build(input, sealedAt)` returns a `Result<PollSeal, SealDomainCode>`.
`PollSeal.reconstitute(record, anchors)` validates persisted data before restoring the aggregate.
`fromRecord` is the throwing smart constructor used inside the builder's Result boundary.

Phase 1 supplies the domain only. Voting transactions, storage, actual OpenTimestamps verification,
authorization, delivery, CLI and UI are subsequent phases of the [implementation plan](../../../plans/2026-09-15-poll-seal-and-anchor.md).

## Domain types and boundary codecs

`SealInput`, `ReceiptInput`, `ReceiptData`, `SealedRecord` and `SealAnchorData` describe raw
input/export/persistence data. Their primitives preserve the v1 representation. Strict parsing
produces distinct domain values; core calculations do not reuse the raw DTOs.

- [SealValues.ts](SealValues.ts) supplies validated branded IDs, `ReceiptSecret`, `VoteSalt`,
  `Digest`, `UtcTimestamp`, holding sizes/shares, anchor counters/heights/errors, proof bytes and
  fencing tokens. IDs of different kinds and secrets/digests cannot be interchanged by checked TS.
  Each ID supplies its own regex; v1 retains 1–256 ASCII letters, digits, underscores or hyphens.
  Application and seal identities have separate brands even when their accepted syntax matches.
  Factories accept `unknown`, throw `SealError` on invalid input, and integrate with `sealResult`.
  Adapters use these factories rather than assertions such as `as PollId`.
- [VoteLeaf.ts](VoteLeaf.ts) parses raw preimages into immutable vote snapshots with `RowWeight`
  values. `RowWeight` is a validated bounded `Weight`; `Weight.add` returns an unbounded tally
  weight that cannot be placed directly into a vote row. `Weight.equals` compares values exactly.
  `votePreimageData` and `registerEntryData` explicitly serialize weights back to decimal strings.
  These serializers enumerate allowed fields, including nested holdings: structural subtypes can
  carry extra private data even in checked TypeScript, and that data must not enter an export.
- `parseInput` returns a finished poll with a non-null finish time and associates each validated
  vote with its required receipt secret. Record construction no longer casts raw poll snapshots or
  assumes a nullable secret exists. Receipt creation and rehydration also retain parsed values.
- `SealAnchor` is a readonly discriminated union. Confirmation requires Bitcoin evidence and the
  real provider; failure requires an error and retry time. A failed anchor's earlier proof and
  submission time are either both present or both absent. Rehydration parses untrusted data into
  these variants; transition functions still check time ordering, identity and legal transitions.

Branded strings/numbers retain their original runtime representations. Descriptive text, local
counts, canonical JSON strings and explicit raw DTO fields remain primitives. `AnchorProof` owns
nonempty bytes; neither its type nor an evidence label establishes cryptographic authenticity.
Aggregate read methods return detached snapshots, including proof arrays.

The type contract runs during ordinary `yarn test`: `TypeSafety.test.ts` compiles positive usage
examples and requires 15 invalid client examples to fail compilation. Assertions/`any` can bypass
TypeScript, so strict boundary parsing and cryptographic verification remain necessary.

## Exact v1 shapes

[RecordFormat.ts](RecordFormat.ts) defines strict schemas, field names and nullability.
[SealInput.ts](SealInput.ts) defines the snapshot boundary. The [complete golden fixture](__tests__/fixtures/record-v1.json)
contains all five sections and an original receipt; changing a published wire shape requires a new version.

| Value                         | Representation                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| IDs                           | Nonempty ASCII tokens `[A-Za-z0-9_-]`, at most 256 characters; `:` is reserved for salt derivation |
| Dates                         | UTC strings `YYYY-MM-DDTHH:mm:ss.sssZ`; nullable only where declared                               |
| Row weights and holding sizes | Nonnegative Decimal(15,6), exactly six fractional digits, at most `999999999.999999`               |
| Tally weights                 | Exactly six fractional digits; sums may exceed the per-row limit                                   |
| Ownership shares              | Decimal(9,8), exactly eight fractional digits, greater than zero and at most `1.00000000`          |
| Counts and order              | Nonnegative safe integer JSON numbers                                                              |
| Hashes and receipt secrets    | Exactly 64 lowercase hex characters; HMAC keys and Merkle children decode to 32 bytes              |
| Optional values               | Explicit `null`; omitted or extra fields are rejected                                              |

Sections:

- `poll`: flat metadata, questions with nested answers, attachments. Archived content remains present.
- `tallies`: `{questions, totalParticipants, totalParticipantWeight}`. Each question has `questionId`,
  `answers`, `totalVotes`, `totalWeight`, `participantWeight`; each answer has `answerId`, `voteCount`,
  `totalWeight`. Participation deduplicates users; answer totals count selections.
- `register`: array of `{userId, lastName, firstName, middleName, weight, snapshotAt, voted, holdings}`.
  Holdings contain `propertyId`, `propertyName`, `assetId`, `assetName`, `size`, `sizeUnit`, `share`.
  Unit values are frozen domain codes, resolved for display later. No phone, willingness or secret.
- `signers`: array of `{userId, lastName, firstName, middleName, willingToSignProtocol, phoneNumber}`.
  Only voters with a non-null decision. Declining voters have a null phone; missing decisions and
  non-voters are omitted. This section always requires separate admin authorization.
- `votes`: sorted Merkle commitments. Private stored entries are `{preimage, hash}`. Preimages contain
  exactly `{pollId, questionId, answerId, userId, weight, castAt, salt}`; never the receipt secret.

The manifest contains exactly `{version: 1, algorithm: "sha256", pollId, sealedAt, sections}`.
The four JSON sections have `{hash}` commitments; votes have `{root, leafCount}`.
`SealedRecord` stores canonical manifest/section strings plus private vote entries and `rootDigest`.
The root digest identifies the domain seal; persistence may assign its own surrogate ID.

`VoteReceipt` contains `{version: 1, algorithm: "sha256", pollId, userId, receiptSecret, pollTitle, leaves}`.
Each leaf contains `{preimage, hash, questionText, answerText}`. Receipt leaves sort by hash too.
The secret and labels remain in the voter's receipt, separately from the sealed record. Labels are
cast-time claims; they are not part of a vote leaf's hash. A fresh export is not independent evidence
of an original ballot. Full receipt-versus-bundle verification is Phase 5.

## Canonical bytes and validation

`prepareNfc` explicitly normalizes producer strings before [RFC 8785](https://www.rfc-editor.org/info/rfc8785/)
serialization. `canonical` preserves strings, sorts keys by UTF-16 code units, and rejects unsupported
values. `parseCanonical` rejects noncanonical/non-NFC bytes, invalid UTF-8, BOMs, duplicate keys,
invalid Unicode, and nesting deeper than 256 containers. It never repairs received evidence.

Array order is defined in design §4.3: order then ID for questions/answers; user ID for register/signers;
ID for properties/attachments; property then asset ID for holdings; hash for votes and receipt leaves.
Hashing uses the pinned `@noble/hashes` exports, with decoded HMAC keys and decoded child hashes.
Pure code works in Node and a browser-targeted bundle; the dependency requires Node >=20.19.0.

A seal rejects incomplete ballots, duplicate/invalid relationships, votes on archived content, changed
weights, missing voter secrets, and inconsistent times. Rehydration checks canonical bytes, all
commitments, ordering, tally arithmetic, register participation and signer consent relationships.
Snapshot completeness and truthful metadata still depend on the reader and transaction in Phase 3.

## Anchor boundary

`PollSeal` alone changes its contained anchor snapshots. Read methods return detached data.
Submission failures schedule 5m, 15m, 1h, 6h, then 24h retries. Pending refreshes are spaced by 10m.
After more than three days pending, supersession validates both the old and replacement states before
changing either; a failed replacement is retained for retry. Historical IDs cannot be reused.

`AnchorProvider` returns explicit pending, simulated or verified Bitcoin evidence, bound to the root
digest. The **adapter must parse the proof and verify those assertions**, including Bitcoin evidence;
nonempty bytes or a status label do not establish validity. Domain validation checks the assertion's
shape, digest, provider and state prerequisites. Rehydration validates state structure, not OTS bytes.
Synthetic test bytes are not Bitcoin evidence, and `stub` anchors cannot become `CONFIRMED`.

## Fixtures and checks

[reference.py](__tests__/fixtures/reference.py) independently calculates vectors using Python
`hashlib`/`hmac`; it never imports application code. Its JCS subset handles fixture strings, integers,
booleans and nulls with UTF-16 key ordering. It is not a general-purpose JCS implementation.
The expected tally arithmetic is specified explicitly. Regenerate with:

```sh
python3 src/domain/seal/__tests__/fixtures/reference.py
```

Fixture receipt keys are public consecutive byte sequences (`0..31` and `32..63`), never deployed
credentials. The repository's `.gitguardian.yaml` lists only their exact scanner fingerprints as
documented false positives; other values and files remain scanned by the commit hook.

`BrowserCompatibility.test.ts` bundles for the browser and executes without Node globals or builtins.
This is a runtime compatibility smoke check, not an interactive browser/UI test.
