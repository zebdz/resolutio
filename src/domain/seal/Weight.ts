/** Nonnegative weights in integer millionths. Row inputs fit Decimal(15,6);
 * aggregate sums intentionally have no row-size limit. */
import { requireSeal, SealDomainCodes } from './SealDomainCodes';

export class Weight {
  private constructor(private readonly millionths: bigint) {}

  static fromDecimalString(value: string): Weight {
    requireSeal(
      typeof value === 'string' &&
        /^(0|[1-9][0-9]{0,8})\.[0-9]{6}$/.test(value),
      SealDomainCodes.SEAL_INVALID_WEIGHT
    );
    const [integer, fraction] = value.split('.');

    return new Weight(BigInt(integer) * BigInt(1000000) + BigInt(fraction));
  }

  add(other: Weight): Weight {
    return new Weight(this.millionths + other.millionths);
  }

  equals(other: Weight): boolean {
    return this.millionths === other.millionths;
  }

  toDecimalString(): string {
    return `${this.millionths / BigInt(1000000)}.${(this.millionths % BigInt(1000000)).toString().padStart(6, '0')}`;
  }
}
