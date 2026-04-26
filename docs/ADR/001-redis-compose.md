# ADR 001: Redis в целевом stack и отсутствие Redis в docker-compose

**Статус:** принято (временный drift зафиксирован)  
**Дата:** 2026-04-26  
**Связанные артефакты:** `docs/aeon-max-bot.vibepp.yaml` (`architecture.stack.cache`, `iterations.id: 0`), `docker-compose.yml`, `docs/GITHUB_ISSUES.md` → Issue 9.

## Контекст

В vibepp и в черновике Issue 1 для iter-0 указан **docker-compose** с **PostgreSQL + Redis + app**. В `architecture.stack` целевой кэш — **Redis 7** (сессии, rate limits).

После **iter-1 (Event Core)** идемпотентность вебхука реализована в **PostgreSQL** (`idempotency_key`, `ON CONFLICT DO NOTHING`). Отдельный Redis для дедупликации вебхуков стал избыточен. Сервис **Redis из compose убрали** — в репозитории остались только Postgres и app.

## Решение

1. **Фактическое состояние репо (на момент ADR):** в `docker-compose.yml` **нет** Redis; идемпотентность MAX webhook для `user.started` — в БД.
2. **Целевая архитектура по vibepp** по-прежнему допускает **Redis** для сессий, rate limits и прочего, что появится в следующих итерациях.
3. Расхождение между текстом yaml / Issue 1 и compose — **осознанный временный drift**, не случайная потеря контекста.

## Последствия

- Агенты и разработчики не должны «восстанавливать Redis из yaml» без явной задачи: сначала сверка с Issue 9 и обновление спеки при необходимости.
- При добавлении сессий / rate limit по roadmap нужно либо **вернуть Redis в compose** (и обновить `.env.example`), либо зафиксировать в новом ADR **отказ от Redis** для этих ролей в пользу Postgres.

## Что сделать дальше (см. Issue 9)

Синхронизировать: `vibepp.yaml` (stack, iter-0 deliverables), `docs/GITHUB_ISSUES.md` (Issue 1), при необходимости `AGENTS.md` и `docs/SPEC/*` — либо вернуть Redis в compose, либо официально описать Postgres-only этап до появления фич, требующих Redis.
