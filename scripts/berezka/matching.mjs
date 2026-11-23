/** Resolve identities against a single destination snapshot before granting any Berezka access. */
import { createHash } from 'node:crypto';
const identityDigest = (account) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        account.id,
        account.phone_number,
        account.full_name,
        account.email,
        account.confirmed_at,
      ])
    )
    .digest('hex');
const normalize = (value) =>
  (value ?? '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');

const phone = (value) => {
  const digits = value.replace(/[\s()\-+]/g, '');

  if (value.trim().startsWith('+')) {
    return '+' + digits;
  }

  if (digits.length === 10) {
    return '+7' + digits;
  }

  if (digits.length === 11 && digits[0] === '8') {
    return '+7' + digits.slice(1);
  }

  return '+' + digits;
};

export function matchAccounts(users, targets, persisted = {}, overrides = {}) {
  const decisions = users.map((user) => {
    const name = normalize(user.name.split('(')[0]);
    const email = normalize(user.email);
    const candidates = targets.flatMap((account) => {
      const byName = normalize(account.full_name) === name;
      const byPhone = phone(account.phone_number) === phone(user.phone);
      const byEmail = Boolean(email && normalize(account.email) === email);

      if (!(byName || byPhone || byEmail)) {
        return [];
      }

      return [
        {
          id: account.id,
          evidenceDigest: identityDigest(account),
          byName,
          byPhone,
          byEmail,
          confirmed: Boolean(account.confirmed_at),
          emailConflict: Boolean(email && normalize(account.email) && !byEmail),
        },
      ];
    });
    const [candidate] = candidates;
    let action = 'create';

    if (candidate) {
      action =
        candidates.length === 1 &&
        user.id !== 117 &&
        candidate.byName &&
        candidate.byPhone &&
        candidate.confirmed &&
        !candidate.emailConflict
          ? 'reuse'
          : 'review';
    }

    return {
      legacyId: user.id,
      action,
      targetId: action === 'reuse' ? candidate.id : null,
      candidates,
    };
  });
  const claimed = new Map();

  for (const decision of decisions) {
    for (const candidate of decision.candidates) {
      claimed.set(candidate.id, (claimed.get(candidate.id) ?? 0) + 1);
    }
  }

  for (const decision of decisions) {
    if (decision.candidates.some((c) => claimed.get(c.id) > 1)) {
      decision.action = 'review';
      decision.targetId = null;
    }
  }

  const ids = new Set(targets.map((t) => t.id));
  const nicknames = new Set(targets.map((t) => normalize(t.nickname)));
  const sources = new Map(users.map((u) => [u.id, u]));

  for (const decision of decisions) {
    const { legacyId, candidates } = decision;
    const saved = persisted[legacyId];
    const override = overrides[legacyId];
    const chosen = saved ?? override;

    if (chosen !== undefined && chosen !== null) {
      decision.action = 'review';
      decision.targetId = null;

      if (
        saved &&
        override &&
        override !== saved &&
        !(override === 'create' && saved === 'berezka-user-' + legacyId)
      ) {
        continue;
      }

      if (
        !saved &&
        chosen === 'create' &&
        !candidates.some((c) => c.byPhone || c.byEmail)
      ) {
        decision.action = 'create';
      } else if (ids.has(chosen)) {
        const account = targets.find((t) => t.id === chosen);

        if (
          !saved &&
          legacyId === 117 &&
          (account.confirmed_at ||
            phone(account.phone_number) !== phone(sources.get(legacyId).phone))
        ) {
          continue;
        }

        decision.action = 'reuse';
        decision.targetId = chosen;
        decision.resolvedIdentityDigest = identityDigest(account);
      }
    }

    if (decision.action === 'create' && ids.has('berezka-user-' + legacyId)) {
      decision.action = 'review';
    }

    if (decision.action === 'create') {
      const base = 'berezka_' + legacyId;
      let nickname = base;
      let suffix = 2;

      while (nicknames.has(nickname)) {
        nickname = base + '_' + suffix++;
      }

      nicknames.add(nickname);
      decision.nickname = nickname;
    }
  }

  const unique = new Map();
  const occupiedEmails = new Set(
    targets.map((t) => normalize(t.email)).filter(Boolean)
  );
  const accountsById = new Map(targets.map((t) => [t.id, t]));

  for (const decision of decisions) {
    const user = sources.get(decision.legacyId);

    if (decision.action === 'reuse') {
      const target = accountsById.get(decision.targetId);
      decision.addSourceEmail = Boolean(
        !target.email &&
        user.email &&
        !occupiedEmails.has(normalize(user.email))
      );
    }

    const keys =
      decision.action === 'reuse'
        ? [
            'id:' + decision.targetId,
            ...(decision.addSourceEmail
              ? ['email:' + normalize(user.email)]
              : []),
          ]
        : decision.action === 'create'
          ? [
              'phone:' + phone(user.phone),
              ...(user.email ? ['email:' + normalize(user.email)] : []),
            ]
          : [];

    for (const key of keys) {
      if (!unique.has(key)) {
        unique.set(key, []);
      }

      unique.get(key).push(decision);
    }
  }

  for (const group of unique.values()) {
    if (group.length > 1) {
      for (const row of group) {
        row.action = 'review';
        row.targetId = null;
      }
    }
  }

  return decisions;
}
