/** Exercises the final protocol reader as a viewer. Fixtures are independently
 * committed bytes; live membership can change between reads of the same record. */
import { expect, it, vi } from 'vitest';
import fixture from '@/domain/seal/__tests__/fixtures/record-v1.json';
import { SealedRecordBuilder } from '@/domain/seal/SealedRecordBuilder';
import { SealPersistenceFailureCode } from '@/domain/seal/SealPersistenceFailureCode';
import { SealInput } from '@/domain/seal/SealInput';
import { PollId, UserId } from '@/domain/shared/EntityIds';
import { PollSeal } from '@/domain/seal/PollSeal';
import { failure, success } from '@/domain/shared/Result';
import {
  GetSealedProtocolUseCase,
  ProtocolViewer,
} from '../GetSealedProtocolUseCase';

const pollId = PollId.parse('poll1');
const voter = UserId.parse('user1');
const otherVoter = UserId.parse('user2');
const adminId = UserId.parse('admin');
const seal = PollSeal.fromRecord(fixture.record);
const member: ProtocolViewer = {
  state: 'FINISHED',
  hasFinishedAt: true,
  isOpen: false,
  anonymous: true,
  facts: { isAdmin: false, isOrgMember: true, isPollVoter: true },
};
const api = (viewer = member, record: PollSeal | null = seal) =>
  new GetSealedProtocolUseCase(
    { forProtocol: async () => success(viewer) },
    {
      findByPollId: vi.fn(async () => success(record)),
    }
  );

it('prints frozen results and unique turnout without voter identities or contacts', async () => {
  const result = await api().execute(pollId, voter, 'resultsPdf');
  expect(result).toMatchObject({
    success: true,
    value: {
      kind: 'sealed',
      seal: {
        rootDigest: fixture.record.rootDigest,
        status: { kind: 'awaitingSubmission' },
      },
      data: {
        pollTitle: 'Café',
        pollDescription: 'Decision',
        organizationName: 'Organization',
        totalParticipants: 3,
        votedParticipants: 2,
        weightOfVoted: 3.234568,
        totalWeight: 6.234568,
        questions: [
          { questionText: 'First?', totalVotes: 3, totalWeight: 4.469135 },
          { questionText: 'Second?', totalVotes: 2 },
        ],
      },
    },
  });

  for (const privateValue of [
    'Last1',
    'user1',
    '+70000000001',
    'salt',
    'Private',
  ]) {
    expect(JSON.stringify(result)).not.toContain(privateValue);
  }
});

it('authorizes a current viewer before any seal read and preserves export policy errors', async () => {
  const read = vi.fn(async () => success(seal));
  const guest = new GetSealedProtocolUseCase(
    {
      forProtocol: async () =>
        success({
          ...member,
          facts: { isAdmin: false, isOrgMember: false, isPollVoter: false },
        }),
    },
    { findByPollId: read }
  );
  expect(await guest.execute(pollId, otherVoter, 'resultsPdf')).toEqual({
    success: false,
    error: 'domain.poll.pollResultsNotOrgMember',
  });
  expect(read).not.toHaveBeenCalled();
});

it.each([
  ['ACTIVE', false, 'preliminary'],
  ['FINISHED', false, 'unsealed'],
  ['FINISHED', true, 'sealing'],
] as const)(
  'distinguishes live coverage for %s with finish timestamp %s',
  async (state, hasFinishedAt, coverage) => {
    const result = await api(
      { ...member, state, hasFinishedAt, anonymous: false },
      null
    ).execute(pollId, voter, 'resultsPdf');
    expect(result).toEqual({
      success: true,
      value: {
        kind: 'live',
        coverage,
        canViewVoterNames: true,
        canViewSignWillingness: false,
      },
    });
  }
);

it('returns the frozen signed-in page including own ballot flag without hidden names or signers', async () => {
  const result = await api().execute(pollId, voter, 'page');
  expect(result).toMatchObject({
    success: true,
    value: {
      kind: 'sealed',
      data: {
        title: 'Café',
        description: '**Decision**',
        attachmentIds: ['file1'],
        questionFiles: [
          {
            id: 'file2',
            questionId: 'q2',
            fileName: 'appendix.pdf',
            mimeType: 'application/pdf',
          },
        ],
        scopedPropertyNames: [],
        showAggregation: true,
        isOpenPoll: false,
        hasOwnVote: true,
        isPollCreator: false,
        canViewVoterNames: false,
        canViewSignWillingness: false,
        results: {
          pollId: 'poll1',
          votedParticipants: 2,
          totalWeight: 6.234568,
          protocolSignWillingness: [],
          questions: [
            { answers: [{ voters: [] }, { voters: [] }] },
            { answers: [{ voters: [] }] },
          ],
        },
      },
    },
  });

  for (const hidden of [
    'user1',
    'First1',
    '+70000000001',
    'salt',
    'asset1',
    'House',
  ]) {
    expect(JSON.stringify(result)).not.toContain(hidden);
  }
});

