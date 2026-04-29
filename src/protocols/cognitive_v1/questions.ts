import { ANCHOR_LETTERS_ORDER, type CognitiveAxis } from './types.js';
import type { ProtocolQuestionId } from './queue.js';

export type ProtocolVariant = {
  /** Ключ для mapper: для цели — 1–8; для якоря — буква А–З; для модальности — А/Б/М. */
  key: string;
  /** Строка варианта для пользователя. */
  text: string;
};

export type ProtocolQuestion = {
  id: ProtocolQuestionId;
  axis: CognitiveAxis;
  /** Порядок в протоколе 1..12 */
  order: number;
  /** Заголовок блока / короткое имя для логов */
  label: string;
  /** Основной текст вопроса (курсив из методики как обычный текст). */
  stem: string;
  variants: readonly ProtocolVariant[];
};

const GOAL_VARIANTS: readonly ProtocolVariant[] = [
  { key: '1', text: '«А что там на самом деле было? Где правда?»' },
  { key: '2', text: '«Как это вообще устроено? Почему так получилось?»' },
  { key: '3', text: '«Как мне разобраться в этой каше? Где что лежит?»' },
  { key: '4', text: '«Так, и что мне теперь с этим делать?»' },
  { key: '5', text: '«Что это вообще для меня значит? Зачем всё это?»' },
  { key: '6', text: '«А что, если попробовать вот так? Что из этого может выйти?»' },
  { key: '7', text: '«Как одно вяжется с другим? Что между ними общего?»' },
  { key: '8', text: '«Как сделать это правильно, без зазоров и косяков?»' },
];

const GOAL_VARIANTS_C2: readonly ProtocolVariant[] = [
  { key: '1', text: 'Когда я проверил — да, всё именно так и было' },
  { key: '2', text: 'Когда я понял, как там всё работает изнутри' },
  { key: '3', text: 'Когда у меня в голове сложилась картинка — что где, что с чем связано' },
  { key: '4', text: 'Когда я понял, что мне с этим делать дальше' },
  { key: '5', text: 'Когда я понял, что это для меня значит' },
  { key: '6', text: 'Когда я увидел, во что это может вырасти' },
  { key: '7', text: 'Когда разные куски наконец сложились в одно целое' },
  { key: '8', text: 'Когда всё встало на свои места — точно, без зазоров' },
];

const GOAL_VARIANTS_C3: readonly ProtocolVariant[] = [
  { key: '1', text: 'Детектив, который замечает деталь, ускользнувшую от всех, и доходит до правды' },
  { key: '2', text: 'Инженер, который разобрал чужой механизм и понял, как тот работает' },
  { key: '3', text: 'Куратор, превративший хаотичный склад случайных вещей в коллекцию, где сразу всё понятно' },
  { key: '4', text: 'Хирург в операционной: минута на решение, от него зависит жизнь' },
  {
    key: '5',
    text: 'Человек, прошедший через тёмный период и через годы понявший, ради чего всё это было',
  },
  {
    key: '6',
    text: 'Тот, кто увидел будущее раньше других — то, что станет очевидным только лет через десять',
  },
  { key: '7', text: 'Дирижёр, собирающий из шумящих музыкантов единое звучание' },
  { key: '8', text: 'Часовщик, собирающий механизм, где каждая деталь точно на своём месте' },
];

const GOAL_VARIANTS_C4: readonly ProtocolVariant[] = [
  { key: '1', text: 'Раскапывать какую-то историю, разбираться, как там было на самом деле' },
  { key: '2', text: 'Изучать, как что-то устроено — двигатель, мозг, экономика, язык' },
  { key: '3', text: 'Наводить порядок в области, где у меня давно хаос — заметки, фото, идеи' },
  { key: '4', text: 'Решать конкретные задачи — что-то чинить, делать, строить' },
  { key: '5', text: 'Думать о своей жизни и о том, что в ней главное' },
  { key: '6', text: 'Мечтать, придумывать новое — проекты, идеи, образы' },
  { key: '7', text: 'Искать, как мои разные интересы и знания связаны между собой' },
  { key: '8', text: 'Доводить какое-то одно дело до идеального исполнения' },
];

