import type { CognitiveTypeRow } from '../protocols/cognitive_v1/types-table.js';
import { COGNITIVE_TYPES } from '../protocols/cognitive_v1/types-table.js';
import type { GoalLabel, ModalityLetter, AnchorLetter } from '../protocols/cognitive_v1/types.js';
import { ANCHOR_LABEL_BY_LETTER } from '../protocols/cognitive_v1/types.js';

/**
 * Граничные типы §4.2 (имена как в каталоге §4.1).
 * Slug-формы (`polymath` …) совпадают с `name.toLowerCase()`.
 */
export const BOUNDARY_TYPE_IDS = ['Polymath', 'Seer', 'Essayist', 'Architect'] as const;
export type BoundaryTypeId = (typeof BOUNDARY_TYPE_IDS)[number];

const BOUNDARY_TYPE_NAMES = new Set<string>(BOUNDARY_TYPE_IDS);

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

/** Плавная «посадка» профиля модальности на тип: 1 − distance/5 (distance ∈ [0..5]). */
export function modalityFit(user: readonly ModalityLetter[], type: CognitiveTypeRow): number {
  if (user.length !== 5 || type.modalityProfile.length !== 5) return 0;
  const d = profileDistance(user, type.modalityProfile);
  return Math.max(0, 1 - d / 5);
}

function anchorMatches(letter: AnchorLetter | null, type: CognitiveTypeRow): boolean {
  if (!letter) return false;
  const name = ANCHOR_LABEL_BY_LETTER[letter].toLowerCase();
  return type.anchorPrimary === name || type.anchorSecondary === name;
}

