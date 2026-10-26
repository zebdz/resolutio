/** Pure factory for a complete, consistent sealing snapshot. Computes the five
 * commitments without querying live metadata or using floating-point arithmetic. */
import { canonical, prepareNfc } from './Canonical';
import { hashText } from './Hash';
import { MerkleTree } from './MerkleTree';
import { PollSeal } from './PollSeal';
import { SealInput } from './SealInput';
import { parseInput } from './SnapshotValidation';
import { sealResult } from './SealDomainCodes';
import { deriveSalt, hashLeaf, votePreimageData } from './VoteLeaf';
import { UtcTimestamp } from './SealValues';
import { byHolding, orderPoll, tally } from './RecordSections';
import { compareText } from './Validation';
import { RegisterEntry, registerEntryData, SignerEntry } from './RecordFormat';

export class SealedRecordBuilder {
  static build(input: SealInput, sealedAt: Date) {
    return sealResult(() => {
      const time = UtcTimestamp.fromDate(sealedAt);
      const source = parseInput(prepareNfc(input), time);
      const poll = orderPoll(source.poll);
      const participants = [...source.participants].sort((a, b) =>
        compareText(a.userId, b.userId)
      );
      const selections = source.votes.map((v) => v.selection);
      const voters = new Set(selections.map((v) => v.userId));
      const register: RegisterEntry[] = participants.map((p) => ({
        userId: p.userId,
        lastName: p.lastName,
        firstName: p.firstName,
        middleName: p.middleName,
        weight: p.weight,
        snapshotAt: p.snapshotAt,
        voted: voters.has(p.userId),
        holdings: [...p.holdings].sort(byHolding),
      }));
      const signers: SignerEntry[] = participants.flatMap((p) => {
        const decision = p.willingToSignProtocol;

        if (!voters.has(p.userId) || decision === null) {
          return [];
        }

        return [
          {
            userId: p.userId,
            lastName: p.lastName,
            firstName: p.firstName,
            middleName: p.middleName,
            willingToSignProtocol: decision,
            phoneNumber: decision ? p.phoneNumber : null,
          },
        ];
      });
      const tallies = tally(poll, participants, selections);
      const votes = source.votes
        .map(({ selection: v, receiptSecret }) => {
          const preimage = {
            ...v,
            salt: deriveSalt(receiptSecret, v.questionId, v.answerId),
          };

          return {
            preimage: votePreimageData(preimage),
            hash: hashLeaf(preimage),
          };
        })
        .sort((a, b) => compareText(a.hash, b.hash));
      const tree = MerkleTree.build(votes.map((v) => v.hash));
      const sections = {
        poll: canonical(poll),
        tallies: canonical(tallies),
        register: canonical(register.map(registerEntryData)),
        signers: canonical(signers),
      };
      const manifest = canonical({
        version: 1,
        algorithm: 'sha256',
        pollId: poll.id,
        sealedAt: time,
        sections: {
          poll: { hash: hashText(sections.poll) },
          tallies: { hash: hashText(sections.tallies) },
          register: { hash: hashText(sections.register) },
          signers: { hash: hashText(sections.signers) },
          votes: { root: tree.root, leafCount: votes.length },
        },
      });

      return PollSeal.fromRecord({
        manifest,
        rootDigest: hashText(manifest),
        sections,
        votes,
      });
    });
  }
}
