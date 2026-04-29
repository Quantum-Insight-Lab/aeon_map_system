import { describe, expect, it } from 'vitest';
import {
  assembleCoordinates,
  computeConfidence,
  matchTypes,
  type ProtocolAnswersMapped,
} from '../src/aeon/cognitive-engine.js';

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

  it('matchTypes + computeConfidence на синтетическом Empiricist-профиле', () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Истина', 'Истина', 'Истина', 'Истина'],
      modalities: ['А', 'А', 'А', 'М', 'А'],
      anchors: ['А', 'Б', 'А'],
    };
    const coords = assembleCoordinates(mapped);
    const m = matchTypes(coords);
    expect(m.matchedTypes.length).toBeGreaterThanOrEqual(1);
    const conf = computeConfidence(coords, m);
    expect(conf).toBeGreaterThan(0);
  });
});
