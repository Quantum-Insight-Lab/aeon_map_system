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

/** Cognitive Identity Map §4.6 — веса формулы C = w_g·gC + w_m·mF + w_a·aS_eff */
export const CONF_WEIGHT_GOAL = 0.45;
export const CONF_WEIGHT_MODALITY = 0.35;
export const CONF_WEIGHT_ANCHOR = 0.2;

/** Поправка якоря для граничных типов (§4.6): aS_eff = min(1, aS_raw + BONUS). */
export const CONF_BOUNDARY_ANCHOR_BONUS = 0.25;

/** Инвариант §4.6: weak не допускает C ≥ 0.7; после округления держим запас. */
const CONF_INVARIANT_WEAK_MAX = 0.699;

/** Инвариант §4.6: clean_match не ниже 0.85. */
const CONF_INVARIANT_CLEAN_MIN = 0.85;

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
 * Ядро цели: ≥3 голосов за одну цель → single; ровно 2:2 → tie (первичная цель — Ц2);
 * 2:1:1 → single (первичная — цель с двумя голосами); 1+1+1+1 → unformed.
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
    } else if (top && second && ranked.length === 2 && top[1] === 2 && second[1] === 2) {
      coreFormation = 'tie';
      const g2 = goals[1];
      primaryGoal = g2;
      secondaryGoal = ranked.find(([g]) => g !== g2)?.[0] ?? null;
    } else if (
      top &&
      ranked.length === 3 &&
      top[1] === 2 &&
      ranked[1]?.[1] === 1 &&
      ranked[2]?.[1] === 1
    ) {
      coreFormation = 'single';
      primaryGoal = top[0];
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

/** Совпадение буквы якоря с доминантным или вторичным якорём строки типа (§4.6 таблица aS). */
export function anchorLetterKind(L: AnchorLetter, type: CognitiveTypeRow): 'primary' | 'secondary' | 'none' {
  const label = ANCHOR_LABEL_BY_LETTER[L].toLowerCase();
  if (type.anchorPrimary === label) return 'primary';
  if (type.anchorSecondary === label) return 'secondary';
  return 'none';
}

/** Базовая ось якоря §4.6 до поправки на граничный тип (aS_raw ∈ [0..1]). */
export function anchorScoreRaw46(letters: readonly AnchorLetter[], type: CognitiveTypeRow): number {
  if (letters.length !== 3) return 0;

  const counts = new Map<AnchorLetter, number>();
  for (const L of letters) counts.set(L, (counts.get(L) ?? 0) + 1);
  const maxRep = Math.max(...counts.values(), 0);

  if (maxRep === 3) {
    const L = letters[0]!;
    const k = anchorLetterKind(L, type);
    if (k === 'primary') return 1;
    if (k === 'secondary') return 0.75;
    return 0.25;
  }

  if (maxRep === 2) {
    let dominant: AnchorLetter | undefined;
    let odd: AnchorLetter | undefined;
    for (const [L, n] of counts) {
      if (n === 2) dominant = L;
      if (n === 1) odd = L;
    }
    if (dominant === undefined || odd === undefined) return 0.2;
    const kd = anchorLetterKind(dominant, type);
    if (kd === 'primary') return 0.85;
    if (kd === 'secondary') return 0.6;
    const ko = anchorLetterKind(odd, type);
    if (ko === 'primary' || ko === 'secondary') return 0.45;
    return 0.25;
  }

  let anyAnchorHit = false;
  for (const L of letters) {
    const k = anchorLetterKind(L, type);
    if (k === 'primary' || k === 'secondary') anyAnchorHit = true;
  }
  return anyAnchorHit ? 0.4 : 0.2;
}

/** Эффективная ось якоря §4.6 (поправка для граничных типов). */
export function effectiveAnchorScore46(raw: number, typeBoundary: boolean): number {
  if (!typeBoundary) return raw;
  return Math.min(1, raw + CONF_BOUNDARY_ANCHOR_BONUS);
}

export type AnchorRowKind46 =
  | 'triple_primary'
  | 'pair_primary'
  | 'triple_secondary'
  | 'pair_secondary'
  | 'other';

/** Вариант строки таблицы §4.6 для резолюций clean/good vs anchor_secondary. */
export function anchorSemanticKind46(letters: readonly AnchorLetter[], type: CognitiveTypeRow): AnchorRowKind46 {
  if (letters.length !== 3) return 'other';

  const counts = new Map<AnchorLetter, number>();
  for (const L of letters) counts.set(L, (counts.get(L) ?? 0) + 1);
  const maxRep = Math.max(...counts.values(), 0);

  if (maxRep === 3) {
    const k = anchorLetterKind(letters[0]!, type);
    if (k === 'primary') return 'triple_primary';
    if (k === 'secondary') return 'triple_secondary';
    return 'other';
  }
  if (maxRep === 2) {
    let dominant: AnchorLetter | undefined;
    for (const [L, n] of counts) {
      if (n === 2) dominant = L;
    }
    if (!dominant) return 'other';
    const kd = anchorLetterKind(dominant, type);
    if (kd === 'primary') return 'pair_primary';
    if (kd === 'secondary') return 'pair_secondary';
    return 'other';
  }
  return 'other';
}

/** §4.2 / §4.6 — граничные типы в каталоге. */
function isBoundaryType(type: CognitiveTypeRow): boolean {
  return BOUNDARY_TYPE_NAMES.has(type.name);
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

/** Формула уверенности §4.6 (совпадает с `computeConfidence`). */
export function confidenceFromAxes(axes: ConfidenceAxes): number {
  return (
    CONF_WEIGHT_GOAL * axes.goalAxis +
    CONF_WEIGHT_MODALITY * axes.modalityAxis +
    CONF_WEIGHT_ANCHOR * axes.anchorAxis
  );
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

function computeAnchorAxisForConfidence(coords: AssembledCoordinates, matched: MatchTypesResult): number {
  const top = matched.matchedTypes[0];
  if (!top || coords.anchorLetters.length !== 3) return 0;
  const raw = anchorScoreRaw46(coords.anchorLetters, top);
  return effectiveAnchorScore46(raw, isBoundaryType(top));
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

/** Порог mF для clean_match: «идеальная» посадка профиля (методика §4.6 «≥ 0.9» трактуем как полную совпадение минус один короткий сдвиг). */
const CLEAN_MATCH_MF_THRESHOLD = 0.95;

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

/** Инвариант §4.6: согласование резолюции и числа C (`weak` < 0.7; `clean_match` ≥ 0.85). */
function applyConfidenceInvariant46(resolution: ConfidenceResolution, c: number): number {
  if (resolution === 'clean_match') return Math.max(c, CONF_INVARIANT_CLEAN_MIN);
  if (resolution === 'weak') return Math.min(c, CONF_INVARIANT_WEAK_MAX);
  return c;
}

function resolveConfidenceResolution46(
  coords: AssembledCoordinates,
  matched: MatchTypesResult,
  top: CognitiveTypeRow,
  mF: number,
): ConfidenceResolution {
  const anchorSem = anchorSemanticKind46(coords.anchorLetters, top);
  const primTier = anchorSem === 'triple_primary' || anchorSem === 'pair_primary';
  const secTier = anchorSem === 'triple_secondary' || anchorSem === 'pair_secondary';

  if (coords.coreFormation === 'tie') {
    if (hasMultiplePureCloseFit(coords)) return 'multiple';
    if (isBoundaryType(top)) return 'boundary';
    return 'weak';
  }

  if (coords.coreFormation === 'single') {
    /** Два и более типа с одинаковой посадкой по модальности (§4.2) — явный «рисунок», даже при одном ядре цели. */
    if (matched.syntheticDrawing && matched.matchedTypes.length >= 2) return 'multiple';
    if (mF >= CLEAN_MATCH_MF_THRESHOLD && primTier) return 'clean_match';
    if (mF >= 0.7 && primTier) return 'good_match';
    if (mF >= 0.7 && secTier) return 'anchor_secondary';
    if (isBoundaryType(top) && mF >= 0.7) return 'boundary';
    return 'weak';
  }

  return 'weak';
}

/**
 * Уверенность и резолюция по методике Cognitive Identity Map §4.6.
 * Алгоритм типа — §4.2 (`matchTypes`); C = весовая формула осей + инвариант «резолюция ⇔ диапазон C».
 */
export function computeConfidence(coords: AssembledCoordinates, matched: MatchTypesResult): ConfidenceResult {
  if (coords.coreFormation === 'unformed') {
    return { confidence: 0.3, resolution: 'unformed', message: CONF_MESSAGES.unformed };
  }

  const top = matched.matchedTypes[0];
  if (!top || coords.modalityProfile.length !== 5) {
    return { confidence: 0.4, resolution: 'weak', message: CONF_MESSAGES.weak };
  }

  const gC = computeGoalAxisForConfidence(coords, matched);
  const mF = modalityFit(coords.modalityProfile, top);
  const aS_raw =
    coords.anchorLetters.length === 3 ? anchorScoreRaw46(coords.anchorLetters, top) : 0;
  const aS_eff = effectiveAnchorScore46(aS_raw, isBoundaryType(top));

  let confidence =
    CONF_WEIGHT_GOAL * gC + CONF_WEIGHT_MODALITY * mF + CONF_WEIGHT_ANCHOR * aS_eff;

  const resolution = resolveConfidenceResolution46(coords, matched, top, mF);
  confidence = applyConfidenceInvariant46(resolution, confidence);

  return {
    confidence: Math.round(confidence * 1000) / 1000,
    resolution,
    message: CONF_MESSAGES[resolution],
  };
}
