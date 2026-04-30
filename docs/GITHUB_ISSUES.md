# GitHub Issues — ÆON Map MAX Bot (черновики)

Скопируй в GitHub: для каждой итерации создай **Milestone** с именем из колонки «Milestone», затем **Issue** с телом ниже. Labels создай один раз (раздел в конце).

Источник: `aeon-max-bot.vibepp.yaml` → `iterations`, плюс SPEC.

**Git:** частота коммитов, ветки `feat/iter-N`, `main` — `GIT_STRATEGY.md`; pre-commit и Cursor — `GIT_HOOKS.md`.

---

## Метки (Labels)

Создай в репозитории:

| Label | Цвет (пример) | Смысл |
|-------|----------------|--------|
| `iteration` | — | группа (или используй префиксы ниже) |
| `iteration-0` … `iteration-7` | `#0E8A16` | привязка к итерации |
| `mvp` | `#D93F0B` | в скоупе MVP |
| `area/infrastructure` | `#1D76DB` | репо, docker, деплой |
| `area/max` | `#5319E7` | MAX Bot API, webhook |
| `area/events` | `#FBCA04` | event store, идемпотентность |
| `area/dialog` | `#C5DEF5` | dialog engine, сессии |
| `area/llm` | `#BFDADC` | Claude, OpenAI, промпты |
| `area/aeon` | `#D4C5F9` | карты, профиль, сигналы |
| `area/stability` | `#FF7619` | лимиты, safety Gate 1 |
| `area/observability` | `#F9D0C4` | метрики, алерты, Grafana |
| `priority/p0` | `#B60205` | блокирует следующую итерацию |

**Milestones (8 штук):**

1. `Iteration 0 — Скелет`
2. `Iteration 1 — Event Core`
3. `Iteration 2 — Первый вопрос`
4. `Iteration 3 — LLM-диалог`
5. `Iteration 4 — Первая карта (Cognitive по протоколу v1)`
6. `Iteration 5 — MVP профиль`
7. `Iteration 6 — Наблюдаемость`
8. `Iteration 7 — Safety + Glyph + share card`

---

## Issue 1

**Title:** `[Iter 0] Скелет репо, docker-compose, webhook «привет», таблица events`

**Milestone:** `Iteration 0 — Скелет`

**Labels:** `iteration-0`, `mvp`, `area/infrastructure`, `area/max`, `area/events`, `priority/p0`

**Description:**

Стартовая вертикаль: репозиторий на **TypeScript / Node 22**, **Fastify**, **PostgreSQL + Redis** в **docker-compose**, минимальный **MAX webhook** → ответ пользователю «привет», первая миграция с таблицей **events** (append-only контракт на будущее).

**Deliverables:**

- Репо со скриптами `dev` / `build` / `test` (Vitest подключить можно минимально).
- `docker-compose`: Postgres, Redis, app-сервис.
- Webhook endpoint: валидация входа MAX (как в доке), **идемпотентность** заготовка под iter 1.
- Миграция: таблица `events` (минимум полей по контракту vibepp или упрощённо с пометкой расширить в iter 1).

**Acceptance criteria:**

- [ ] Пользователь пишет боту в MAX — приходит ответ «привет» (или эквивалент из SPEC).
- [ ] В БД есть возможность записать событие (хотя бы ручной insert или код записи `user.started`).
- [ ] `docker compose up` поднимает стек без ручных шагов (кроме `.env`).

**Связь с SPEC:** Блок 6 (webhook), «Решения по стеку».

---

## Issue 2

**Title:** `[Iter 1] Event Core: append-only, контракт события, идемпотентность по max_update_id`

**Milestone:** `Iteration 1 — Event Core`

**Labels:** `iteration-1`, `mvp`, `area/events`, `area/max`, `priority/p0`

**Description:**

Event store только **INSERT**, контракт полей как в `events.contract` (vibepp). **Идемпотентность:** повторный MAX update с тем же `update_id` не создаёт второе событие.

**Deliverables:**

- Реализация записи событий с `idempotency_key` / `max_update_id`.
- `user.started` при первом `/start` (или эквивалент входа в MAX).

