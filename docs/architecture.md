# Архитектура — ÆON Map MAX Bot

**Источник:** `aeon-max-bot.vibepp.yaml` → `architecture`, `project_structure`, `data_flow`.  
**Подход:** event-sourced, domain-centric, stability-first.

---

## Принцип

- **Event Core:** append-only в PostgreSQL.
- **Domain:** чистый код, без I/O, инварианты и валидаторы.
- **Stability Engine:** лимиты, пороги карт, **Safety Gate 1**, rate limit.
- **Signal classifier:** дешёвый шаг answer → `card_signal.received`.
- **Dialog engine:** сессии, слои, события на каждый шаг.
- **LLM client:** Claude (основной), OpenAI fallback, DALL·E для глифа; Gate 2 в system prompt.
- **Aeon engine:** карты, профиль, глиф — только из event store.
- **Read models:** UserProfile, CardSignalRollup, AnswerTail, SessionContext, BookOfConsciousness.

---

## Поток данных (сводка)

MAX Webhook → **MAX Adapter** (идемпотентность) → **Stability Engine** (Gate 1) → **Dialog Engine** → **Signal Classifier** → **LLM** → ответ пользователю; **answer.given** → **Event Core** → **Aeon Engine** (`card.computed` при порогах).

Полная ASCII-схема — в `vibepp.yaml` → `architecture.data_flow`.

---

## Стек (зафиксировано)

- **TypeScript 5.x**, **Node.js 22 LTS**, **Fastify**
- **PostgreSQL 16**, **Redis 7**
- **Vitest** + **fast-check**
- Миграции: **db-migrate | Drizzle** (выбор при инициализации репо)
- Шеринг: **sharp** + **@resvg/resvg-js**
- Наблюдаемость: **OpenTelemetry**, Prometheus-совместимые метрики

---

## Каталог каталогов `src/` (целевой)

См. `vibepp.yaml` → `project_structure.directories`: `domain/`, `events/`, `stability/`, `dialog/`, `signal_classifier/`, `aeon/`, `llm/`, `integrations/max/`, `read_models/`, `api/`, `tests/`, `migrations/`, `prompts/`.

---

## Деплой и MAX

- Webhook, HTTPS, стабильный домен — `SPEC.md` Блок 6, `vibepp.yaml` → `max_platform`, `deploy`.
