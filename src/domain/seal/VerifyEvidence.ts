/** Verify independently supplied export bytes without database, session, network or clock.
 * The output distinguishes original-ballot comparison, selective inclusion, labels and OTS binding. */
import { z } from 'zod';
import { canonical, parseCanonical } from './Canonical';
import { Digest, ReceiptSecret, AttachmentId } from './SealValues';
import { hashText, hashBytes } from './Hash';
import { MerkleTree } from './MerkleTree';
import {
  pollSchema,
  signerSchema,
  registerEntrySchema,
  talliesSchema,
  SealManifest,
  PollSection,
} from './RecordFormat';
import { orderPoll } from './RecordSections';
import { validateSnapshot } from './SnapshotValidation';
import { validateNamedSections, readManifest } from './RecordValidation';
import {
  requireSeal,
  sealResult,
  SealDomainCodes as codes,
} from './SealDomainCodes';
import { hashLeaf, deriveSalt, votePreimageSchema } from './VoteLeaf';
import { VoteReceipt } from './VoteReceipt';
import { inspectTimestamp } from './TimestampBinding';

const envelope = { manifest: z.string(), rootDigest: Digest.schema };
const vote = z.strictObject({
  preimage: votePreimageSchema,
  hash: Digest.schema,
});
const own = vote.extend({
  path: z
    .array(
      z.strictObject({ side: z.enum(['left', 'right']), hash: Digest.schema })
    )
    .max(64),
});
const bundleSchema = z.strictObject({
  ...envelope,
  leaves: z.array(own).min(1),
  poll: z.string().optional(),
});
const sectionsSchema = z.strictObject({
  ...envelope,
  sections: z
    .strictObject({
      poll: z.string().optional(),
      tallies: z.string(),
      register: z.string().optional(),
      signers: z.string().optional(),
      votes: z.array(vote).optional(),
    })
    .refine(
      (s) =>
        (s.votes === undefined) === (s.register === undefined) &&
        (s.signers === undefined || s.register !== undefined)
    ),
});
const sectionCodecs = {
  poll: pollSchema,
  tallies: talliesSchema,
  register: z.array(registerEntrySchema),
  signers: z.array(signerSchema),
};
type SectionName = keyof typeof sectionCodecs;
const names = ['poll', 'tallies', 'register', 'signers'] as const;

export interface EvidenceFiles {
  attachment?: { id: AttachmentId; bytes: Uint8Array };
  manifest?: string;
  bundle?: string;
  sections?: string;
  receipt?: string;
  code?: string;
  poll?: string;
  proof?: Uint8Array;
}

function decode<T>(schema: z.ZodType<T>, bytes: string) {
  const parsed = schema.safeParse(parseCanonical(bytes));
  requireSeal(parsed.success, codes.SEAL_INVALID_BUNDLE);

  return parsed.data;
}

function checkSections(
  manifest: SealManifest,
  disclosure: z.output<typeof sectionsSchema>['sections'] | undefined,
  additional: (string | undefined)[]
) {
  const verifiedSections: (SectionName | 'votes')[] = [];
  let poll: PollSection | undefined;

  for (const name of names) {
    const bytes = disclosure?.[name];
    const candidates = name === 'poll' ? [bytes, ...additional] : [bytes];

    for (const source of new Set(candidates)) {
      if (source === undefined) {
        continue;
      }

      requireSeal(
        hashText(source) === manifest.sections[name].hash,
        codes.SEAL_SECTION_MISMATCH
      );
      const value = parseCanonical(source);

      if (name === 'poll') {
        const parsed = pollSchema.safeParse(value);
        requireSeal(
          parsed.success && parsed.data.id === manifest.pollId,
          codes.SEAL_SECTION_MISMATCH
        );
        poll = parsed.data;
        requireSeal(
          canonical(orderPoll(poll)) === source,
          codes.SEAL_SECTION_MISMATCH
        );
        validateSnapshot(poll, [], [], manifest.sealedAt);
      } else {
        requireSeal(
          sectionCodecs[name].safeParse(value).success,
          codes.SEAL_SECTION_MISMATCH
        );
      }

      if (!verifiedSections.includes(name)) {
        verifiedSections.push(name);
      }
    }
  }

  if (disclosure?.votes) {
    const hashes = disclosure.votes.map(({ hash, preimage }) => {
      requireSeal(
        preimage.pollId === manifest.pollId && hashLeaf(preimage) === hash,
        codes.SEAL_SECTION_MISMATCH
      );

      return hash;
    });
    const tree = MerkleTree.build(hashes);
    requireSeal(
      hashes.length === manifest.sections.votes.leafCount &&
        tree.root === manifest.sections.votes.root &&
        tree.leaves.every((h, i) => h === hashes[i]),
      codes.SEAL_SECTION_MISMATCH
    );
    requireSeal(disclosure.register !== undefined, codes.SEAL_INVALID_BUNDLE);
    validateNamedSections(
      manifest,
      poll,
      { ...disclosure, register: disclosure.register },
      disclosure.votes.map((v) => v.preimage)
    );
    verifiedSections.push('votes');
  }

  return { poll, verifiedSections };
}

