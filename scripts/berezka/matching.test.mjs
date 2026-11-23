/** Synthetic destination fixtures exercise identity decisions without real account data. */
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { matchAccounts } from './matching.mjs';

const source = {
  id: 1,
  phone: '9990001234',
  name: 'Иванов Иван Иванович (архив)',
  email: 'A@example.org',
};
const target = {
  id: 'target',
  phone_number: '+79990001234',
  full_name: ' иванов  Иван Иванович ',
  confirmed_at: new Date(),
  email: 'a@example.org',
  nickname: 'existing',
};

test('unique confirmed phone and full name reuse one identity including the creator', () => {
  const [decision] = matchAccounts([source], [target]);
  assert.equal(decision.action, 'reuse');
  assert.equal(decision.targetId, target.id);
});

test('ambiguous evidence requires explicit review for each affected legacy ID', () => {
  for (const candidate of [
    { ...target, confirmed_at: null },
    { ...target, full_name: 'Different' },
    { ...target, phone_number: '+79999999999', email: null },
    { ...target, phone_number: '+79999999999', full_name: 'Different' },
    { ...target, email: 'other@example.org' },
  ]) {
    assert.equal(matchAccounts([source], [candidate])[0].action, 'review');
  }

  assert.equal(
    matchAccounts([{ ...source, id: 117 }], [target])[0].action,
    'review'
  );
  assert.deepEqual(
    matchAccounts([source, { ...source, id: 2 }], [target]).map(
      (x) => x.action
    ),
    ['review', 'review']
  );
  assert.equal(
    matchAccounts(
      [source],
      [target, { ...target, id: 'other', phone_number: '+79999999999' }]
    )[0].action,
    'review'
  );
});

test('persisted mappings precede matching, failed references and conflicting overrides stop apply', () => {
  const unrelated = {
    ...target,
    phone_number: '+13125550127',
    full_name: 'New Name',
    email: null,
  };
  assert.equal(
    matchAccounts([source], [unrelated], { 1: 'target' })[0].targetId,
    'target'
  );
  assert.equal(
    matchAccounts([source], [], { 1: 'missing' })[0].action,
    'review'
  );
  assert.equal(
    matchAccounts([source], [target], { 1: 'target' }, { 1: 'missing' })[0]
      .action,
    'review'
  );
  const ambiguous = { ...target, confirmed_at: null };
  assert.equal(
    matchAccounts([source], [ambiguous], {}, { 1: 'target' })[0].action,
    'reuse'
  );
  assert.equal(
    matchAccounts([source], [ambiguous], {}, { 1: 'create' })[0].action,
    'review'
  );
  assert.equal(
    matchAccounts(
      [source],
      [{ ...unrelated, full_name: source.name.split('(')[0] }],
      {},
      { 1: 'create' }
    )[0].action,
    'create'
  );
  const [fresh] = matchAccounts(
    [source],
    [{ ...unrelated, nickname: 'Berezka_1' }]
  );
  assert.equal(fresh.nickname, 'berezka_1_2');
});

test('an approved create override validates the same durable new account on replay', () => {
  const persisted = { 1: 'berezka-user-1' };
  const decision = matchAccounts(
    [source],
    [{ ...target, id: 'berezka-user-1' }],
    persisted,
    { 1: 'create' }
  )[0];
  assert.equal(decision.action, 'reuse');
  assert.equal(decision.targetId, 'berezka-user-1');
});

test('a reviewed conflicting account must be reviewed again if its identifiers change', () => {
  const before = { ...target, email: 'first@example.org' };
  const after = { ...target, email: 'second@example.org' };
  assert.notDeepEqual(
    matchAccounts([source], [before], {}, { 1: target.id }),
    matchAccounts([source], [after], {}, { 1: target.id })
  );
});

test('an override for the placeholder keeps its source digits and unconfirmed status', () => {
  const placeholder = { ...source, id: 117, phone: '1234567890' };
  const same = { ...target, phone_number: '+71234567890', confirmed_at: null };
  assert.equal(
    matchAccounts([placeholder], [same], {}, { 117: 'target' })[0].action,
    'reuse'
  );

  for (const account of [target, { ...same, confirmed_at: new Date() }]) {
    assert.equal(
      matchAccounts([placeholder], [account], {}, { 117: 'target' })[0].action,
      'review'
    );
  }
});

test('plans a missing unconfirmed source email for reuse without overwriting an existing contact or taking another account’s email', () => {
  const blank = { ...target, email: null };
  assert.equal(matchAccounts([source], [blank])[0].addSourceEmail, true);
  assert.equal(matchAccounts([source], [target])[0].addSourceEmail, false);
  const occupied = {
    ...target,
    id: 'someone-else',
    phone_number: '+19990001234',
    full_name: 'Someone Else',
  };
  assert.equal(
    matchAccounts([source], [blank, occupied], {}, { 1: 'target' })[0]
      .addSourceEmail,
    false
  );
});
