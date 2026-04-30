# Roadmap — ÆON Map MAX Bot

**Источник:** `aeon-max-bot.vibepp.yaml` → `iterations`, `aeon_layers`, `features.v1_addition`; **оценки** — ориентиры для **соло + агент** (Cursor), не фиксированный SLA.

---

## MVP (итерации 0–7)

| Iter | Название | Содержание | Оценка (недели) |
|------|----------|------------|-----------------|
| 0 | Скелет | Repo, TS/Node/Fastify, docker-compose, webhook «привет», таблица events | 0.5–1 |
| 1 | Event Core | Append-only, контракт, идемпотентность max_update_id | 0.5–1 |
| 2 | Первый вопрос | session.opened, question.asked, answer.given | 0.5–1 |
| 3 | LLM-диалог | Claude, llm.called, промпты, fallback OpenAI | 1–1.5 |
| 4 | Первая карта (Cognitive по протоколу v1) | Протокол 12 вопросов, protocol_mapper, prompt cognitive-interpret-answer@v1, protocol.coordinate_assigned, answer.interpreted, aeon_engine, card.computed, INV-03/04/05/10 (ADR 002) | 1.5–2.5 |
| 5 | MVP профиль | Слои I+II+IV, AeonProfile, /profile, Book of Consciousness | 1–2 |
| 6 | Наблюдаемость | Метрики, алерты, Grafana | 1 |
| 7 | Safety + Glyph + share | Gate 1/2, DALL·E, PNG карточка | 1–1.5 |

**Итого MVP (0–7):** примерно **6–10 недель** чистого времени разработки при стабильном доступе к MAX API и ключам; первый реальный диапазон уточняется после Iter 0–1.

---

## v1 (после MVP)

- Слои **III Strategic** и **V Dynamic** (`aeon_layers.v1_addition`)
- Еженедельный **глиф-дайджест**
- **Публичная ссылка** на веб-профиль (Mini App или лендинг)
- **Оценка:** +**6–10 недель** (зависит от веб-слоя и уведомлений)

---

## v2

- Слои **VI Integration**, **VII Meta** (в т.ч. расширенный Meta / Book)
- **Оценка:** +**8–12 недель**

---

## Вне скоупа MVP

См. `vibepp.yaml` → `features.out_of_scope_mvp`.

---

## Трекинг в GitHub

Черновики issues и milestones — `GITHUB_ISSUES.md`. Ветки — `feat/iter-N` (`GIT_STRATEGY.md`).
