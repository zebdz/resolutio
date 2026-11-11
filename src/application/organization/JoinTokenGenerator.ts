/** Port supplies validated join-link entropy; domain creation never generates
 * randomness or chooses a token value on the caller's behalf. */
import { JoinTokenValue } from '../../domain/organization/JoinTokenValues';
export interface JoinTokenGenerator {
  generate(): JoinTokenValue;
}
