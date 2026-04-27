import { DistributionType } from './DistributionType';
import { PropertyAggregation } from './PropertyAggregation';

export interface PollWeightConfigProps {
  distributionType: DistributionType;
  propertyAggregation: PropertyAggregation;
  propertyIds: string[];
}

export class PollWeightConfig {
  private constructor(private readonly props: PollWeightConfigProps) {}

  public static create(props: PollWeightConfigProps): PollWeightConfig {
    return new PollWeightConfig({
      distributionType: props.distributionType,
      propertyAggregation: props.propertyAggregation,
      propertyIds: [...props.propertyIds],
    });
  }

  public get distributionType(): DistributionType {
    return this.props.distributionType;
  }

  public get propertyAggregation(): PropertyAggregation {
    return this.props.propertyAggregation;
  }

  public get propertyIds(): string[] {
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
