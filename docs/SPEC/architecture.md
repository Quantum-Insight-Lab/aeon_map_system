# Архитектура — ÆON Map MAX Bot

**Источник:** `aeon-max-bot.vibepp.yaml` → `architecture`, `project_structure`, `data_flow`.  
**Подход:** event-sourced, domain-centric, stability-first.  
**ADR:** обновлено по **ADR 002** — протокольный режим карт.

---

## Принцип

- **Event Core:** append-only в PostgreSQL.
- **Domain:** чистый код, без I/O, инварианты и валидаторы.
- **Stability Engine:** лимиты, пороги, **Safety Gate 1**, rate limit; проверка `CARD_CONFIDENCE_THRESHOLD` при выпуске карты (мера согласованности протокольных координат, ADR 002).
- **Protocol Mapper** (бывший signal_classifier): детерминированно маппит выбор пользователя в координату по таблицам методики → `protocol.coordinate_assigned`.
- **Dialog Engine:** очередь протокола методики; следующий вопрос доставляется в конце сообщения LLM-интерпретатора (одно сообщение пользователю = «интерпретация + следующий вопрос»).
- **LLM client:** Claude (интерпретатор `cognitive-interpret-answer@v1`), OpenAI fallback, DALL·E для глифа; Gate 2 в system prompt; iter-3 LLM-генерация следующего вопроса — за feature-flag и не используется на Core.
- **Aeon engine:** при завершении протокола собирает тип по таблице соответствий и алгоритму определения; выпускает `card.computed` (правило — единственный источник истины; ADR 002).
- **Read models:** UserProfile, **CoordinateMatchRollup** (вместо CardSignalRollup), AnswerTail, SessionContext, BookOfConsciousness.

---

## Поток данных (сводка)

MAX Webhook → **MAX Adapter** (идемпотентность) → **Stability Engine** (Gate 1) → **Event Core** (`answer.given`) → **Protocol Mapper** (`protocol.coordinate_assigned`) → **LLM-интерпретатор** (`llm.called`, `answer.interpreted`) → **Dialog Engine** (следующий вопрос из очереди протокола) → **MAX Adapter** (одно сообщение «интерпретация + следующий вопрос»). На завершении протокола — **Aeon Engine** → `card.computed`.

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

См. `vibepp.yaml` → `project_structure.directories`: `domain/`, `events/`, `stability/`, `dialog/`, **`protocols/`** (новое — протоколы методик), **`protocol_mapper/`** (бывший `signal_classifier/`), `aeon/`, `llm/`, `integrations/max/`, `read_models/`, `api/`, `tests/`, `migrations/`, `prompts/`.

---

## Деплой и MAX

- Webhook, HTTPS, стабильный домен — `SPEC.md` Блок 6, `vibepp.yaml` → `max_platform`, `deploy`.
