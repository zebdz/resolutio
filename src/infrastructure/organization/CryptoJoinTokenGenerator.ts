/** Cryptographic join-link generator implements the application's entropy port
 * using the product's readable alphabet and fixed ten-character wire format. */
import { randomInt } from 'node:crypto';
import { JoinTokenGenerator } from '../../application/organization/JoinTokenGenerator';
import {
  JoinTokenValue,
  JOIN_TOKEN_CHARSET,
  JOIN_TOKEN_LENGTH,
} from '../../domain/organization/JoinTokenValues';
export class CryptoJoinTokenGenerator implements JoinTokenGenerator {
  generate(): JoinTokenValue {
    return JoinTokenValue.parse(
      Array.from(
        { length: JOIN_TOKEN_LENGTH },
        () => JOIN_TOKEN_CHARSET[randomInt(JOIN_TOKEN_CHARSET.length)]
      ).join('')
    );
  }
}
