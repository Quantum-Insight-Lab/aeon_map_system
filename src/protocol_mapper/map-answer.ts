import { COGNITIVE_PROTOCOL_QUESTIONS } from '../protocols/cognitive_v1/questions.js';
import type { CognitiveAxis } from '../protocols/cognitive_v1/types.js';
import {
  GOAL_LABELS,
  type GoalLabel,
  type ModalityLetter,
  type AnchorLetter,
} from '../protocols/cognitive_v1/types.js';
import { isProtocolQuestionId } from '../protocols/cognitive_v1/queue.js';

export type MappedCoordinate = {
  axis: CognitiveAxis;
  /** Для anchor — буква А–З (координата совпадает с ключом варианта в протоколе). */
  coordinate: string;
};

export type MapAnswerInvalid = { ok: false; reason: string };
export type MapAnswerOk = { ok: true } & MappedCoordinate;
export type MapAnswerResult = MapAnswerOk | MapAnswerInvalid;

function normalizeWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/** Латиница → кириллица для модальности и якоря */
function latinToCyrillicModality(ch: string): string | null {
  const u = ch.toUpperCase();
  if (u === 'A') return 'А';
  if (u === 'B') return 'Б';
  if (u === 'M') return 'М';
  return null;
}

function latinToCyrillicAnchor(ch: string): string | null {
  const u = ch.toUpperCase();
  const map: Record<string, string> = {
    A: 'А',
    B: 'Б',
    V: 'В',
    G: 'Г',
    D: 'Д',
    E: 'Е',
    ZH: 'Ж',
    Z: 'З',
  };
  if (map[u]) return map[u];
  if (u.length === 1 && 'АБВГДЕЖЗ'.includes(ch)) return ch;
  return null;
}

/** Цифра 1–8 → русское название цели из методики. */
function parseGoalDigit(raw: string): GoalLabel | null {
  const t = normalizeWhitespace(raw);
  const digitMatch = t.match(/[1-8]/);
  if (!digitMatch) {
    return null;
  }
  const n = Number(digitMatch[0]);
  return GOAL_LABELS[n - 1];
}

function parseModality(raw: string): ModalityLetter | null {
  let t = normalizeWhitespace(raw).toUpperCase();
  if (t.length === 0) return null;
  const first = t[0];
  if ('АБМ'.includes(first)) return first as ModalityLetter;
  const lat = latinToCyrillicModality(first);
  if (lat === 'А' || lat === 'Б' || lat === 'М') return lat;
  return null;
}

function parseAnchorLetter(raw: string): AnchorLetter | null {
  let t = normalizeWhitespace(raw);
  if (t.length === 0) return null;
  let first = t[0];
  if (!'АБВГДЕЖЗабвгдежз'.includes(first)) {
    const conv = latinToCyrillicAnchor(first);
    if (conv) first = conv;
  }
  first = first.toUpperCase();
  const map: Record<string, AnchorLetter> = {
    А: 'А',
    Б: 'Б',
    В: 'В',
    Г: 'Г',
    Д: 'Д',
    Е: 'Е',
    Ж: 'Ж',
    З: 'З',
  };
  return map[first] ?? null;
}

export function mapAnswerToCoordinate(questionId: string, raw: string): MapAnswerResult {
  if (!isProtocolQuestionId(questionId)) {
    return { ok: false, reason: 'unknown_question' };
  }
  const qMeta = COGNITIVE_PROTOCOL_QUESTIONS.find((q) => q.id === questionId);
  if (!qMeta) {
    return { ok: false, reason: 'unknown_question' };
  }

  switch (qMeta.axis) {
    case 'goal': {
      const g = parseGoalDigit(raw);
      if (!g) {
        return { ok: false, reason: 'invalid_goal_answer' };
      }
      return { ok: true, axis: 'goal', coordinate: g };
    }
    case 'modality': {
      const m = parseModality(raw);
      if (!m) {
        return { ok: false, reason: 'invalid_modality_answer' };
      }
      return { ok: true, axis: 'modality', coordinate: m };
    }
    case 'anchor': {
      const a = parseAnchorLetter(raw);
      if (!a) {
        return { ok: false, reason: 'invalid_anchor_answer' };
      }
      return { ok: true, axis: 'anchor', coordinate: a };
    }
    default:
      return { ok: false, reason: 'unknown_axis' };
  }
}