it('prints frozen names, holdings, voters and non-voters from a named poll', async () => {
  const input = structuredClone(fixture.input) as SealInput;
  input.poll.anonymous = false;
  input.poll.boardId = 'board1';
  input.poll.boardName = 'Original board';
  const built = SealedRecordBuilder.build(input, new Date(fixture.sealedAt));

  if (!built.success) {
    throw new Error(built.error);
  }

  input.poll.boardName = 'New board';
  input.participants.forEach((p) => {
    p.lastName = 'Renamed';
    p.holdings = [];
  });
  const result = await api(
    { ...member, anonymous: false },
    built.value
  ).execute(pollId, voter, 'namedPdf');
  expect(result).toMatchObject({
    success: true,
    value: {
      kind: 'sealed',
      data: {
        boardName: 'Original board',
        isPreliminary: false,
        isPropertyBased: true,
        register: expect.arrayContaining([
          expect.objectContaining({
            userId: 'user1',
            fullName: 'Last1 First1',
            holdings: [
              expect.objectContaining({
                propertyName: 'House',
                assetName: 'Flat',
                sizeUnitKey: 'propertyAdmin.sizeUnit.squareMeters',
                share: 0.12345678,
              }),
            ],
          }),
        ]),
        questions: [
          {
            questionText: 'First?',
            nonVoterIds: ['user3'],
            answers: [
              {
                voters: expect.arrayContaining([
                  { userId: 'user1', weight: 1.234567 },
                ]),
              },
              { voters: [{ userId: 'user1', weight: 1.234567 }] },
            ],
          },
          { questionText: 'Second?', nonVoterIds: ['user3'] },
        ],
      },
    },
  });
  expect(JSON.stringify(result)).not.toMatch(
    /70000000001|Renamed|New board|salt|phoneNumber/
  );
});

it('rejects named export of an anonymous record even if the current poll is marked named', async () => {
  const result = await api({
    ...member,
    anonymous: false,
    facts: { ...member.facts, isAdmin: true },
  }).execute(pollId, adminId, 'namedPdf');
  expect(result).toEqual({
    success: false,
    error: 'domain.poll.pollIsAnonymous',
  });
});

it('requires admin for signer contacts and prints only recorded decisions', async () => {
  const read = (reader: GetSealedProtocolUseCase) =>
    reader.execute(pollId, adminId, 'signersPdf');
  expect(await read(api())).toEqual({
    success: false,
    error: 'domain.poll.pollResultsAdminOnly',
  });
  const admin = { ...member, facts: { ...member.facts, isAdmin: true } };
  const result = await read(api(admin));
  expect(result).toMatchObject({
    success: true,
    value: {
      kind: 'sealed',
      data: {
        organizationName: 'Organization',
        boardName: null,
        pollTitle: 'Café',
        entries: [
          {
            firstName: 'First1',
            lastName: 'Last1',
            willingToSignProtocol: true,
            phoneNumber: '+70000000001',
          },
          {
            firstName: 'First2',
            lastName: 'Last2',
            willingToSignProtocol: false,
            phoneNumber: null,
          },
        ],
      },
    },
  });
  expect(JSON.stringify(result)).not.toMatch(
    /Last3|asset1|user1|sections|salt/
  );
});

it('preserves millionths and the winner when two totals round to the same JS number', async () => {
  const input = structuredClone(fixture.input) as SealInput;
  const question = input.poll.questions.find((q) => q.id === 'q1')!;
  question.questionType = 'single-choice';
  input.poll.questions = [question];
  input.poll.attachments = [];
  input.poll.anonymous = false;
  const person = input.participants[0];
  const ballot = input.votes[0];
  input.participants = Array.from({ length: 40 }, (_, i) => ({
    ...person,
    userId: 'person' + i,
    weight:
      i === 0
        ? '999999999.999998'
        : i === 20
          ? '999999999.999997'
          : '999999999.999999',
    receiptSecret: i.toString(16).padStart(64, '0'),
  }));
  input.votes = input.participants.map((p, i) => ({
    ...ballot,
    userId: p.userId,
    weight: p.weight,
    questionId: 'q1',
    answerId: i < 20 ? 'a1' : 'a2',
  }));
  const built = SealedRecordBuilder.build(input, new Date(fixture.sealedAt));

  if (!built.success) {
    throw new Error(built.error);
  }

  const reader = api({ ...member, anonymous: false }, built.value);

  for (const purpose of ['resultsPdf', 'namedPdf'] as const) {
    const result =
      purpose === 'resultsPdf'
        ? await reader.execute(pollId, voter, 'resultsPdf')
        : await reader.execute(pollId, voter, 'namedPdf');
    expect(result).toMatchObject({
      success: true,
      value: {
        data: {
          questions: [
            {
              winningAnswerId: 'a1',
              answers: [
                { answerId: 'a1', exactWeight: '19999999999.999979' },
                { answerId: 'a2', exactWeight: '19999999999.999978' },
              ],
            },
          ],
        },
      },
    });
  }
});

it('never substitutes live material when stored data cannot be verified', async () => {
  const corrupt = SealPersistenceFailureCode.parse(
    'domain.seal.inconsistentRecord'
  );
  const reader = new GetSealedProtocolUseCase(
    { forProtocol: async () => success(member) },
    {
      findByPollId: async () => failure(corrupt),
    }
  );
  expect(await reader.execute(pollId, voter, 'page')).toEqual({
    success: false,
    error: corrupt,
  });
});

it('reports reduced disclosure when an admin loses their role during live results loading', async () => {
  let viewer: ProtocolViewer = {
    ...member,
    facts: { ...member.facts, isAdmin: true },
  };
  const reader = new GetSealedProtocolUseCase(
    { forProtocol: async () => success(viewer) },
    { findByPollId: async () => success(null) }
  );
  expect(await reader.execute(pollId, adminId, 'page')).toMatchObject({
    value: {
      kind: 'live',
      canViewVoterNames: true,
      canViewSignWillingness: true,
    },
  });
  viewer = member;
  expect(await reader.execute(pollId, adminId, 'page')).toMatchObject({
    value: {
      kind: 'live',
      canViewVoterNames: false,
      canViewSignWillingness: false,
    },
  });
});