**Acceptance criteria:**

- [ ] Дубль webhook payload с тем же идентификатором update **не** дублирует событие (тест или сценарий).
- [ ] События не удаляются и не обновляются (инвариант hard rules).

---

## Issue 3

**Title:** `[Iter 2] Диалог: session.opened, статичный первый вопрос Core, answer.given`

**Milestone:** `Iteration 2 — Первый вопрос`

**Labels:** `iteration-2`, `mvp`, `area/dialog`, `area/events`, `priority/p0`

**Description:**

Открытие сессии, один **статичный** первый вопрос Core Layer, сохранение ответа как неизменяемого `answer.given`.

**Deliverables:**

- `session.opened`, `question.asked`, `answer.given` в логе.
- Минимальный SessionContext / read model для следующего шага.

**Acceptance criteria:**

- [ ] Пользователь отвечает на вопрос — в event store есть цепочка событий сессии.
- [ ] Ответ нельзя «перезаписать» без нового события (политика INV-02).

---

## Issue 4

**Title:** `[Iter 3] LLM-диалог: Claude, адаптивный следующий вопрос, llm.called, fallback OpenAI`

**Milestone:** `Iteration 3 — LLM-диалог`

**Labels:** `iteration-3`, `mvp`, `area/llm`, `area/dialog`, `area/events`, `priority/p0`

**Description:**

Интеграция **Anthropic Claude**; следующий вопрос генерируется с учётом предыдущих ответов; **`llm.called`** с версией промпта; при таймауте/ошибке — **fallback OpenAI** (как в SPEC). Опционально на этом шаге: заготовка **signal classifier** (если не выносить в отдельный PR) — не блокер, если отложено до iter 4–5 с отдельной задачей.

**Deliverables:**

- Клиент Claude + конфиг моделей.
- Версионированные промпты в `/prompts`.
- Fallback-путь и метрика `llm_timeout_rate`.

**Acceptance criteria:**

- [ ] Минимум **5** последовательных обменов, каждый новый вопрос учитывает предыдущие ответы (ручная проверка + лог).
- [ ] Каждый успешный вызов LLM даёт `llm.called` до отправки сообщения пользователю.

---

## Issue 5

**Title:** `[Iter 4] Первая карта (Cognitive по протоколу v1): mapper, интерпретатор, card.computed, INV тесты`

**Milestone:** `Iteration 4 — Первая карта`

**Labels:** `iteration-4`, `mvp`, `area/aeon`, `area/dialog`, `area/llm`, `area/stability`, `priority/p0`

**Description:**

**ADR:** [`docs/ADR/002-cognitive-protocol-mode.md`](ADR/002-cognitive-protocol-mode.md). Iter-4 переведён на **протокольный режим карт**: пороговая модель сигналов исключена, карта собирается строго после прохождения протокола методики `docs/methodology/Cognitive_Identity_Map_v1.md`.

Поток на ход пользователя: `answer.given` → детерминированный **Protocol Mapper** (по таблицам §§3.2–3.4) → **`protocol.coordinate_assigned`** → LLM-интерпретатор (`cognitive-interpret-answer@v1`) → **`llm.called` (purpose=answer_interpretation)** + **`answer.interpreted`** → перед следующим вопросом **`protocol.continue_offered`** (сообщение только с кнопкой «Продолжить») → по callback **`question.asked`** и текст вопроса отдельным сообщением. На 12/12 — aeon_engine собирает тип по таблице соответствий §4.1 + алгоритм §4.2 и пишет `card.computed`. Правило-mapper — единственный источник истины.

**Deliverables:**

