import { z } from 'zod';

export const legalAnnotationSchema = z.object({
  questionId: z.string().describe('The ID of the question with the issue'),
  answerId: z
    .string()
    .nullable()
    .describe(
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
  totalIssues: z.number().describe('Total number of issues found'),
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
