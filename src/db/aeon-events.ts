import type { Pool } from 'pg';
import { insertEventWithId } from './insert-event.js';

export type InsertCardComputedParams = {
  sessionId: string;
  maxUserId: number;
  cardType: string;
  confidence: number;
  confidenceResolution?: string;
  confidenceMessage?: string;
  inputAnswerIds: readonly string[];
  version: string;
  protocolVersion: string;
  coordinates: Record<string, unknown>;
  matchedTypes: readonly string[];
  syntheticDrawing: boolean;
  coreUnformed: boolean;
};

export async function insertCardComputed(
  pool: Pool,
  params: InsertCardComputedParams,
): Promise<{ eventId: string; inserted: boolean }> {
  const idempotencyKey = `card.computed:${params.sessionId}:${params.cardType}`;
  return insertEventWithId(pool, {
    eventType: 'card.computed',
    actor: { id: 'aeon-max-bot', role: 'service' },
    subject: { entity: 'session', id: params.sessionId },
    payload: {
      session_id: params.sessionId,
      max_user_id: params.maxUserId,
      card_type: params.cardType,
      confidence: params.confidence,
      ...(params.confidenceResolution != null ? { confidence_resolution: params.confidenceResolution } : {}),
      ...(params.confidenceMessage != null ? { confidence_message: params.confidenceMessage } : {}),
      input_answer_ids: [...params.inputAnswerIds],
      version: params.version,
      protocol_version: params.protocolVersion,
      coordinates: params.coordinates,
      matched_types: [...params.matchedTypes],
      synthetic_drawing: params.syntheticDrawing,
      core_unformed: params.coreUnformed,
    },
    idempotencyKey,
    schemaVersion: 1,
    correlationId: params.sessionId,
  });
}

export type InsertCardRenderedParams = {
  sessionId: string;
  maxUserId: number;
  cardType: string;
  /** Полный markdown текста карты для пользователя. */
  cardText: string;
  promptVersion: string;
  llmCallEventId: string;
  protocolVersion: string;
  /** Версия схемы payload card.rendered. */
  version: string;
  matchedTypes: readonly string[];
  model: string;
  provider: string;
};

export async function insertCardRendered(
  pool: Pool,
  params: InsertCardRenderedParams,
): Promise<{ eventId: string; inserted: boolean }> {
  const idempotencyKey = `card.rendered:${params.sessionId}:${params.cardType}:${params.promptVersion}`;
  return insertEventWithId(pool, {
    eventType: 'card.rendered',
    actor: { id: 'aeon-max-bot', role: 'service' },
    subject: { entity: 'session', id: params.sessionId },
    payload: {
      session_id: params.sessionId,
      max_user_id: params.maxUserId,
      card_type: params.cardType,
      card_text: params.cardText,
      prompt_version: params.promptVersion,
      llm_call_id: params.llmCallEventId,
      protocol_version: params.protocolVersion,
      version: params.version,
      matched_types: [...params.matchedTypes],
      model: params.model,
      provider: params.provider,
    },
    idempotencyKey,
    schemaVersion: 1,
    correlationId: params.sessionId,
  });
}
