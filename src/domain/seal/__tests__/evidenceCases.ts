/** Synthetic export files shared by offline core and packaged CLI acceptance tests.
 * The replacement ballot keeps the voter's secret and has genuine paths under its new seal. */
import { readFileSync } from 'node:fs';
import { canonical } from '../Canonical';
import { hashText } from '../Hash';
import { Digest, UserId } from '../SealValues';
import { MerkleTree } from '../MerkleTree';
import { SealedRecordBuilder } from '../SealedRecordBuilder';
import { SealInput } from '../SealInput';
import fixture from './fixtures/record-v1.json';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import type { EvidenceFiles } from '../VerifyEvidence';

const bytes = (file: string) =>
  readFileSync(new URL('./fixtures/export-v1/' + file, import.meta.url));
export const evidence = {
  bundle: bytes('bundle.json').toString(),
  receipt: bytes('receipt.json').toString(),
  sections: bytes('sections.json').toString(),
  manifest: bytes('manifest.json').toString(),
  proof: Uint8Array.from(bytes('manifest.json.ots')),
};
const original = JSON.parse(evidence.receipt);
export const code = original.receiptSecret as string;

function changed(text: string, edit: (data: any) => void) {
  const data = JSON.parse(text);
  edit(data);

  return canonical(data);
}

function replacement() {
  const input = structuredClone(fixture.input) as SealInput;
  const amended = {
    ...input,
    votes: input.votes.filter(
      (v) =>
        !(
          v.userId === original.userId &&
          v.answerId === original.leaves[1].preimage.answerId
        )
    ),
  };
  const record = expectSuccess(
    SealedRecordBuilder.build(amended, new Date(fixture.sealedAt))
  ).record;
  const tree = MerkleTree.build(record.votes.map((v) => Digest.parse(v.hash)));
  const leaves = record.votes
    .filter((v) => v.preimage.userId === UserId.parse(original.userId))
    .map((v) => ({ ...v, path: tree.pathFor(Digest.parse(v.hash)) }));

  return canonical({
    manifest: record.manifest,
    rootDigest: record.rootDigest,
    leaves,
    poll: record.sections.poll,
  });
}

function inconsistentTallies() {
  const { manifest, sections, votes } = fixture.record;
  const tallies = changed(sections.tallies, (t) => t.totalParticipants++);
  const amended = changed(
    manifest,
    (m) => (m.sections.tallies.hash = hashText(tallies))
  );

  return canonical({
    manifest: amended,
    rootDigest: hashText(amended),
    sections: {
      poll: sections.poll,
      tallies,
      register: sections.register,
      votes,
    },
  });
}

export const replacementBallot = replacement();
export const invalidCases: readonly [string, EvidenceFiles, string][] = [
  [
    'omitted own leaf visible in the disclosed register and vote list',
    {
      bundle: changed(evidence.bundle, (b) => b.leaves.pop()),
      sections: canonical({
        manifest: evidence.manifest,
        rootDigest: fixture.record.rootDigest,
        sections: { ...fixture.record.sections, votes: fixture.record.votes },
      }),
    },
    'invalidBundle',
  ],
  [
    'a committed tally that conflicts with disclosed votes',
    { sections: inconsistentTallies() },
    'inconsistentRecord',
  ],
  [
    'replacement ballot with authentic new paths',
    { bundle: replacementBallot, receipt: evidence.receipt },
    'receiptMismatch',
  ],
  [
    'missing own leaf',
    {
      bundle: changed(evidence.bundle, (b) => b.leaves.pop()),
      receipt: evidence.receipt,
    },
    'receiptMismatch',
  ],
  [
    'extra leaf in receipt comparison',
    {
      bundle: evidence.bundle,
      receipt: changed(evidence.receipt, (r) => r.leaves.pop()),
    },
    'receiptMismatch',
  ],
  [
    'duplicate own leaf',
    { bundle: changed(evidence.bundle, (b) => b.leaves.push(b.leaves[0])) },
    'invalidBundle',
  ],
  [
    'different path',
    {
      bundle: changed(
        evidence.bundle,
        (b) => (b.leaves[0].path[0].hash = '11'.repeat(32))
      ),
    },
    'invalidPath',
  ],
  [
    'forged receipt label',
    {
      bundle: evidence.bundle,
      receipt: changed(
        evidence.receipt,
        (r) => (r.leaves[0].answerText = 'Fake')
      ),
    },
    'labelMismatch',
  ],
  [
    'changed poll bytes',
    {
      bundle: changed(
        evidence.bundle,
        (b) => (b.poll = b.poll.replace('Café', 'Forged'))
      ),
    },
    'sectionMismatch',
  ],
  [
    'changed section bytes',
    {
      sections: changed(evidence.sections, (s) => (s.sections.tallies += ' ')),
    },
    'sectionMismatch',
  ],
  [
    'changed manifest bytes',
    { manifest: evidence.manifest + ' ' },
    'invalidCanonical',
  ],
  [
    'unsupported format',
    { manifest: changed(evidence.manifest, (m) => (m.version = 2)) },
    'versionUnsupported',
  ],
  [
    'unsupported hash',
    { manifest: changed(evidence.manifest, (m) => (m.algorithm = 'other')) },
    'algorithmUnsupported',
  ],
  [
    'wrong root digest',
    {
      bundle: changed(
        evidence.bundle,
        (b) => (b.rootDigest = hashText('another'))
      ),
    },
    'manifestMismatch',
  ],
  [
    'wrong receipt code',
    { bundle: evidence.bundle, code: 'ff'.repeat(32) },
    'codeMismatch',
  ],
  ['empty bundle', { bundle: '{}' }, 'invalidBundle'],
  [
    'empty own leaf set',
    { bundle: changed(evidence.bundle, (b) => (b.leaves = [])) },
    'invalidBundle',
  ],
  ['malformed JSON', { bundle: '[]!' }, 'invalidCanonical'],
  [
    'receipt with no inclusion paths',
    { manifest: evidence.manifest, receipt: evidence.receipt },
    'invalidBundle',
  ],
  [
    'proof from another file',
    {
      manifest: evidence.manifest,
      proof: new Uint8Array(
        readFileSync(
          new URL(
            '../../../infrastructure/anchor/__tests__/fixtures/incomplete.txt.ots',
            import.meta.url
          )
        )
      ),
    },
    'proofDigestMismatch',
  ],
  [
    'truncated proof',
    { manifest: evidence.manifest, proof: evidence.proof.subarray(0, 65) },
    'invalidProof',
  ],
  [
    'trailing proof bytes',
    {
      manifest: evidence.manifest,
      proof: Uint8Array.from([...evidence.proof, 0]),
    },
    'invalidProof',
  ],
];