function modalityVariants(a: string, b: string, mid: string): readonly ProtocolVariant[] {
  return [
    { key: 'А', text: `А: ${a}` },
    { key: 'Б', text: `Б: ${b}` },
    { key: 'М', text: `Среднее: ${mid}` },
  ];
}

function anchorVariants(lines: readonly string[]): readonly ProtocolVariant[] {
  return lines.map((line, i) => ({ key: ANCHOR_LETTERS_ORDER[i]!, text: line }));
}

const Я1_LINES = [
  'Покажи мне данные. Факты, цифры, повторяющиеся наблюдения.',
  'Чтобы всё сошлось логически. Ни одной дыры в рассуждении.',
  'Я просто чувствую — это правда. Объяснить не могу, но знаю.',
  'Это сказал тот, кому я доверяю — традиция, серьёзная школа, опытный человек.',
  'Я попробовал — работает. Значит, верно.',
  'Тело отзывается. Дыхание ровное, нет внутреннего напряжения.',
  'Это выдержало разговор с другим умным человеком, и он согласился.',
  'Это правильно по совести. По-другому быть не может.',
];

const Я2_LINES = [
  '«Все так говорят», «общеизвестно» — без проверки.',
  'Когда человек сам себе противоречит — из его же слов следует одно, а он утверждает другое.',
  'Сухой формализм, в котором нет живого ощущения сути.',
  'Когда у человека нет ни одного источника, кроме самого себя.',
  '«В теории это верно» — а на практике не работает.',
  'Слова правильные, но за ними пустота.',
  'Когда человек говорит сам с собой, не слышит собеседника, не реагирует на возражения.',
  'Когда «эффективное» обходит совесть.',
];

const Я3_LINES = [
  'У кого больше доказательств и фактов.',
  'У кого позиция логически полнее, без дыр.',
  'Какая позиция отзывается внутри как правда.',
  'Чья позиция ближе к проверенной мудрости или к мнению людей, которым я доверяю.',
  'Чьё решение лучше работает на практике.',
  'Какую позицию тело принимает, какую — нет.',
  'Чья позиция выживает после нескольких раундов спора.',
  'Какая позиция правильнее по совести.',
];

