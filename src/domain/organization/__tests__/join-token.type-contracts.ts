/** Compile-only clients cannot interchange join-link identity, token text, usage
 * limits/counts, or timestamps, nor omit generated creation inputs. */
import { JoinToken } from '../JoinToken';
type CreatedToken = ReturnType<JoinToken['toJSON']>;
// @ts-expect-error Creation results retain token identities rather than raw storage IDs.
const rawCreatedId: CreatedToken['id'] = 'join-token';
// @ts-expect-error Creation results retain validated use counts.
const rawCreatedCount: CreatedToken['useCount'] = -1;
// @ts-expect-error Generated join tokens retain their constrained alphabet and length.
const rawCreatedToken: CreatedToken['token'] = 'invalid';
import { JoinTokenRepository } from '../JoinTokenRepository';
import {
  JoinTokenValue,
  JoinTokenDescription,
  JoinTokenMaxUses,
  JoinTokenUseCount,
} from '../JoinTokenValues';
import { JoinTokenId, OrganizationId, UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
declare const token: JoinToken;
declare const repository: JoinTokenRepository;
const props = {
  organizationId: OrganizationId.parse('org'),
  createdById: UserId.parse('actor'),
  token: JoinTokenValue.parse('abc234defg'),
  description: JoinTokenDescription.parse('Lobby'),
  maxUses: JoinTokenMaxUses.parse(3),
};
const creation = {
  id: JoinTokenId.parse('link'),
  now: Instant.parse('2026-01-01T00:00:00.000Z'),
};
JoinToken.create(props, creation);
// @ts-expect-error Domain creation cannot generate its own ID or clock time.
JoinToken.create(props);
// @ts-expect-error A token use count is not its configured usage limit.
token.updateMaxUses(JoinTokenUseCount.parse(1));
// @ts-expect-error Raw numbers cannot bypass use-limit validation.
token.updateMaxUses(3);
// @ts-expect-error Lifecycle time must be an immutable validated instant.
token.expire(new Date());
// @ts-expect-error Token identity cannot stand in for the public token value.
repository.findByToken(JoinTokenId.parse('link'));
// @ts-expect-error Count changes must pass through aggregate behavior.
token.useCount = JoinTokenUseCount.parse(3);
// @ts-expect-error New links require a validated public token value.
JoinToken.create({ ...props, token: 'abc234defg' }, creation);
// @ts-expect-error Organization identity cannot stand in for join-link identity.
JoinToken.create(props, { ...creation, id: OrganizationId.parse('org') });