- Очередь протокола Cognitive v1: 12 вопросов (`core:protocol:goal:1..4`, `core:protocol:modality:1..5`, `core:protocol:anchor:1..3`).
- `src/protocols/cognitive_v1/` — определения вопросов, варианты ответов, маппинг по таблицам методики.
- `src/protocol_mapper/` — детерминированный mapper, без LLM.
- Событие **`protocol.coordinate_assigned`** (заменяет `card_signal.received`).
- Prompt `prompts/cognitive-interpret-answer.md` (`@v1`).
- Событие **`answer.interpreted`** + транзакция `answer.interpreted → question.asked → send` (INV-10).
- aeon_engine: сборка типа, выпуск `card.computed` с payload `{protocol_version, coordinates, matched_types, confidence_resolution, confidence_message, synthetic_drawing, core_unformed}`.
- Property-based тесты на **INV-03, INV-04, INV-05 (новая формулировка), INV-10** (Vitest + fast-check).
- Feature-flag `DIALOG_LLM_NEXT_QUESTION` (default: false на Core) — выключает iter-3 LLM-генерацию следующего вопроса.

**Acceptance criteria:**

- [ ] Cognitive-карта не назначается до 12/12 ответов протокола (INV-05).
- [ ] На каждом протокольном ответе пользователь получает короткое объяснение, к какой координате его относит LLM; событие `answer.interpreted` зафиксировано до следующего `question.asked` (INV-10).
- [ ] Следующий вопрос на Core берётся из очереди протокола, а не генерируется LLM.
- [ ] При confidence < `CARD_CONFIDENCE_THRESHOLD` имя типа в payload `card.computed` не показывается (только `confidence_message`) — INV-03.
- [ ] Множественные типы (рисунок) выставляются с явным флагом «синтетический рисунок» в payload (INV-04).
- [ ] Property-based тесты на INV-03/04/05/10 зелёные.

---

## Issue 5a

**Title:** `[Iter 5] Рендер полной карты §6 через LLM (card.rendered, purpose=card_render)`

**Milestone:** `Iteration 5 — MVP профиль`

**Labels:** `iteration-5`, `mvp`, `area/llm`, `area/dialog`, `area/events`, `priority/p1`

**Description:**

После **`card.computed`** один вызов LLM собирает **полный текст §6** (десять разделов методики) из координат и узких нарративных констант в коде. События **`llm.called`** (`purpose=card_render`, idempotency `llm.called:${session_id}:card.render`) и **`card.rendered`** (`card.rendered:${session_id}:${card_type}:${prompt_version}`). Конфиг: **`CARD_RENDER_ENABLED`**, **`CARD_RENDER_TIMEOUT_MS`**. Fallback — короткая строка как раньше.

**Acceptance criteria:**

- [ ] В DEV после завершения протокола пользователь получает полную карту (или fallback при ошибке/флаге).
- [ ] В логе событий есть пара `llm.called` + `card.rendered` с согласованными `prompt_version` и `llm_call_id`.

---

## Issue 6

**Title:** `[Iter 5] MVP профиль: слои I+II+IV, AeonProfile, /profile, Book of Consciousness`

**Milestone:** `Iteration 5 — MVP профиль`

**Labels:** `iteration-5`, `mvp`, `area/aeon`, `area/dialog`, `area/max`, `priority/p0`

**Description:**

Полная сессия по слоям MVP; **AeonProfile** как read model; команда **`/profile`**; **`session.completed`** → запись в **Book of Consciousness**. Выдача финала двумя сообщениями (пауза) — по SPEC Блок 5.

**Acceptance criteria:**

- [ ] Пользователь проходит сессию и получает профиль в чате.
- [ ] `/profile` отдаёт согласованный текст профиля.
- [ ] Book of Consciousness пополняется событием завершения.

---

## Issue 7

**Title:** `[Iter 6] Наблюдаемость: метрики, алерты, Grafana (или аналог)`

**Milestone:** `Iteration 6 — Наблюдаемость`

**Labels:** `iteration-6`, `mvp`, `area/observability`, `priority/p0`

**Description:**

Реализовать дашборды из vibepp `observability.dashboards`, алерты из `observability.alerts`, визуализация в Grafana или эквиваленте.

**Acceptance criteria:**

- [ ] Видны метрики: latency, completion, invariant violations, safety rate, webhook duplicates.
- [ ] Тестовый триггер нарушения инварианта поднимает алерт (в dev/staging).

---

## Issue 8

