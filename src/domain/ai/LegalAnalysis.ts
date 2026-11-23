/** Validated legal-analysis values belong to the core, independent of AI providers.
 * Provider responses and persisted JSON are decoded before entering the domain. */
import { QuestionId, AnswerId } from '../shared/EntityIds';
import { identifier } from '../shared/Identifier';
import { z } from 'zod';

export const LegalIssueCount = z
  .number()
  .int()
  .nonnegative()
  .brand<'LegalIssueCount'>();
export type LegalIssueCount = z.infer<typeof LegalIssueCount>;
export const TokenCount = z.number().int().nonnegative().brand<'TokenCount'>();
export type TokenCount = z.infer<typeof TokenCount>;
export const LegalCheckCount = z
  .number()
  .int()
  .nonnegative()
  .brand<'LegalCheckCount'>();
export type LegalCheckCount = z.infer<typeof LegalCheckCount>;
// Stable registry keys are opaque ASCII tokens, independent of provider versions.
export const AIModelKey = identifier('AIModelKey', /^[A-Za-z0-9_-]+$/);
export type AIModelKey = z.infer<typeof AIModelKey>;
// Configured Google/DeepSeek models use slugs with optional dotted version numbers.
export const ProviderModelId = identifier(
  'ProviderModelId',
  /^[A-Za-z0-9][A-Za-z0-9._-]*$/
);
export type ProviderModelId = z.infer<typeof ProviderModelId>;
export const legalAnnotationSchema = z.object({
  questionId: QuestionId.describe('The ID of the question with the issue'),
  answerId: AnswerId.nullable().describe(
    'The ID of the specific answer, or null if the issue is with the question itself'
  ),
  severity: z
    .enum(['warning', 'danger'])
    .describe('warning = potentially problematic, danger = likely illegal'),
  issue: z
    .string()
    .describe('Short label describing the issue (1-2 sentences)'),
  explanation: z
    .string()
    .describe('Detailed explanation of why this is problematic'),
  legalBasis: z
    .string()
    .describe('Specific Russian Federation law, article, or regulation'),
});

export const legalAnalysisSummarySchema = z.object({
  totalIssues: LegalIssueCount.describe('Total number of issues found'),
  overallRisk: z
    .enum(['low', 'medium', 'high'])
    .describe('Overall risk assessment'),
  recommendation: z.string().describe('Brief overall guidance for the admin'),
});

export const legalAnalysisResultSchema = z.object({
  annotations: z
    .array(legalAnnotationSchema)
    .describe('List of legal issues found in the poll questions and answers'),
  summary: legalAnalysisSummarySchema.describe(
    'Overall summary of the legal analysis'
  ),
});

export type LegalAnnotation = z.infer<typeof legalAnnotationSchema>;
export type LegalAnalysisSummary = z.infer<typeof legalAnalysisSummarySchema>;
export type LegalAnalysisResult = z.infer<typeof legalAnalysisResultSchema>;
