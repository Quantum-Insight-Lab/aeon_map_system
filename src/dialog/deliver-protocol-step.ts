import type { Pool } from 'pg';
import type { Config } from '../config.js';
import { mapAnswerToCoordinate } from '../protocol_mapper/map-answer.js';
import { insertAnswerInterpreted, insertProtocolCoordinateAssigned } from '../db/protocol-events.js';
import { insertLlmCalledAnswerInterpretation } from '../db/llm-events.js';
import { insertQuestionAskedProtocol } from '../db/session-events.js';
import { interpretProtocolAnswer } from '../llm/interpret-answer.js';
import { formatProtocolQuestionMessage, getProtocolQuestion } from '../protocols/cognitive_v1/questions.js';
import { nextQuestionAfter } from '../protocols/cognitive_v1/queue.js';
import { COGNITIVE_CARD_TYPE } from './protocol-constants.js';
import { sendMaxUserMessage } from '../integrations/max/client.js';
import { deliverCardComputed } from './deliver-card-computed.js';

function stripTrailingJsonLine(text: string): string {
  const lines = text.trim().split(/\r?\n/);
  while (lines.length > 0) {
    const last = lines[lines.length - 1]?.trim() ?? '';
    if (last.startsWith('{') && last.includes('"coordinate"')) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join('\n').trim();
}

export async function deliverProtocolStep(opts: {
  pool: Pool;
  config: Config;
  maxUserId: number;
  sessionId: string;
  questionId: string;
  answerText: string;
  answerEventId: string;
  log: { warn: (o: unknown, msg?: string) => void; info: (o: unknown, msg?: string) => void };
}): Promise<void> {
  const { pool, config, maxUserId, sessionId, questionId, answerText, answerEventId, log } = opts;

  const mapped = mapAnswerToCoordinate(questionId, answerText);
  if (!mapped.ok) {
    if (config.maxBotToken) {
      await sendMaxUserMessage({
        baseUrl: config.maxApiBaseUrl,
        token: config.maxBotToken,
        userId: maxUserId,
        text:
          'Не распознал ответ. Для блока целей напиши число от 1 до 8; для модальности — А, Б или М (можно латиницей A/B/M); для якоря — одну букву А–З.',
      });
    } else {
      log.warn('mapper invalid / MAX_BOT_TOKEN empty');
    }
    return;
  }

  await insertProtocolCoordinateAssigned(pool, {
    sessionId,
    maxUserId,
    questionId,
    answerEventId,
    cardType: COGNITIVE_CARD_TYPE,
    axis: mapped.axis,
    coordinate: mapped.coordinate,
    sourceQuestionId: questionId,
  });

  let interp;
  try {
    interp = await interpretProtocolAnswer({
      config,
      sessionId,
      questionId,
      answerText,
      mappedAxis: mapped.axis,
      mappedCoordinate: mapped.coordinate,
      log,
    });
  } catch (e) {
    log.warn({ err: e }, 'deliverProtocolStep: interpret failed');
    return;
  }

  const summaryLine = stripTrailingJsonLine(interp.interpretationText).slice(0, 240);
  const llmRow = await insertLlmCalledAnswerInterpretation(pool, {
    maxUserId,
    sessionId,
    questionId,
    model: interp.model,
    provider: interp.provider,
    promptVersion: interp.promptVersion,
    inputHash: interp.inputHash,
    latencyMs: interp.latencyMs,
    summaryText: summaryLine || '(interpretation)',
  });

  await insertAnswerInterpreted(pool, {
    sessionId,
    maxUserId,
    questionId,
    axis: mapped.axis,
    coordinate: mapped.coordinate,
    llmCallId: llmRow.eventId,
    interpretationText: interp.interpretationText,
  });

  const next = nextQuestionAfter(questionId);
  if (next == null) {
    await deliverCardComputed({ pool, config, maxUserId, sessionId, log });
    return;
  }

  const nextDef = getProtocolQuestion(next);
  if (!nextDef) {
    log.warn({ next }, 'deliverProtocolStep: next question def missing');
    return;
  }

  const nextBody = formatProtocolQuestionMessage(nextDef);
  const qIns = await insertQuestionAskedProtocol(pool, {
    maxUserId,
    sessionId,
    questionId: next,
    questionText: nextBody,
    cognitiveProtocolVersion: config.cognitiveProtocolVersion,
  });

  if (qIns === 'inserted' && config.maxBotToken) {
    const interpHuman = stripTrailingJsonLine(interp.interpretationText);
    const textOut = `${interpHuman}\n\n${nextBody}`;
    await sendMaxUserMessage({
      baseUrl: config.maxApiBaseUrl,
      token: config.maxBotToken,
      userId: maxUserId,
      text: textOut,
    });
  } else if (qIns === 'inserted' && !config.maxBotToken) {
    log.warn('MAX_BOT_TOKEN empty: skip protocol step outbound');
  }
}
