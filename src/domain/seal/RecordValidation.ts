/** Strict v1 decoding validates bytes, section commitments and cross-section facts.
 * It never normalizes or silently rebuilds the saved record. */
import { z } from 'zod';
import { canonical, parseCanonical } from './Canonical';
import { assertHash, hashText } from './Hash';
import { MerkleTree } from './MerkleTree';
import {
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
import { hashLeaf, parseVotePreimage } from './VoteLeaf';
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
  const register = decode(
    z.array(registerEntrySchema),
    record.sections.register
  );
  const signers = decode(z.array(signerSchema), record.sections.signers);
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
  validateSnapshot(poll, register, votes, manifest.sealedAt);
  requireSeal(
    canonical(tally(poll, register, votes)) === record.sections.tallies
  );
  requireSeal(
    canonical(
      [...register]
        .sort((a, b) => compareText(a.userId, b.userId))
        .map(registerEntryData)
    ) === record.sections.register
  );
  const voters = new Set(votes.map((v) => v.userId));
  const byUser = new Map(register.map((p) => [p.userId, p]));

  for (const person of register) {
    requireSeal(person.voted === voters.has(person.userId));
    requireSeal(
      canonical([...person.holdings].sort(byHolding)) ===
        canonical(person.holdings)
    );
  }

  unique(signers.map((p) => p.userId));
  requireSeal(
    canonical([...signers].sort((a, b) => compareText(a.userId, b.userId))) ===
      record.sections.signers
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

  return { manifest, rootDigest: record.rootDigest };
}