/** 12 вопросов Cognitive Identity Map v1 (§3.2–3.4). */
export const COGNITIVE_PROTOCOL_QUESTIONS: readonly ProtocolQuestion[] = [
  {
    id: 'core:protocol:goal:1',
    axis: 'goal',
    order: 1,
    label: 'Ц1',
    stem: '*Представь, что ты лежишь и не можешь заснуть, мысли идут сами. О чём ты чаще всего думаешь?*\n\nПодсказки (выбери одну, максимум две):',
    variants: GOAL_VARIANTS,
  },
  {
    id: 'core:protocol:goal:2',
    axis: 'goal',
    order: 2,
    label: 'Ц2',
    stem: '*Ты долго о чём-то думал — задаче, ситуации, человеке. В какой момент ты говоришь себе «всё, я разобрался, можно отпустить»?*\n\nПодсказки:',
    variants: GOAL_VARIANTS_C2,
  },
  {
    id: 'core:protocol:goal:3',
    axis: 'goal',
    order: 3,
    label: 'Ц3',
    stem: '*Какие истории цепляют тебя сильнее остальных? Можно выбрать две.*',
    variants: GOAL_VARIANTS_C3,
  },
  {
    id: 'core:protocol:goal:4',
    axis: 'goal',
    order: 4,
    label: 'Ц4',
    stem: '*У тебя появился свободный год — никаких обязательств, деньги есть. Чем ты на самом деле захочешь заниматься, когда отдохнёшь?*',
    variants: GOAL_VARIANTS_C4,
  },
  {
    id: 'core:protocol:modality:1',
    axis: 'modality',
    order: 5,
    label: 'М1',
    stem: '*Тебе нужно разобраться в чём-то новом — в новой работе, новой теме, в незнакомом человеке. С чего ты обычно начинаешь?*',
    variants: modalityVariants(
      'Разбираю по кусочкам. Сначала части, потом из них складываю общую картину.',
      'Сразу схватываю целиком — общее впечатление, образ. Детали достраиваются потом, по ходу.',
      'Умею и так, и так. Переключаюсь по задаче.',
    ),
  },
  {
    id: 'core:protocol:modality:2',
    axis: 'modality',
    order: 6,
    label: 'М2',
    stem: '*Ты решаешь сложную задачу. Как движется твоя мысль?*',
    variants: modalityVariants(
      'По прямой, шаг за шагом. Сначала одно, потом второе, потом ответ.',
      'Скачками, в разные стороны сразу. Думаю о пяти вещах одновременно, и ответ собирается из их соединения.',
      'Зависит от задачи. Иногда по шагам, иногда сразу обо всём.',
    ),
  },
  {
    id: 'core:protocol:modality:3',
    axis: 'modality',
    order: 7,
    label: 'М3',
    stem: '*На чём твоя мысль держится — на примерах или на общих правилах?*',
    variants: modalityVariants(
      'На примерах, на конкретике, на случаях из жизни. Без них мысль ускользает.',
      'На общем правиле, на принципе. Конкретный случай для меня — это пример, не главное.',
      'Хожу между уровнями. От частного к общему и обратно.',
    ),
  },
  {
    id: 'core:protocol:modality:4',
    axis: 'modality',
    order: 8,
    label: 'М4',
    stem: '*Как у тебя приходит ответ?*',
    variants: modalityVariants(
      'Быстро. Часто раньше, чем я успеваю сформулировать вопрос. Сразу всплывает решение.',
      'Медленно. Думаю долго, не торопясь. Если тороплюсь — ошибаюсь.',
      'Чередуется по типу задачи. Привычное — быстро, новое — медленно.',
    ),
  },
  {
    id: 'core:protocol:modality:5',
    axis: 'modality',
    order: 9,
    label: 'М5',
    stem: '*Когда тебе нужно что-то придумать или решить — что для тебя важнее?*',
    variants: modalityVariants(
      'Найти один правильный ответ. Лишнее отбросить, оставить главное.',
      'Накидать как можно больше вариантов. Чем больше альтернатив — тем лучше.',
      'Сначала много вариантов, потом выбираю из них один.',
    ),
  },
  {
    id: 'core:protocol:anchor:1',
    axis: 'anchor',
    order: 10,
    label: 'Я1',
    stem: '*Что должно случиться, чтобы ты сказал «да, теперь я в этом уверен»?*',
    variants: anchorVariants(Я1_LINES),
  },
  {
    id: 'core:protocol:anchor:2',
    axis: 'anchor',
    order: 11,
    label: 'Я2',
    stem: '*От каких способов доказывать что-то тебя физически коробит?*',
    variants: anchorVariants(Я2_LINES),
  },
  {
    id: 'core:protocol:anchor:3',
    axis: 'anchor',
    order: 12,
    label: 'Я3',
    stem: '*Два умных человека спорят, и оба правы по-своему. Как ты для себя решаешь, кто из них ближе к истине?*',
    variants: anchorVariants(Я3_LINES),
  },
];

const BY_ID = new Map<ProtocolQuestionId, ProtocolQuestion>(
  COGNITIVE_PROTOCOL_QUESTIONS.map((q) => [q.id, q]),
);

export function getProtocolQuestion(id: string): ProtocolQuestion | undefined {
  return BY_ID.get(id as ProtocolQuestionId);
}

const AXIS_LABEL_INTERPRET: Record<CognitiveAxis, string> = {
  goal: 'Цель',
  modality: 'Модальность',
  anchor: 'Якорь',
};

