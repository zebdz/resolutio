/** Strict v1 decoding validates bytes, section commitments and cross-section facts.
 * It never normalizes or silently rebuilds the saved record. */
import { z } from 'zod';
import { canonical, parseCanonical } from './Canonical';
import { assertHash, hashText } from './Hash';
import { MerkleTree } from './MerkleTree';
import {
  PollSection,
  SealManifest,
  manifestSchema,
  pollSchema,
  registerEntrySchema,
  registerEntryData,
  SealedRecord,
  signerSchema,
  talliesSchema,
} from './RecordFormat';
import { byHolding, orderPoll, tally } from './RecordSections';
import { requireSeal } from './SealDomainCodes';
import { unique, validateSnapshot } from './SnapshotValidation';
import { assertV1, compareText, exactKeys } from './Validation';
import { VotePreimage, hashLeaf, parseVotePreimage } from './VoteLeaf';
import { Digest } from './SealValues';

function decode<T>(schema: z.ZodType<T>, bytes: string): T {
  const parsed = schema.safeParse(parseCanonical(bytes));
  requireSeal(parsed.success);

  return parsed.data;
}

export function readManifest(bytes: string) {
  const data = parseCanonical(bytes);
  assertV1(data);
  const parsed = manifestSchema.safeParse(data);
  requireSeal(parsed.success);

  return parsed.data;
}

export function validateRecord(record: SealedRecord) {
  exactKeys(record, ['manifest', 'rootDigest', 'sections', 'votes']);
  const manifest = readManifest(record.manifest);
  assertHash(record.rootDigest);
  requireSeal(hashText(record.manifest) === record.rootDigest);
  exactKeys(record.sections, ['poll', 'tallies', 'register', 'signers']);

  for (const key of ['poll', 'tallies', 'register', 'signers'] as const) {
    requireSeal(
      typeof record.sections[key] === 'string' &&
        hashText(record.sections[key]) === manifest.sections[key].hash
    );
  }

  const poll = decode(pollSchema, record.sections.poll);
  decode(talliesSchema, record.sections.tallies);
  requireSeal(
    poll.id === manifest.pollId &&
      canonical(orderPoll(poll)) === record.sections.poll
  );
  requireSeal(Array.isArray(record.votes));
  const hashes: Digest[] = [];
  const votes = record.votes.map((vote) => {
    exactKeys(vote, ['preimage', 'hash']);
    const preimage = parseVotePreimage(vote.preimage);
    requireSeal(hashLeaf(preimage) === vote.hash);
    hashes.push(Digest.parse(vote.hash));

    return preimage;
  });

  const tree = MerkleTree.build(hashes);
  requireSeal(canonical(tree.leaves) === canonical(hashes));
  requireSeal(
    tree.root === manifest.sections.votes.root &&
      hashes.length === manifest.sections.votes.leafCount
  );
  validateNamedSections(manifest, poll, record.sections, votes);

  return { manifest, rootDigest: record.rootDigest };
}

/** When the register and vote list are disclosed, reproduce the tally and enforce the
 * same participant and ballot invariants as record rehydration. Only admins get signers. */
export function validateNamedSections(
  manifest: SealManifest,
  poll: PollSection | undefined,
  sections: { register: string; tallies: string; signers?: string },
  votes: VotePreimage[]
) {
  const register = decode(z.array(registerEntrySchema), sections.register);

  if (poll) {
    validateSnapshot(poll, register, votes, manifest.sealedAt);
    requireSeal(canonical(tally(poll, register, votes)) === sections.tallies);
  }

  requireSeal(
    canonical(
      [...register]
        .sort((a, b) => compareText(a.userId, b.userId))
        .map(registerEntryData)
    ) === sections.register
  );
  const voters = new Set(votes.map((v) => v.userId));

  for (const person of register) {
    requireSeal(person.voted === voters.has(person.userId));
    requireSeal(
      canonical([...person.holdings].sort(byHolding)) ===
        canonical(person.holdings)
    );
  }

  if (sections.signers === undefined) {
    return;
  }

  const signers = decode(z.array(signerSchema), sections.signers);
  const byUser = new Map(register.map((p) => [p.userId, p]));
  unique(signers.map((p) => p.userId));
  requireSeal(
    canonical([...signers].sort((a, b) => compareText(a.userId, b.userId))) ===
      sections.signers
  );

  for (const signer of signers) {
    const person = byUser.get(signer.userId);
    requireSeal(
      person &&
        person.voted &&
        person.firstName === signer.firstName &&
        person.lastName === signer.lastName &&
        person.middleName === signer.middleName
    );
    requireSeal(signer.willingToSignProtocol || signer.phoneNumber === null);
  }
}
