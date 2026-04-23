#!/usr/bin/env node
// Zero-dep валидатор синхронизации SPEC ↔ vibepp ↔ GitHub Issues.
// Работает через regex, не парсит YAML целиком. Цель — поймать типовые расхождения.
// Использование: node scripts/check-spec.mjs

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);

const FILES = {
  spec: resolve(ROOT, "docs/SPEC/SPEC.md"),
  vibepp: resolve(ROOT, "docs/aeon-max-bot.vibepp.yaml"),
  issues: resolve(ROOT, "docs/GITHUB_ISSUES.md"),
  prompt: resolve(ROOT, "docs/CURSOR_PROMPT_MAX_BOT.md"),
  git: resolve(ROOT, "docs/GIT_STRATEGY.md"),
  hooks: resolve(ROOT, "docs/GIT_HOOKS.md"),
};

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const errors = [];
const warnings = [];

function read(path) {
  if (!existsSync(path)) {
    errors.push(`Нет файла: ${path}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

const spec = read(FILES.spec);
const vibepp = read(FILES.vibepp);
const issues = read(FILES.issues);

// 1. INV-ids из vibepp
const invIds = [...vibepp.matchAll(/\bINV-[A-Z]?\d+\b/g)].map((m) => m[0]);
const invSet = new Set(invIds);
for (const inv of invSet) {
  const inSpec = spec.includes(inv);
  const testsGlob = existsSync(resolve(ROOT, "tests"));
  if (!inSpec && !testsGlob) {
    warnings.push(`Инвариант ${inv} есть в vibepp, но не упомянут в docs/SPEC/SPEC.md и нет tests/ (ожидаемо до iter-1).`);
  }
}

// 2. event_type из vibepp catalog (требуем точку в имени: foo.bar — это event type)
const eventTypes = [...vibepp.matchAll(/^\s*-\s*type:\s*([a-z_][\w]*\.[a-z_][\w.]*)/gm)].map((m) => m[1]);
const eventSet = new Set(eventTypes);
for (const ev of eventSet) {
  if (!spec.includes(ev) && !issues.includes(ev)) {
    warnings.push(`event_type "${ev}" не упомянут ни в docs/SPEC/SPEC.md, ни в GITHUB_ISSUES.md.`);
  }
}

// 3. iterations id из vibepp ↔ Milestones в GITHUB_ISSUES
const iterationIds = [...vibepp.matchAll(/^\s*-\s*id:\s*(\d+)\s*$/gm)].map((m) => m[1]);
for (const id of iterationIds) {
  const hasMilestone = new RegExp(`Iteration\\s+${id}\\s+—`).test(issues);
  if (!hasMilestone) {
    errors.push(`Итерация ${id} из vibepp не имеет milestone "Iteration ${id} — ..." в GITHUB_ISSUES.md.`);
  }
}

// 4. Жёсткие проверки SPEC ↔ vibepp (стек)
const stackChecks = [
  ["TypeScript", /typescript/i],
  ["Node.js 22", /node\.js\s*22/i],
  ["Fastify", /fastify/i],
  ["Vitest", /vitest/i],
];
for (const [label, re] of stackChecks) {
  if (!re.test(spec) || !re.test(vibepp)) {
    warnings.push(`Стек "${label}" не упомянут в обоих docs/SPEC/SPEC.md и vibepp.yaml.`);
  }
}

// 5. Секреты в репо (поверхностный скан)
const secretPatterns = [
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI-like
  /sk-ant-[a-zA-Z0-9-_]{20,}/g, // Anthropic-like
  /AIza[0-9A-Za-z-_]{35}/g, // Google API key
];
for (const file of [FILES.spec, FILES.vibepp, FILES.issues, FILES.prompt, FILES.git, FILES.hooks]) {
  const content = read(file);
  for (const re of secretPatterns) {
    if (re.test(content)) {
      errors.push(`Похоже на API-ключ в ${file} (${re}).`);
    }
  }
}

// 6. Ссылки из SPEC на несуществующие файлы (`Xxx.md` в обратных кавычках)
function resolveLinkedDoc(doc) {
  const specSubdir = new Set([
    "SPEC.md",
    "uncertainty-map.md",
    "domain-graph.md",
    "invariants.md",
    "constants.md",
    "events.md",
    "architecture.md",
    "observability.md",
    "roadmap.md",
  ]);
  if (specSubdir.has(doc)) return resolve(ROOT, "docs/SPEC", doc);
  return resolve(ROOT, "docs", doc);
}
const linkedDocs = [...spec.matchAll(/`([A-Za-z][A-Za-z0-9_-]*\.md)`/g)].map((m) => m[1]);
for (const doc of new Set(linkedDocs)) {
  const p = resolveLinkedDoc(doc);
  if (!existsSync(p)) {
    warnings.push(`docs/SPEC/SPEC.md ссылается на \`${doc}\`, файл не найден: ${p}`);
  }
}

// Итоги
console.log(dim(`check-spec: INV=${invSet.size}, events=${eventSet.size}, iterations=${iterationIds.length}`));

if (warnings.length) {
  console.log("\n" + yellow("WARN:"));
  for (const w of warnings) console.log("  " + yellow("• " + w));
}
if (errors.length) {
  console.log("\n" + red("ERROR:"));
  for (const e of errors) console.log("  " + red("• " + e));
  process.exit(1);
}

if (!warnings.length && !errors.length) {
  console.log(green("OK: SPEC/vibepp/ISSUES синхронны по поверхностным проверкам."));
} else {
  console.log(green("\nПредупреждения не блокируют, но просмотри их."));
}