function checkBallot(
  manifest: SealManifest,
  bundle: z.output<typeof bundleSchema> | undefined,
  files: EvidenceFiles,
  poll?: PollSection
) {
  if (!bundle) {
    requireSeal(
      files.receipt === undefined && files.code === undefined,
      codes.SEAL_INVALID_BUNDLE
    );

    return { kind: 'notChecked' } as const;
  }

  const { leaves } = bundle;
  requireSeal(
    leaves.length <= manifest.sections.votes.leafCount,
    codes.SEAL_INVALID_BUNDLE
  );
  const choices = new Set<string>();

  for (const [index, leaf] of leaves.entries()) {
    const v = leaf.preimage;
    const key = v.questionId + ':' + v.answerId;
    requireSeal(
      v.userId === leaves[0].preimage.userId &&
        v.pollId === manifest.pollId &&
        !choices.has(key) &&
        (index === 0 || leaves[index - 1].hash < leaf.hash),
      codes.SEAL_INVALID_BUNDLE
    );
    choices.add(key);
    requireSeal(
      hashLeaf(v) === leaf.hash &&
        MerkleTree.verifyPath(
          leaf.hash,
          leaf.path,
          manifest.sections.votes.root
        ),
      codes.SEAL_INVALID_PATH
    );

    if (poll) {
      requireSeal(
        poll.questions
          .find((q) => q.id === v.questionId)
          ?.answers.some((a) => a.id === v.answerId),
        codes.SEAL_LABEL_MISMATCH
      );
    }
  }

  if (files.code !== undefined) {
    const parsed = ReceiptSecret.schema.safeParse(files.code);
    requireSeal(
      parsed.success &&
        leaves.every(
          ({ preimage: v }) =>
            deriveSalt(parsed.data, v.questionId, v.answerId) === v.salt
        ),
      codes.SEAL_CODE_MISMATCH
    );
  }

  if (files.receipt === undefined) {
    return {
      kind:
        files.code === undefined
          ? 'includedLeaves'
          : 'codeMatchesCurrentRecord',
    } as const;
  }

  const receipt = VoteReceipt.parse(files.receipt);

  if (!receipt.success) {
    requireSeal(false, receipt.error);
  }

  const data = receipt.value.data;
  requireSeal(
    data.pollId === manifest.pollId &&
      data.userId === leaves[0].preimage.userId &&
      data.leaves.length === leaves.length &&
      data.leaves.every((l, i) => l.hash === leaves[i].hash),
    codes.SEAL_RECEIPT_MISMATCH
  );

  if (poll) {
    requireSeal(
      data.pollTitle === poll.title &&
        data.leaves.every((l) => {
          const q = poll.questions.find((q) => q.id === l.preimage.questionId);

          return (
            q?.text === l.questionText &&
            q.answers.find((a) => a.id === l.preimage.answerId)?.text ===
              l.answerText
          );
        }),
      codes.SEAL_LABEL_MISMATCH
    );
  }

  return { kind: 'originalReceiptMatches', receipt: data } as const;
}