/** Контекст вопроса для LLM cognitive-interpret (стем + варианты + ожидаемый формат ответа). */
export function formatProtocolQuestionForInterpretPrompt(q: ProtocolQuestion): string {
  const axisHint =
    q.axis === 'goal'
      ? 'Ожидаемый формат ответа пользователя: одна цифра от 1 до 8 (номер пункта).'
      : q.axis === 'modality'
        ? 'Ожидаемый формат ответа пользователя: одна буква А, Б или М (латиница A, B, M допустима).'
        : 'Ожидаемый формат ответа пользователя: одна кириллическая буква от А до З (как у подписи к строке).';
  const variantsBlock =
    q.axis === 'goal' || q.axis === 'anchor'
      ? q.variants.map((v) => `${v.key}. ${v.text}`).join('\n')
      : q.variants.map((v) => v.text).join('\n');
  return [
    `Текущий вопрос (${q.order}/12), блок «${q.label}», ось: ${q.axis}.`,
    axisHint,
    '',
    'Текст вопроса:',
    q.stem.trim(),
    '',
    'Варианты:',
    variantsBlock,
  ].join('\n');
}

/** Краткий список уже зафиксированных координат до текущего шага. */
export function formatPriorCoordinatesSummaryForInterpret(
  rows: ReadonlyArray<{ questionId: string; axis: CognitiveAxis; coordinate: string }>,
): string {
  if (rows.length === 0) {
    return 'Ранее в этой сессии координаты ещё не зафиксированы (первый ответ протокола).';
  }
  return rows
    .map((r) => {
      const q = getProtocolQuestion(r.questionId);
      const step = q ? q.label : r.questionId;
      return `- ${AXIS_LABEL_INTERPRET[r.axis]} (${step}): ${r.coordinate}`;
    })
    .join('\n');
}

/** Полный текст сообщения пользователю (без преамбулы бота). */
export function formatProtocolQuestionMessage(q: ProtocolQuestion): string {
  const variantLines =
    q.axis === 'goal' || q.axis === 'anchor'
      ? q.variants.map((v) => `${v.key}. ${v.text}`)
      : q.variants.map((v) => v.text);
  return [q.stem, '', ...variantLines].join('\n');
}

/** Разрыв строки в HTML для MAX/Telegram (предпочтительно &lt;br&gt; без слэша). */
const BR = '<br>';
const PAR = '<br><br>';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Стем методики: абзацы через двойной перенос; *курсив*; внутри абзаца — одинарный &lt;br&gt;. */
function stemMarkdownToHtml(stem: string): string {
  return stem
    .split(/\n\s*\n/)
    .map((para) => {
      const p = para.trim();
      let result = '';
      let lastIndex = 0;
      const re = /\*([^*]+)\*/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(p)) !== null) {
        result += escapeHtml(p.slice(lastIndex, m.index));
        result += `<i>${escapeHtml(m[1])}</i>`;
        lastIndex = m.index + m[0].length;
      }
      result += escapeHtml(p.slice(lastIndex));
      return result.replace(/\n/g, BR);
    })
    .join(PAR);
}

/** Пользовательское сообщение протокола с номерами/инструкциями (POST /messages format=html). */
export function formatProtocolQuestionMessageHtml(q: ProtocolQuestion): string {
  const stemHtml = stemMarkdownToHtml(q.stem);

  if (q.axis === 'goal' || q.axis === 'anchor') {
    const variantsHtml = q.variants
      .map((v) => `<b>${escapeHtml(v.key)}.</b> ${escapeHtml(v.text)}`)
      .join(PAR);
    const footer =
      q.axis === 'goal'
        ? `<i>Ответь <b>одной цифрой</b> — номер подходящего пункта от <b>1</b> до <b>8</b> (например: <b>6</b>). Полный текст без номера не принимается.</i>`
        : `<i>Ответь <b>одной буквой</b> — одна из <b>А</b>–<b>З</b>, как у подходящей строки (например: <b>В</b>). Полный текст без буквы не принимается.</i>`;
    return `${stemHtml}${PAR}<b>Варианты:</b>${PAR}${variantsHtml}${PAR}${footer}`;
  }

  if (q.axis === 'modality') {
    const variantsHtml = q.variants.map((v) => escapeHtml(v.text)).join(PAR);
    return `${stemHtml}${PAR}${variantsHtml}${PAR}<i>Ответь <b>одной буквой</b>: <b>А</b>, <b>Б</b> или <b>М</b> (латиница A, B, M допустима).</i>`;
  }

  const _: never = q.axis;
  throw new Error(`unexpected axis: ${_}`);
}

