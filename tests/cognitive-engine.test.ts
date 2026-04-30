import { describe, expect, it } from 'vitest';
import {
  assembleCoordinates,
  computeConfidence,
  computeConfidenceAxes,
  matchTypes,
  type ProtocolAnswersMapped,
} from '../src/aeon/cognitive-engine.js';
import { COGNITIVE_TYPES } from '../src/protocols/cognitive_v1/types-table.js';

describe('cognitive-engine', () => {
  it('assembleCoordinates: однозначное ядро при 3 голосах за одну цель', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Истина', 'Истина', 'Истина', 'Понимание'],
      modalities: ['А', 'А', 'А', 'М', 'А'],
      anchors: ['А', 'А', 'А'],
    };
    const c = assembleCoordinates(mapped);
    expect(c.primaryGoal).toBe('Истина');
    expect(c.coreFormation).toBe('single');
  });

  it('assembleCoordinates: 2:2 → первичная цель из Ц2', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Истина', 'Понимание', 'Истина', 'Понимание'],
      modalities: ['А', 'А', 'А', 'М', 'А'],
      anchors: ['Б', 'Б', 'Ж'],
    };
    const c = assembleCoordinates(mapped);
    expect(c.coreFormation).toBe('tie');
    expect(c.primaryGoal).toBe('Понимание');
  });

  it('computeConfidenceAxes: tie + граничный тип (Architect) → goalAxis = 1', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Возможность', 'Точность', 'Возможность', 'Точность'],
      modalities: ['А', 'А', 'Б', 'Б', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    const coords = assembleCoordinates(mapped);
    expect(coords.coreFormation).toBe('tie');
    const m = matchTypes(coords);
    expect(m.matchedTypes[0]?.name).toBe('Architect');
    const axes = computeConfidenceAxes(coords, m);
    expect(axes.goalAxis).toBe(1);
  });

  it('computeConfidenceAxes: tie + «чистый» тип без граничных в топе → goalAxis = 0.6', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Истина', 'Понимание', 'Истина', 'Понимание'],
      modalities: ['А', 'А', 'А', 'М', 'А'],
      anchors: ['А', 'А', 'А'],
    };
    const coords = assembleCoordinates(mapped);
    const empiricist = COGNITIVE_TYPES.find((t) => t.name === 'Empiricist')!;
    const axes = computeConfidenceAxes(coords, {
      matchedTypes: [empiricist],
      syntheticDrawing: false,
    });
    expect(axes.goalAxis).toBe(0.6);
  });

  it('computeConfidenceAxes: modalityAxis = max(0, 1 - d/5)', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Возможность', 'Точность', 'Возможность', 'Точность'],
      modalities: ['М', 'А', 'Б', 'Б', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    const coords = assembleCoordinates(mapped);
    const m = matchTypes(coords);
    const axes = computeConfidenceAxes(coords, m);
    expect(axes.modalityAxis).toBeCloseTo(0.9, 5);
  });

  it('computeConfidenceAxes: якорь 2 из 3, доминанта = primary топ-типа → §4.6 anchorAxis = 0.85', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Истина', 'Истина', 'Истина', 'Истина'],
      modalities: ['А', 'А', 'А', 'М', 'А'],
      anchors: ['А', 'А', 'Б'],
    };
    const coords = assembleCoordinates(mapped);
    const m = matchTypes(coords);
    const axes = computeConfidenceAxes(coords, m);
    expect(axes.anchorAxis).toBe(0.85);
  });

  it('computeConfidenceAxes: три разные буквы, одна = якорь топ-типа → §4.6 anchorAxis = 0.4', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Истина', 'Истина', 'Истина', 'Истина'],
      modalities: ['А', 'А', 'А', 'М', 'А'],
      anchors: ['Б', 'В', 'Г'],
    };
    const coords = assembleCoordinates(mapped);
    const m = matchTypes(coords);
    expect(m.matchedTypes[0]?.name).toBe('Empiricist');
    const axes = computeConfidenceAxes(coords, m);
    expect(axes.anchorAxis).toBe(0.4);
  });

  it('computeConfidence: идеальный Architect (tie + профиль типа + логический якорь)', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Возможность', 'Точность', 'Возможность', 'Точность'],
      modalities: ['А', 'А', 'Б', 'Б', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    const coords = assembleCoordinates(mapped);
    const m = matchTypes(coords);
    const r = computeConfidence(coords, m);
    expect(r.resolution).toBe('boundary');
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('computeConfidence: чистый Theorist — clean_match', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Понимание', 'Понимание', 'Понимание', 'Понимание'],
      modalities: ['А', 'А', 'Б', 'Б', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    const coords = assembleCoordinates(mapped);
    const m = matchTypes(coords);
    expect(m.matchedTypes[0]?.name).toBe('Theorist');
    const r = computeConfidence(coords, m);
    expect(r.resolution).toBe('clean_match');
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('computeConfidence: Theorist с одним «М» в модальности — good_match (§4.6 формула)', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Понимание', 'Понимание', 'Понимание', 'Понимание'],
      modalities: ['А', 'А', 'Б', 'М', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    const coords = assembleCoordinates(mapped);
    const m = matchTypes(coords);
    const r = computeConfidence(coords, m);
    expect(r.resolution).toBe('good_match');
    expect(r.confidence).toBeCloseTo(0.965, 5);
  });

  it('computeConfidence: несформированное ядро — unformed, 0.3', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Истина', 'Понимание', 'Ясность', 'Решение'],
      modalities: ['А', 'А', 'А', 'М', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    const coords = assembleCoordinates(mapped);
    expect(coords.coreFormation).toBe('unformed');
    const m = matchTypes(coords);
    const r = computeConfidence(coords, m);
    expect(r.resolution).toBe('unformed');
    expect(r.confidence).toBe(0.3);
  });

  it('computeConfidence: tie Истина/Понимание + близкие чистые типы — multiple', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Истина', 'Истина', 'Понимание', 'Понимание'],
      modalities: ['А', 'А', 'М', 'М', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    const coords = assembleCoordinates(mapped);
    expect(coords.coreFormation).toBe('tie');
    expect(coords.primaryGoal).toBe('Истина');
    const m = matchTypes(coords);
    const r = computeConfidence(coords, m);
    expect(r.resolution).toBe('multiple');
    expect(r.confidence).toBeCloseTo(0.735, 3);
    expect(m.matchedTypes.length).toBeGreaterThanOrEqual(2);
  });

  it('computeConfidence: §4.6 Architect single + идеальный профиль + три разных якоря → boundary, C≈0.89', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Возможность', 'Возможность', 'Возможность', 'Возможность'],
      modalities: ['А', 'А', 'Б', 'Б', 'А'],
      anchors: ['Ж', 'Г', 'З'],
    };
    const coords = assembleCoordinates(mapped);
    const m = matchTypes(coords);
    expect(m.matchedTypes[0]?.name).toBe('Architect');
    const r = computeConfidence(coords, m);
    expect(r.resolution).toBe('boundary');
    expect(r.confidence).toBeCloseTo(0.89, 5);
  });

  it('computeConfidence: инвариант §4.6 — weak даёт C < 0.7', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Понимание', 'Понимание', 'Понимание', 'Понимание'],
      modalities: ['А', 'А', 'Б', 'Б', 'А'],
      anchors: ['А', 'А', 'А'],
    };
    const coords = assembleCoordinates(mapped);
    const m = matchTypes(coords);
    expect(m.matchedTypes[0]?.name).toBe('Theorist');
    const r = computeConfidence(coords, m);
    expect(r.resolution).toBe('weak');
    expect(r.confidence).toBeLessThan(0.7);
  });

  it('matchTypes + computeConfidence на синтетическом Empiricist-профиле', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Истина', 'Истина', 'Истина', 'Истина'],
      modalities: ['А', 'А', 'А', 'М', 'А'],
      anchors: ['А', 'Б', 'А'],
    };
    const coords = assembleCoordinates(mapped);
    const m = matchTypes(coords);
    expect(m.matchedTypes.length).toBeGreaterThanOrEqual(1);
    const r = computeConfidence(coords, m);
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.message.length).toBeGreaterThan(10);
  });
});