function checkEvidence(files: EvidenceFiles) {
  const bundle =
    files.bundle === undefined ? undefined : decode(bundleSchema, files.bundle);
  const disclosure =
    files.sections === undefined
      ? undefined
      : decode(sectionsSchema, files.sections);
  const bytes = files.manifest ?? bundle?.manifest ?? disclosure?.manifest;
  requireSeal(bytes !== undefined, codes.SEAL_INVALID_BUNDLE);
  const manifest = readManifest(bytes);
  const rootDigest = hashText(bytes);

  for (const doc of [bundle, disclosure]) {
    requireSeal(
      doc === undefined ||
        (doc.manifest === bytes && doc.rootDigest === rootDigest),
      codes.SEAL_MANIFEST_MISMATCH
    );
  }

  const { poll, verifiedSections } = checkSections(
    manifest,
    disclosure?.sections,
    [bundle?.poll, files.poll]
  );

  if (bundle && disclosure?.sections.votes) {
    const voter = bundle.leaves[0].preimage.userId;
    const own = disclosure.sections.votes.filter(
      (v) => v.preimage.userId === voter
    );
    requireSeal(
      own.length === bundle.leaves.length &&
        own.every((v, i) => v.hash === bundle.leaves[i].hash),
      codes.SEAL_INVALID_BUNDLE
    );
  }

  const file =
    files.attachment &&
    poll?.attachments.find((a) => a.id === files.attachment?.id);

  if (files.attachment) {
    requireSeal(
      file &&
        file.size === files.attachment.bytes.length &&
        file.sha256 === hashBytes(files.attachment.bytes),
      codes.SEAL_SECTION_MISMATCH
    );
  }

  const ballot = checkBallot(manifest, bundle, files, poll);
  const proof =
    files.proof === undefined
      ? undefined
      : inspectTimestamp(files.proof, rootDigest);

  if (proof && !proof.success) {
    requireSeal(false, proof.error);
  }

  const report = {
    pollId: manifest.pollId,
    rootDigest,
    verifiedSections,
    ...(disclosure?.sections.votes
      ? { talliesRecomputed: poll !== undefined }
      : {}),
    ...(file
      ? {
          verifiedAttachment: {
            id: file.id,
            questionId: file.questionId,
            sha256: file.sha256,
          },
        }
      : {}),
    ballot: ballot.kind,
    labels: poll ? ('verified' as const) : ('unavailable' as const),
    timestamp: proof?.value ?? ('notProvided' as const),
  };

  return { bundle, poll, ballot, report };
}

export function verifyEvidence(files: EvidenceFiles) {
  return sealResult(() => checkEvidence(files).report);
}

/** Render only the voter’s checked paths and choices. Original receipt text is
 * a cast-time claim until the corresponding canonical poll section is verified. */
export function verifyVoteEvidence(files: EvidenceFiles & { bundle: string }) {
  return sealResult(() => {
    const { report, bundle, ballot, poll } = checkEvidence(files);
    requireSeal(
      bundle && ballot.kind !== 'notChecked',
      codes.SEAL_INVALID_BUNDLE
    );
    const choices = bundle.leaves.map(({ preimage, hash }, index) => {
      const { questionId, answerId, weight } = preimage;
      const question = poll?.questions.find((q) => q.id === questionId);
      const answer = question?.answers.find((a) => a.id === answerId);
      const claim =
        ballot.kind === 'originalReceiptMatches'
          ? ballot.receipt.leaves[index]
          : undefined;
      const labels =
        question && answer
          ? {
              kind: 'sealed' as const,
              question: question.text,
              answer: answer.text,
            }
          : claim
            ? {
                kind: 'receipt' as const,
                question: claim.questionText,
                answer: claim.answerText,
              }
            : { kind: 'unavailable' as const };

      return {
        questionId,
        answerId,
        weight: weight.toDecimalString(),
        hash,
        labels,
      };
    });

    return { ...report, ballot: ballot.kind, choices };
  });
}