**Title:** `[Iter 7] Safety Gate 1 + Gate 2, Glyph DALL·E, PNG share card (sharp/resvg)`

**Milestone:** `Iteration 7 — Safety + Glyph + share card`

**Labels:** `iteration-7`, `mvp`, `area/stability`, `area/llm`, `area/aeon`, `area/max`, `priority/p0`

**Description:**

- **Gate 1** в `src/stability/`: rule-based / лёгкий классификатор **до** дорогих вызовов; тесты отдельно.
- **Gate 2**: границы в system prompt основного LLM.
- **`safety.triggered`** без хранения сырого текста пользователя.
- **Glyph:** OpenAI Images (**DALL·E**).
- **Share card:** SVG → PNG через **sharp** + **@resvg/resvg-js**, отправка в MAX как медиа.

**Acceptance criteria:**

- [ ] Кризисный ввод не вызывает Claude/OpenAI fallback для диалога (остановка по Gate 1).
- [ ] Глиф генерируется и показывается пользователю.
- [ ] PNG-карточка для шеринга собирается на бэке и отправляется.

---

## Issue 9

**Title:** `[Docs/Infra] Синхронизировать vibepp, SPEC, GITHUB_ISSUES и compose: Redis, iter-0, rules.hard`

**Milestone:** _(нет — техдолг документации / инфры)_

**Labels:** `area/infrastructure`, `mvp` _(опционально)_

**Description:**

Зафиксирован **временный drift** между репозиторием и текстом спеки (см. **`docs/ADR/001-redis-compose.md`**, секция **`repository_adr`** в `docs/aeon-max-bot.vibepp.yaml`).

**Несогласованности:**

- **`architecture.stack.cache`** и deliverables **iter-0** в vibepp описывают **Redis** в compose; в **`docker-compose.yml`** сейчас только **Postgres + app** (Redis убран после iter-1, идемпотентность вебхука в Postgres).
- **Issue 1** (черновик) всё ещё требует Postgres + Redis в compose — не совпадает с фактом.
- **`rules.hard`**: формулировка «инварианты не в БД-триггерах» расходится с миграцией **`002_events_append_only`** (триггер запрета UPDATE/DELETE на `events`) — нужно либо уточнить исключение для append-only, либо перенести контроль только в код (политика продукта).

**Deliverables:**

- Обновить **`docs/aeon-max-bot.vibepp.yaml`**: stack / iter-0 / при необходимости `rules.hard` — в соответствии с выбранным направлением (вернуть Redis в compose **или** официально описать этап без Redis до появления сессий/rate limits).
- Обновить **`docs/GITHUB_ISSUES.md` (Issue 1)** и при необходимости **`AGENTS.md`**, **`docs/SPEC/architecture.md`**, **`docs/CURSOR_PROMPT_MAX_BOT.md`**.
- Закрыть ADR 001 новым статусом или ADR-наследником, когда drift снят.

**Acceptance criteria:**

- [ ] В vibepp и в Issue 1 нет противоречия с **`docker-compose.yml`** (или compose изменён под vibepp — явно в том же PR).
- [ ] `rules.hard` согласован с политикой enforcement для таблицы `events` (триггер vs только приложение).
- [ ] В **`docs/ADR/001-redis-compose.md`** отражён итог (обновлён статус / ссылка на PR).

---

## Бэклог (после закрытия итерации 0–7)

**Title:** `[Backlog] Freemium QIP: события биллинга, проверка баланса в Stability Engine`

**Milestone:** _(нет или «Post-MVP»)_

**Labels:** `area/aeon`, `area/stability`, `area/events`

**Description:**

Реализация **Блок 9 SPEC**: списания QIP, разблокировка платных слоёв/анализа, события домена, интеграция с API кошелька QIP — после готовности контракта с платформой QIP.

**Acceptance criteria:** _(заполнить при появлении API QIP)._

---

## Как вести PR

В описании PR: `Closes #N` — номер соответствующего issue. Для крупных итераций допустимы под-issues (sub-task), но **milestone** остаётся общим для всей итерации.
