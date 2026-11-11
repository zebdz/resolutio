/** Validated weight-mode and property-scope value object with a pure request decoder.
 * Construction retains defensive copies; the decoder enforces OPEN poll policy. */
import { z } from 'zod';
import { PropertyId } from '../shared/EntityIds';
import { DistributionType, parseDistributionType } from './DistributionType';
import {
  PropertyAggregation,
  parsePropertyAggregation,
} from './PropertyAggregation';
import { PollType } from './PollType';
import { PollDomainCode, PollDomainCodes } from './PollDomainCodes';
import { Result, success, failure } from '../shared/Result';

export interface PollWeightConfigProps {
  distributionType: DistributionType;
  propertyAggregation: PropertyAggregation;
  propertyIds: PropertyId[];
}

/** Decodes request/storage vocabulary under the poll's weight policy.
 * The OPEN rule keeps its existing error precedence over malformed overrides. */
export function parsePollWeightConfig(
  pollType: PollType,
  input: {
    distributionType: string;
    propertyAggregation: string;
    propertyIds: readonly string[];
  }
): Result<PollWeightConfigProps, PollDomainCode> {
  // One person, one vote is what makes an open poll open: any other weight
  // configuration would silently change who counts for how much.
  if (
    pollType === PollType.OPEN &&
    (input.distributionType !== DistributionType.EQUAL ||
      input.propertyAggregation !== PropertyAggregation.RAW_SUM ||
      input.propertyIds.length !== 0)
  ) {
    return failure(PollDomainCodes.POLL_OPEN_MUST_BE_EQUAL);
  }

  const distribution = parseDistributionType(input.distributionType);

  if (!distribution.success) {
    return distribution;
  }

  const aggregation = parsePropertyAggregation(input.propertyAggregation);

  if (!aggregation.success) {
    return aggregation;
  }

  const properties = z.array(PropertyId).safeParse(input.propertyIds);

  if (!properties.success) {
    return failure(PollDomainCodes.PROPERTY_NOT_IN_ORG);
  }

  return success({
    distributionType: distribution.value,
    propertyAggregation: aggregation.value,
    propertyIds: properties.data,
  });
}

export class PollWeightConfig {
  private constructor(private readonly props: PollWeightConfigProps) {}

  public static create(props: PollWeightConfigProps): PollWeightConfig {
    return new PollWeightConfig({
      distributionType: z.enum(DistributionType).parse(props.distributionType),
      propertyAggregation: z
        .enum(PropertyAggregation)
        .parse(props.propertyAggregation),
      propertyIds: props.propertyIds.map((id) => PropertyId.parse(id)),
    });
  }

  public get distributionType(): DistributionType {
    return this.props.distributionType;
  }

  public get propertyAggregation(): PropertyAggregation {
    return this.props.propertyAggregation;
  }

  public get propertyIds(): PropertyId[] {
    return [...this.props.propertyIds];
  }

  public equals(other: PollWeightConfig): boolean {
    if (this.props.distributionType !== other.props.distributionType) {
      return false;
    }

    if (this.props.propertyAggregation !== other.props.propertyAggregation) {
      return false;
    }

    const a = [...this.props.propertyIds].sort();
    const b = [...other.props.propertyIds].sort();

    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;
  }

  public merge(partial: Partial<PollWeightConfigProps>): PollWeightConfig {
    return PollWeightConfig.create({
      distributionType: partial.distributionType ?? this.props.distributionType,
      propertyAggregation:
        partial.propertyAggregation ?? this.props.propertyAggregation,
      propertyIds: partial.propertyIds ?? this.props.propertyIds,
    });
  }
}