/** Стем для MAX Markdown: *курсив*, между абзацами — \\n\\n (как в format=markdown). */
function stemMarkdownToMarkdownStem(stem: string): string {
  return stem
    .split(/\n\s*\n/)
    .map((para) => {
      const p = para.trim();
      let result = '';
      let lastIndex = 0;
      const re = /\*([^*]+)\*/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(p)) !== null) {
        result += p.slice(lastIndex, m.index);
        result += `*${m[1]}*`;
        lastIndex = m.index + m[0].length;
      }
      result += p.slice(lastIndex);
      return result.replace(/\n/g, ' ');
    })
    .join('\n\n');
}

/** Исходящее сообщение протокола для MAX API — format `markdown` (переносы через пустые строки; см. dev.max.ru). */
export function formatProtocolQuestionMessageMarkdown(q: ProtocolQuestion): string {
  const stemMd = stemMarkdownToMarkdownStem(q.stem);
  if (q.axis === 'goal' || q.axis === 'anchor') {
    const variantsMd = q.variants.map((v) => `**${v.key}.** ${v.text}`).join('\n\n');
    const footer =
      q.axis === 'goal'
        ? `**Ответь одной цифрой** — номер подходящего пункта от **1** до **8** (например: **6**). _Полный текст без номера не принимается._`
        : `**Ответь одной буквой** — одна из **А**–**З**, как у подходящей строки (например: **В**). _Полный текст без буквы не принимается._`;
    return `${stemMd}\n\n**Варианты:**\n\n${variantsMd}\n\n${footer}`;
  }
  if (q.axis === 'modality') {
    const variantsMd = q.variants.map((v) => v.text).join('\n\n');
    return `${stemMd}\n\n${variantsMd}\n\n**Ответь одной буквой**: **А**, **Б** или **М** (латиница A, B, M допустима).`;
  }
  const _: never = q.axis;
  throw new Error(`unexpected axis: ${_}`);
}

/** Подсказка при ответе, который mapper не разобрал (recovery или legacy-путь). */
export function formatMapperInvalidReplyHtml(questionId: string): string {
  const q = getProtocolQuestion(questionId);
  if (!q) {
    return `<b>Не распознал ответ.</b>${PAR}Повтори ввод по формату текущего шага.`;
  }
  if (q.axis === 'goal') {
    return `<b>Не распознал ответ.</b>${PAR}Нужна <b>одна цифра от 1 до 8</b> — номер пункта списка (например: <b>6</b>).`;
  }
  if (q.axis === 'modality') {
    return `<b>Не распознал ответ.</b>${PAR}Ответь одной буквой: <b>А</b>, <b>Б</b> или <b>М</b>.`;
  }
  return `<b>Не распознал ответ.</b>${PAR}Нужна <b>одна буква от А до З</b> — буква строки якоря (например: <b>В</b>).`;
}

/** То же для отправки с format=markdown. */
export function formatMapperInvalidReplyMarkdown(questionId: string): string {
  const q = getProtocolQuestion(questionId);
  if (!q) {
    return `**Не распознал ответ.**\n\nПовтори ввод по формату текущего шага.`;
  }
  if (q.axis === 'goal') {
    return `**Не распознал ответ.**\n\nНужна **одна цифра от 1 до 8** — номер пункта списка (например: **6**).`;
  }
  if (q.axis === 'modality') {
    return `**Не распознал ответ.**\n\nОтветь одной буквой: **А**, **Б** или **М**.`;
  }
  return `**Не распознал ответ.**\n\nНужна **одна буква от А до З** — буква строки якоря (например: **В**).`;
}
