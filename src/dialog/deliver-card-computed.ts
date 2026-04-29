import type { Pool } from 'pg';
import type { Config } from '../config.js';
import {
  assembleCoordinates,
  computeAgreement,
  computeConfidence,
  matchTypes,
  type InterpretedStep,
  type ProtocolAnswersMapped,
} from '../aeon/cognitive-engine.js';
import type { GoalLabel, AnchorLetter } from '../protocols/cognitive_v1/types.js';
import type { ModalityLetter } from '../protocols/cognitive_v1/types.js';
import { PROTOCOL_QUESTION_IDS, protocolQuestionIndex } from '../protocols/cognitive_v1/queue.js';
import { fetchDialogEventsForUser } from '../db/dialog-events.js';
import { insertCardComputed } from '../db/aeon-events.js';
import {
  COGNITIVE_CARD_COMPUTED_VERSION,
  COGNITIVE_CARD_TYPE,
  COGNITIVE_PROTOCOL_VERSION,
} from './protocol-constants.js';
import { sendMaxUserMessage } from '../integrations/max/client.js';

function coordsPayload(coords: ReturnType<typeof assembleCoordinates>): Record<string, unknown> {
  return {
    primary_goal: coords.primaryGoal,
    secondary_goal: coords.secondaryGoal,
    core_formation: coords.coreFormation,
    modality_profile: [...coords.modalityProfile],
    anchor_letters: [...coords.anchorLetters],
    dominant_anchor_letter: coords.dominantAnchorLetter,
  };
}

export async function deliverCardComputed(opts: {
  pool: Pool;
  config: Config;
  maxUserId: number;
  sessionId: string;
  log: { warn: (o: unknown, msg?: string) => void; info: (o: unknown, msg?: string) => void };
}): Promise<void> {
  const { pool, config, maxUserId, sessionId, log } = opts;
  const rows = await fetchDialogEventsForUser(pool, maxUserId);

  const byQuestionCoord = new Map<string, { axis: string; coordinate: string }>();
  const mapperSteps: InterpretedStep[] = [];
  for (const e of rows) {
    if (e.event_type !== 'protocol.coordinate_assigned') continue;
    if (String(e.payload.session_id) !== sessionId) continue;
    const qid = String(e.payload.question_id ?? e.payload.source_question_id ?? '');
    const axis = String(e.payload.axis ?? '');
    const coordinate = String(e.payload.coordinate ?? '');
    if (!qid || !axis) continue;
    byQuestionCoord.set(qid, { axis, coordinate });
    mapperSteps.push({ questionId: qid, axis, coordinate });
  }

  const interpretedSteps: InterpretedStep[] = [];
  for (const e of rows) {
    if (e.event_type !== 'answer.interpreted') continue;
    if (String(e.payload.session_id) !== sessionId) continue;
    interpretedSteps.push({
      questionId: String(e.payload.question_id ?? ''),
      axis: String(e.payload.axis ?? ''),
      coordinate: String(e.payload.coordinate ?? ''),
    });
  }

  const goals: GoalLabel[] = [];
  const modalities: ModalityLetter[] = [];
  const anchors: AnchorLetter[] = [];

  for (const qid of PROTOCOL_QUESTION_IDS) {
    const c = byQuestionCoord.get(qid);
    if (!c) {
      log.warn({ sessionId, qid }, 'deliverCardComputed: missing coordinate');
      return;
    }
    const axis = c.axis;
    const coord = c.coordinate;
    if (axis === 'goal') {
      goals.push(coord as GoalLabel);
    } else if (axis === 'modality') {
      modalities.push(coord as ModalityLetter);
    } else if (axis === 'anchor') {
      anchors.push(coord as AnchorLetter);
    }
  }

  const mapped: ProtocolAnswersMapped = { goals, modalities, anchors };
  const assembled = assembleCoordinates(mapped);
  const matched = matchTypes(assembled);
  const confidence = computeConfidence(assembled, matched);
  const agreement = computeAgreement(mapperSteps, interpretedSteps);

  const coordsRecord = coordsPayload(assembled);

  const answerIds: string[] = [];
  for (const e of rows) {
    if (e.event_type !== 'answer.given') continue;
    if (String(e.payload.session_id) !== sessionId) continue;
    const qid = String(e.payload.question_id ?? '');
    if (protocolQuestionIndex(qid) >= 0 && e.event_id) {
      answerIds.push(e.event_id);
    }
  }

  const disagreementWithLlm = agreement < config.llmRuleAgreementThreshold;

  let matchedNames = matched.matchedTypes.map((t) => t.name);
  let coreUnformed = assembled.coreFormation === 'unformed' || assembled.primaryGoal == null;

  if (confidence < config.cardConfidenceThreshold || coreUnformed) {
    matchedNames = [];
    coreUnformed = true;
  }

  const cardIns = await insertCardComputed(pool, {
    sessionId,
    maxUserId,
    cardType: COGNITIVE_CARD_TYPE,
    confidence,
    inputAnswerIds: answerIds,
    version: COGNITIVE_CARD_COMPUTED_VERSION,
    protocolVersion: COGNITIVE_PROTOCOL_VERSION,
    coordinates: coordsRecord,
    matchedTypes: matchedNames,
    disagreementWithLlm,
    syntheticDrawing: matched.syntheticDrawing,
    coreUnformed,
  });

  if (cardIns.inserted && config.maxBotToken) {
    const line =
      matchedNames.length > 0 && matchedNames[0]
        ? `Твой тип по карте: ${matchedNames[0]}.`
        : 'Ядро профиля пока не сформировано однозначно — это тоже полезный результат.';
    await sendMaxUserMessage({
      baseUrl: config.maxApiBaseUrl,
      token: config.maxBotToken,
      userId: maxUserId,
      text: line,
    });
  } else if (cardIns.inserted && !config.maxBotToken) {
    log.warn('MAX_BOT_TOKEN empty: skip card computed message');
  }
}