/** Совпадение доминантного якоря пользователя с первичным/вторичным якорем типа (строки каталога в нижнем регистре). */
export function anchorMatchKind(
  userDominantLetter: AnchorLetter | null,
  type: CognitiveTypeRow,
): 'primary' | 'secondary' | 'none' {
  if (userDominantLetter == null) return 'none';
  const label = ANCHOR_LABEL_BY_LETTER[userDominantLetter].toLowerCase();
  if (type.anchorPrimary === label) return 'primary';
  if (type.anchorSecondary === label) return 'secondary';
  return 'none';
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

/** Формула уверенности: взвешенная сумма осей (цель > модальность > якорь). */
export function confidenceFromAxes(axes: ConfidenceAxes): number {
  return 0.45 * axes.goalAxis + 0.35 * axes.modalityAxis + 0.2 * axes.anchorAxis;
}

function computeGoalAxisForConfidence(coords: AssembledCoordinates, matched: MatchTypesResult): number {
  if (coords.coreFormation === 'single') return 1;
  if (coords.coreFormation === 'unformed') return 0.2;
  if (coords.coreFormation === 'tie') {
    const anyBoundary = matched.matchedTypes.some((t) => BOUNDARY_TYPE_NAMES.has(t.name));
    return anyBoundary ? 1 : 0.6;
  }
  return 0.2;
}

function computeModalityAxisForConfidence(coords: AssembledCoordinates, matched: MatchTypesResult): number {
  if (coords.modalityProfile.length !== 5) return 0;
  if (matched.matchedTypes.length === 0) {
    return coords.primaryGoal == null ? 0.5 : 0;
  }
  const top = matched.matchedTypes[0]!;
  const d = profileDistance(coords.modalityProfile, top.modalityProfile);
  return Math.max(0, 1 - d / 5);
}

function letterMatchesTypeAnchorSecondary(letter: AnchorLetter, type: CognitiveTypeRow): boolean {
  return ANCHOR_LABEL_BY_LETTER[letter].toLowerCase() === type.anchorSecondary;
}

function computeAnchorAxisForConfidence(coords: AssembledCoordinates, matched: MatchTypesResult): number {
  const letters = coords.anchorLetters;
  if (letters.length !== 3) return 0;

  if (letters[0] === letters[1] && letters[1] === letters[2]) {
    return 1;
  }

  const counts = new Map<AnchorLetter, number>();
  for (const L of letters) {
    counts.set(L, (counts.get(L) ?? 0) + 1);
  }
  const maxRep = Math.max(...counts.values(), 0);
  if (maxRep >= 2) {
    return 0.8;
  }

  const top = matched.matchedTypes[0];
  if (top) {
    for (const L of letters) {
      if (letterMatchesTypeAnchorSecondary(L, top)) {
        return 0.5;
      }
    }
  }
  return 0.2;
}

export function computeConfidenceAxes(coords: AssembledCoordinates, matched: MatchTypesResult): ConfidenceAxes {
  return {
    goalAxis: computeGoalAxisForConfidence(coords, matched),
    modalityAxis: computeModalityAxisForConfidence(coords, matched),
    anchorAxis: computeAnchorAxisForConfidence(coords, matched),
  };
}

export type ConfidenceResolution =
  | 'clean_match'
  | 'good_match'
  | 'anchor_secondary'
  | 'boundary'
  | 'multiple'
  | 'weak'
  | 'unformed';

export interface ConfidenceResult {
  confidence: number;
  resolution: ConfidenceResolution;
  message: string;
}

const CONF_MESSAGES: Record<ConfidenceResolution, string> = {
  clean_match: 'Чёткое совпадение по всем трём осям',
  good_match: 'Цель и способ обработки совпадают. Якорь подтверждает',
  anchor_secondary: 'Тип совпал по цели и модальности. Якорь — вторичный для этого типа',
  boundary:
    'Граничный тип. Твой ум работает на стыке двух эпистемических целей — это сильный, не слабый результат',
  multiple: 'Двойной рисунок: тебя точнее описывают два типа сразу',
  unformed: 'Похоже, ты в фазе перехода. Рекомендуем пройти протокол повторно через 6–12 недель',
  weak: 'Результат неоднозначный. Проверь, не было ли спешки в ответах, и попробуй пройти повторно',
};

function isBoundaryType(type: CognitiveTypeRow): boolean {
  return BOUNDARY_TYPE_NAMES.has(type.name);
}

/** §4.2 + UX: при tie два «чистых» типа с близкой модальностью → множественность. */
function hasMultiplePureCloseFit(coords: AssembledCoordinates): boolean {
  if (coords.coreFormation !== 'tie' || coords.primaryGoal == null) return false;
  const userProf = coords.modalityProfile;
  if (userProf.length !== 5) return false;

  const pureCandidates = COGNITIVE_TYPES.filter(
    (t) => t.goals.includes(coords.primaryGoal!) && !isBoundaryType(t),
  );
  if (pureCandidates.length < 2) return false;

  const scored = pureCandidates
    .map((t) => ({ t, d: profileDistance(userProf, t.modalityProfile) }))
    .sort((a, b) => a.d - b.d);
  const fit0 = Math.max(0, 1 - scored[0]!.d / 5);
  const fit1 = Math.max(0, 1 - scored[1]!.d / 5);
  return Math.abs(fit0 - fit1) < 0.15;
}

/**
 * Уверенность по пути алгоритма §4.2 (не среднее осей).
 * Оси в `computeConfidenceAxes` остаются для совместимости / диагностики.
 */
export function computeConfidence(coords: AssembledCoordinates, matched: MatchTypesResult): ConfidenceResult {
  if (coords.coreFormation === 'unformed') {
    return { confidence: 0.3, resolution: 'unformed', message: CONF_MESSAGES.unformed };
  }

  const top = matched.matchedTypes[0];
  if (!top || coords.modalityProfile.length !== 5) {
    return { confidence: 0.4, resolution: 'weak', message: CONF_MESSAGES.weak };
  }

  const fit = modalityFit(coords.modalityProfile, top);
  const anchorKind = anchorMatchKind(coords.dominantAnchorLetter, top);

  if (coords.coreFormation === 'single') {
    if (fit > 0.9 && anchorKind === 'primary') {
      return { confidence: 0.95, resolution: 'clean_match', message: CONF_MESSAGES.clean_match };
    }
    if (fit >= 0.7 && anchorKind === 'primary') {
      return { confidence: 0.85, resolution: 'good_match', message: CONF_MESSAGES.good_match };
    }
    if (fit >= 0.7 && anchorKind === 'secondary') {
      return { confidence: 0.75, resolution: 'anchor_secondary', message: CONF_MESSAGES.anchor_secondary };
    }
    return { confidence: 0.4, resolution: 'weak', message: CONF_MESSAGES.weak };
  }

  // tie: граничный топ-тип
  if (isBoundaryType(top)) {
    const conf = fit >= 0.6 ? 0.8 : 0.6;
    return { confidence: conf, resolution: 'boundary', message: CONF_MESSAGES.boundary };
  }

  if (hasMultiplePureCloseFit(coords)) {
    return { confidence: 0.75, resolution: 'multiple', message: CONF_MESSAGES.multiple };
  }

  return { confidence: 0.4, resolution: 'weak', message: CONF_MESSAGES.weak };
}

