#!/usr/bin/env node
/**
 * Проверка ветки при коммите кода (GIT_STRATEGY.md).
 * AEON_GIT_POLICY=off | warn | strict  (по умолчанию warn)
 *
 * Разрешённые ветки для «кода»: main | feat/* | exp/*
 * На main при изменении кода — предупреждение или блок (strict).
 */
import { execSync } from "node:child_process";

const MODE = (process.env.AEON_GIT_POLICY || "warn").toLowerCase();

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

function git(args) {
  return execSync(`git ${args}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function isCodePath(rel) {
  if (!rel) return false;
  // Исключения: только документация/картинки/пример env
  if (rel.startsWith("docs/")) return false;
  if (rel.startsWith("pics/")) return false;
  if (rel === ".env.example") return false;

  const patterns = [
    /^src\//,
    /^migrations\//,
    /^tests\//,
    /^package\.json$/,
    /^package-lock\.json$/,
    /^pnpm-lock\.yaml$/,
    /^yarn\.lock$/,
    /^tsconfig.*\.json$/,
    /^vitest\.config\./,
    /^vite\.config\./,
    /^docker-compose/,
    /^Dockerfile$/,
    /^\.githooks\//,
    /^prompts\//,
    /^\.cursor\/hooks\//,
  ];
  if (patterns.some((re) => re.test(rel))) return true;

  if (rel.startsWith("scripts/")) {
    if (rel === "scripts/check-spec.mjs" || rel === "scripts/check-git-policy.mjs") return false;
    return true;
  }
  return false;
}

function branchAllowed(name) {
  if (name === "main" || name === "master") return "main";
  if (/^feat\//.test(name)) return "feat";
  if (/^exp\//.test(name)) return "exp";
  return "other";
}

if (MODE === "off") {
  console.log(DIM + "check-git-policy: AEON_GIT_POLICY=off, пропуск." + RST);
  process.exit(0);
}

let branch;
try {
  branch = git("rev-parse --abbrev-ref HEAD");
} catch {
  console.error(RED + "check-git-policy: не git-репозиторий?" + RST);
  process.exit(MODE === "strict" ? 1 : 0);
}

let staged;
try {
  staged = git("diff --cached --name-only")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
} catch {
  staged = [];
}

if (staged.length === 0) {
  process.exit(0);
}

const codeFiles = staged.filter(isCodePath);
if (codeFiles.length === 0) {
  process.exit(0);
}

const kind = branchAllowed(branch);
const msgMain = [
  `${YELLOW}[git-policy]${RST} Коммит **кода** с ветки ${branch}:`,
  `  ${codeFiles.slice(0, 8).join(", ")}${codeFiles.length > 8 ? " …" : ""}`,
  `По GIT_STRATEGY итерации лучше вести в ${DIM}feat/iter-N${RST} (или ${DIM}exp/…${RST}),`,
  `а ${DIM}main${RST} держать последним стабильным/задеплоенным.`,
  `Сейчас: ${kind === "main" ? "main — ок для мелочи, для итерации — переключись" : kind === "feat" || kind === "exp" ? "ветка ок" : "непривычное имя ветки"}.`,
].join("\n");

if (kind === "main") {
  console.error(msgMain);
  if (MODE === "strict") {
    console.error(RED + "strict: коммит кода на main запрещён. Создай feat/iter-N." + RST);
    process.exit(1);
  }
  process.exit(0);
}

if (kind === "other") {
  console.error(
    `${YELLOW}[git-policy]${RST} Ветка «${branch}» не main/feat/*/exp/*. Рекомендуется переименовать или создать feat/iter-N.`,
  );
  if (MODE === "strict") process.exit(1);
}

process.exit(0);
