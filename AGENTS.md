# AGENTS.md — ÆON MAX Bot

Это зеркало `.cursor/rules/aeon-pda.mdc` для агентов вне Cursor и для людей.

## Как работать

1. **Источник алгоритма:** `docs/aeon-max-bot.vibepp.yaml` (ключи `iterations`, `invariants`, `constants`, `events`, `architecture`, `dialog`, `monetization`, `aeon_layers`, `max_platform`).
2. **Проверяйся по:** `docs/SPEC/SPEC.md`, `docs/SPEC_SUMMARY.md`, остальные PDA-файлы в `docs/SPEC/`, `docs/CURSOR_PROMPT_MAX_BOT.md`, `docs/GITHUB_ISSUES.md`, `docs/GIT_STRATEGY.md`, `docs/GIT_HOOKS.md`.
3. **Стоп-правило:** при неопределённости / конфликте / отсутствии инварианта / отсутствии issue / отсутствии ветки итерации — **остановись, задай 1–3 вопроса, обнови артефакты, дождись подтверждения**, только потом код.
4. **Жёсткие инварианты:** `vibepp.yaml → rules.hard`. Это hard-constraints.
5. **Git:** `main` = рабочее/деплой; итерации — `feat/iter-N`; эксперименты — `exp/<name>`; коммитить часто, по триггерам из `GIT_STRATEGY.md`.
6. **Валидаторы:** `node scripts/check-spec.mjs`, `node scripts/check-git-policy.mjs` — см. `docs/GIT_HOOKS.md` (подключение `.githooks`, Cursor hooks). SPEC читается из `docs/SPEC/SPEC.md`.

## Секреты

Никаких `.env` в репозитории. Шаблон — `.env.example`. Ключи API (Claude, OpenAI, MAX Bot) и пароли БД — только окружение сервера / CI secrets.

## Стек (зафиксировано)

TypeScript 5.x · Node.js 22 LTS · Fastify · PostgreSQL 16 · Redis 7 · Vitest + fast-check · OpenTelemetry.

Детали — `docs/SPEC/SPEC.md` → «Решения по стеку» и `vibepp.yaml → architecture.stack`.
