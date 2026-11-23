/** Stable, opaque destination keys for imported poll, question and attachment resources. */
import { identifier } from '../shared/Identifier';
import type { z } from 'zod';
const key = /^hist_[0-9a-f]{32}$/;
export const HistoricalPollId = identifier('HistoricalPollId', key);
export type HistoricalPollId = z.infer<typeof HistoricalPollId>;
export const HistoricalQuestionId = identifier('HistoricalQuestionId', key);
export type HistoricalQuestionId = z.infer<typeof HistoricalQuestionId>;
export const HistoricalAssetKey = identifier('HistoricalAssetKey', key);
export type HistoricalAssetKey = z.infer<typeof HistoricalAssetKey>;
