import type { CognitiveTypeRow } from '../protocols/cognitive_v1/types-table.js';
import { COGNITIVE_TYPES } from '../protocols/cognitive_v1/types-table.js';
import type { GoalLabel, ModalityLetter, AnchorLetter } from '../protocols/cognitive_v1/types.js';
import { ANCHOR_LABEL_BY_LETTER } from '../protocols/cognitive_v1/types.js';

/** Ответы пользователя после mapper (по порядку блоков Ц4 + М5 + Я3). */
export type ProtocolAnswersMapped = {
  goals: readonly GoalLabel[];
  modalities: readonly ModalityLetter[];
  anchors: readonly AnchorLetter[];
};

export type CoreFormation = 'single' | 'tie' | 'unformed';

export type AssembledCoordinates = {
  goalVotes: readonly GoalLabel[];
  primaryGoal: GoalLabel | null;
  secondaryGoal: GoalLabel | null;
  coreFormation: CoreFormation;
  modalityProfile: readonly ModalityLetter[];
  anchorLetters: readonly AnchorLetter[];
  dominantAnchorLetter: AnchorLetter | null;
};

function countGoals(goals: readonly GoalLabel[]): Map<GoalLabel, number> {
  const m = new Map<GoalLabel, number>();
  for (const g of goals) {
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/**
 * Сборка блоков Ц/М/Я по §3.2–3.4.
 * При 2:2 первичная цель — та, что проявилась в Ц2 (второй ответ).
 */
export function assembleCoordinates(mapped: ProtocolAnswersMapped): AssembledCoordinates {
  const { goals, modalities, anchors } = mapped;
  const votes = countGoals(goals);
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);

  let primaryGoal: GoalLabel | null = null;
  let secondaryGoal: GoalLabel | null = null;
  let coreFormation: CoreFormation = 'unformed';

  if (goals.length >= 4) {
    const top = ranked[0];
    const second = ranked[1];
    if (top && top[1] >= 3) {
      primaryGoal = top[0];
      coreFormation = 'single';
    } else if (top && second && top[1] === 2 && second[1] === 2) {
      coreFormation = 'tie';
      const g2 = goals[1];
      primaryGoal = g2;
      secondaryGoal = ranked.find(([g]) => g !== g2)?.[0] ?? null;
    } else if (ranked.length >= 4 && ranked.every(([, c]) => c === 1)) {
      coreFormation = 'unformed';
      primaryGoal = null;
    }
  }

  const letterCounts = new Map<AnchorLetter, number>();
  for (const L of anchors) {
    letterCounts.set(L, (letterCounts.get(L) ?? 0) + 1);
  }
  const anchorSorted = [...letterCounts.entries()].sort((a, b) => b[1] - a[1]);
  const dominantAnchorLetter =
    anchorSorted.length === 0
      ? null
      : anchorSorted[0][1] >= 2
        ? anchorSorted[0][0]
        : anchorSorted.length === 3 && anchorSorted.every(([, c]) => c === 1)
          ? null
          : anchorSorted[0][0];

  return {
    goalVotes: [...goals],
    primaryGoal,
    secondaryGoal,
    coreFormation,
    modalityProfile: modalities,
    anchorLetters: anchors,
    dominantAnchorLetter,
  };
}

function modalityDistance(a: ModalityLetter, b: ModalityLetter): number {
  if (a === b) return 0;
  if (a === 'М' || b === 'М') return 0.5;
  return 1;
}

function profileDistance(user: readonly ModalityLetter[], row: readonly ModalityLetter[]): number {
  let s = 0;
  for (let i = 0; i < 5; i++) {
    s += modalityDistance(user[i]!, row[i]!);
  }
  return s;
}

function anchorMatches(letter: AnchorLetter | null, type: CognitiveTypeRow): boolean {
  if (!letter) return false;
  const name = ANCHOR_LABEL_BY_LETTER[letter].toLowerCase();
  return type.anchorPrimary === name || type.anchorSecondary === name;
}

export type MatchTypesResult = {
  matchedTypes: readonly CognitiveTypeRow[];
  /** Два и более типа с одинаковым минимальным расстоянием по модальности — «рисунок». */
  syntheticDrawing: boolean;
};

/**
 * §4.2: фильтр по ядерной цели → ближайший по модальности → подтверждение якорем (мягкое).
 */
export function matchTypes(coords: AssembledCoordinates): MatchTypesResult {
  const userProf = coords.modalityProfile;
  if (userProf.length !== 5) {
    return { matchedTypes: [], syntheticDrawing: false };
  }

  let candidates: CognitiveTypeRow[];
  if (coords.primaryGoal == null) {
    candidates = [...COGNITIVE_TYPES];
  } else {
    candidates = COGNITIVE_TYPES.filter((t) => t.goals.includes(coords.primaryGoal!));
  }

  if (candidates.length === 0) {
    candidates = [...COGNITIVE_TYPES];
  }

  let best = Infinity;
  const scored = candidates.map((t) => ({
    t,
    d: profileDistance(userProf, t.modalityProfile),
  }));
  for (const x of scored) {
    if (x.d < best) best = x.d;
  }
  const tied = scored.filter((x) => Math.abs(x.d - best) < 1e-9);
  let picks = tied.map((x) => x.t);

  const dom = coords.dominantAnchorLetter;
  if (dom != null && picks.length > 1) {
    const anchorPreferred = picks.filter((t) => anchorMatches(dom, t));
    if (anchorPreferred.length > 0) {
      picks = anchorPreferred;
    }
  }

  const syntheticDrawing = picks.length >= 2;

  return {
    matchedTypes: picks.slice(0, 3),
    syntheticDrawing,
  };
}

export type ConfidenceAxes = {
  goalAxis: number;
  modalityAxis: number;
  anchorAxis: number;
};

/** Формула из iter-4 plan / constants: три оси → среднее. */
export function computeConfidenceAxes(coords: AssembledCoordinates, matched: MatchTypesResult): ConfidenceAxes {
  let goalAxis = 0;
  if (coords.coreFormation === 'single') {
    goalAxis = 1;
  } else if (coords.coreFormation === 'tie') {
    goalAxis = 0.5;
  } else {
    goalAxis = 0;
  }

  let modalityAxis = 0;
  if (coords.primaryGoal != null && matched.matchedTypes.length > 0) {
    const top = matched.matchedTypes[0]!;
    const d = profileDistance(coords.modalityProfile, top.modalityProfile);
    modalityAxis = d < 1e-9 ? 1 : d <= 2 ? 0.5 : 0;
  } else if (coords.primaryGoal == null) {
    modalityAxis = 0.5;
  }

  let anchorAxis = 0;
  const letters = coords.anchorLetters;
  if (letters.length === 3 && letters[0] === letters[1] && letters[1] === letters[2]) {
    anchorAxis = 1;
  } else if (coords.dominantAnchorLetter != null) {
    anchorAxis = 0.5;
  }

  return { goalAxis, modalityAxis, anchorAxis };
}

export function confidenceFromAxes(axes: ConfidenceAxes): number {
  return (axes.goalAxis + axes.modalityAxis + axes.anchorAxis) / 3;
}

export function computeConfidence(coords: AssembledCoordinates, matched: MatchTypesResult): number {
  return confidenceFromAxes(computeConfidenceAxes(coords, matched));
}

export type InterpretedStep = {
  questionId: string;
  axis: string;
  coordinate: string;
};

/** Доля шагов, где интерпретация LLM совпала с координатой mapper (по строке coordinate). */
export function computeAgreement(
  mapper: readonly InterpretedStep[],
  interpreted: readonly InterpretedStep[],
): number {
  const byQ = new Map(mapper.map((m) => [m.questionId, m]));
  let ok = 0;
  let total = 0;
  for (const i of interpreted) {
    const m = byQ.get(i.questionId);
    if (!m) continue;
    total++;
    if (m.coordinate === i.coordinate && m.axis === i.axis) {
      ok++;
    }
  }
  return total === 0 ? 1 : ok / total;
}
