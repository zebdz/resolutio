/** Supplies candidate nicknames from outside the deterministic user domain.
 * Registration checks uniqueness before persisting a candidate. */
import { Nickname } from '@/domain/user/Nickname';

export interface NicknameGenerator {
  generate(): Nickname;
}
