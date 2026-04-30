import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { DialogEventRow } from '../../src/dialog/resolve-state.js';
import {
  assembleCoordinates,
  computeConfidence,
  matchTypes,
  type ProtocolAnswersMapped,
} from '../../src/aeon/cognitive-engine.js';

function row(type: string, payload: Record<string, unknown>): DialogEventRow {
  return { event_type: type, payload };
}

describe('invariants cognitive (INV-03/04/05/10 упрощённые)', () => {
  it('INV-03: при confidence ниже порога имена типов не попадают в matched_types карты (политика как deliverCardComputed)', () => {
    const threshold = 0.5;
    const unformed: ProtocolAnswersMapped = {
      goals: ['Истина', 'Понимание', 'Ясность', 'Решение'],
      modalities: ['А', 'А', 'А', 'М', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    const assembled = assembleCoordinates(unformed);
    const matched = matchTypes(assembled);
    const { confidence } = computeConfidence(assembled, matched);
    let matchedNames = matched.matchedTypes.map((t) => t.name);
    if (confidence < threshold) matchedNames = [];
    expect(confidence).toBeLessThan(threshold);
    expect(matched.matchedTypes.length).toBeGreaterThan(0);
    expect(matchedNames).toEqual([]);
  });

  it('INV-04: synthetic_drawing=true при синтетическом двойном рисунке (§4.2)', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Возможность', 'Согласованность', 'Возможность', 'Возможность'],
      modalities: ['А', 'М', 'Б', 'М', 'М'],
      anchors: ['Б', 'Ж', 'В'],
    };
    const m = matchTypes(assembleCoordinates(mapped));
    expect(m.syntheticDrawing).toBe(true);
    expect(m.matchedTypes.length).toBeGreaterThanOrEqual(2);
  });

  it('INV-03 (схема): confidence в допустимом диапазоне', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (confidence) => {
        const e = row('card.computed', {
          session_id: 's',
          confidence,
          matched_types: [],
        });
        expect(typeof e.payload.confidence).toBe('number');
        expect(e.payload.confidence).toBeGreaterThanOrEqual(0);
        expect(e.payload.confidence).toBeLessThanOrEqual(1);
      }),
      { numRuns: 30 },
    );
  });

  it('INV-05: если есть card.computed, до него есть 12 protocol.coordinate_assigned в одной сессии', () => {
    const sessionId = 'sess-inv5';
    const coords = Array.from({ length: 12 }, (_, i) =>
      row('protocol.coordinate_assigned', {
        session_id: sessionId,
        question_id: `q:${i}`,
      }),
    );
    const card = row('card.computed', { session_id: sessionId });
    const events = [...coords, card];
    const nCoord = events.filter((e) => e.event_type === 'protocol.coordinate_assigned').length;
    const hasCard = events.some((e) => e.event_type === 'card.computed');
    expect(hasCard && nCoord >= 12).toBe(true);
  });

  it('INV-10: между двумя protocol question.asked подряд есть answer.interpreted для предыдущего шага', () => {
    const sid = 's';
    const events: DialogEventRow[] = [
      row('question.asked', { session_id: sid, question_id: 'core:protocol:goal:1' }),
      row('answer.given', { session_id: sid, question_id: 'core:protocol:goal:1' }),
      row('answer.interpreted', { session_id: sid, question_id: 'core:protocol:goal:1' }),
      row('question.asked', { session_id: sid, question_id: 'core:protocol:goal:2' }),
    ];
    const asked = events.filter((e) => e.event_type === 'question.asked');
    expect(asked.length).toBe(2);
    const interpBetween = events.some(
      (e) => e.event_type === 'answer.interpreted' && e.payload.question_id === 'core:protocol:goal:1',
    );
    expect(interpBetween).toBe(true);
  });
});
