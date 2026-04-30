import { describe, expect, it } from 'vitest';
import {
  assembleCoordinates,
  computeConfidence,
  matchTypes,
  type ProtocolAnswersMapped,
} from '../src/aeon/cognitive-engine.js';
import { loadCognitiveCardRenderPrompt, type CognitiveCardRenderPromptArgs } from '../src/llm/load-prompt.js';

function cardRenderArgsFromMapped(sessionId: string, mapped: ProtocolAnswersMapped): CognitiveCardRenderPromptArgs {
  const assembled = assembleCoordinates(mapped);
  const matched = matchTypes(assembled);
  const conf = computeConfidence(assembled, matched);
  return {
    sessionId,
    coordinates: {
      primary_goal: assembled.primaryGoal,
      secondary_goal: assembled.secondaryGoal,
      core_formation: assembled.coreFormation,
      goal_votes: [...assembled.goalVotes],
      modality_profile: [...assembled.modalityProfile],
      anchor_letters: [...assembled.anchorLetters],
      dominant_anchor_letter: assembled.dominantAnchorLetter,
    },
    matchedTypeNames: matched.matchedTypes.map((t) => t.name),
    syntheticDrawing: matched.syntheticDrawing,
    coreUnformed: assembled.coreFormation === 'unformed',
    confidenceResolution: conf.resolution,
    confidenceMessage: conf.message,
  };
}

describe('loadCognitiveCardRenderPrompt', () => {
  it('snapshot: clean Theorist', async () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Понимание', 'Понимание', 'Понимание', 'Понимание'],
      modalities: ['А', 'А', 'Б', 'Б', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    const { body, promptVersion } = await loadCognitiveCardRenderPrompt(cardRenderArgsFromMapped('snap-theorist', mapped));
    expect(promptVersion).toBe('cognitive-card-render@v1');
    expect(body).toMatchSnapshot();
  });

  it('snapshot: boundary Architect', async () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Возможность', 'Точность', 'Возможность', 'Точность'],
      modalities: ['А', 'А', 'Б', 'Б', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    const { body } = await loadCognitiveCardRenderPrompt(cardRenderArgsFromMapped('snap-architect', mapped));
    expect(body).toMatchSnapshot();
  });

  it('snapshot: synthetic drawing (multiple)', async () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Истина', 'Истина', 'Понимание', 'Понимание'],
      modalities: ['А', 'А', 'М', 'М', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    const { body } = await loadCognitiveCardRenderPrompt(cardRenderArgsFromMapped('snap-multiple', mapped));
    expect(body).toMatchSnapshot();
  });

  it('snapshot: unformed core', async () => {
    const mapped: ProtocolAnswersMapped = {
      goals: ['Истина', 'Понимание', 'Ясность', 'Решение'],
      modalities: ['А', 'А', 'А', 'М', 'А'],
      anchors: ['Б', 'Б', 'Б'],
    };
    const { body } = await loadCognitiveCardRenderPrompt(cardRenderArgsFromMapped('snap-unformed', mapped));
    expect(body).toMatchSnapshot();
  });
});
