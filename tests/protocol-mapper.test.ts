import { describe, expect, it } from 'vitest';
import { mapAnswerToCoordinate } from '../src/protocol_mapper/map-answer.js';
import { PROTOCOL_QUESTION_IDS } from '../src/protocols/cognitive_v1/queue.js';

describe('mapAnswerToCoordinate', () => {
  it('goal axis 1..8 из кириллицы и латиницы', () => {
    expect(mapAnswerToCoordinate('core:protocol:goal:1', '8')).toMatchObject({
      ok: true,
      axis: 'goal',
      coordinate: 'Точность',
    });
    expect(mapAnswerToCoordinate('core:protocol:goal:4', 'пункт 3')).toMatchObject({
      ok: true,
      coordinate: 'Ясность',
    });
  });

  it('modality А Б М', () => {
    expect(mapAnswerToCoordinate('core:protocol:modality:2', 'a')).toMatchObject({
      ok: true,
      axis: 'modality',
      coordinate: 'А',
    });
    expect(mapAnswerToCoordinate('core:protocol:modality:3', 'm')).toMatchObject({
      ok: true,
      coordinate: 'М',
    });
  });

  it('anchor одна буква А–З', () => {
    expect(mapAnswerToCoordinate('core:protocol:anchor:2', 'в')).toMatchObject({
      ok: true,
      axis: 'anchor',
      coordinate: 'В',
    });
  });

  it('invalid без подходящей цифры/буквы', () => {
    expect(mapAnswerToCoordinate('core:protocol:goal:1', '99')).toMatchObject({ ok: false });
    expect(mapAnswerToCoordinate('core:protocol:modality:1', 'Г')).toMatchObject({ ok: false });
    expect(mapAnswerToCoordinate('unknown:id', '1')).toMatchObject({ ok: false });
  });

  it('покрытие всех 12 question ids — валидный ответ на каждый id', () => {
    const checks = [
      ['core:protocol:goal:1', '1'],
      ['core:protocol:goal:2', '2'],
      ['core:protocol:goal:3', '3'],
      ['core:protocol:goal:4', '4'],
      ['core:protocol:modality:1', 'Б'],
      ['core:protocol:modality:2', 'М'],
      ['core:protocol:modality:3', 'А'],
      ['core:protocol:modality:4', 'Б'],
      ['core:protocol:modality:5', 'М'],
      ['core:protocol:anchor:1', 'А'],
      ['core:protocol:anchor:2', 'Ж'],
      ['core:protocol:anchor:3', 'З'],
    ] as const;
    for (const [qid, raw] of checks) {
      expect(mapAnswerToCoordinate(qid, raw).ok).toBe(true);
    }
    expect(PROTOCOL_QUESTION_IDS.length).toBe(12);
  });
});
