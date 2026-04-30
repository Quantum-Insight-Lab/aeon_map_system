# Каталог событий — ÆON Map MAX Bot

**Источник:** `aeon-max-bot.vibepp.yaml` → `events`.  
**Контракт:** обязательные поля — `event_id`, `event_type`, `occurred_at`, `actor`, `subject`, `payload`, `idempotency_key`, `schema_version`; опционально `causation_id`, `correlation_id`.  
**ADR:** обновлено по **ADR 002** (+ правка 2026-04-30: из payload `card.computed` снят `disagreement_with_llm`, из каталога `purpose` — `rule_reconciliation`).

**Правило хранилища:** только `INSERT` в таблицу событий (см. `rules.hard`). На уровне PostgreSQL для таблицы `events` запрещены `UPDATE` и `DELETE` (триггер, миграция `002`).

**Форма `actor` / `subject` (vibepp `events.contract`):**

- `actor`: объект `{ "id": string, "role": string }` (например роль `user` или `service`).
- `subject`: объект `{ "entity": string, "id": string }` (сущность, на которую указывает событие, например `max_bot`).

**`event_id`:** в контракте указан UUID v7; приложение генерирует v7 при вставке.

### `max_update_id` (идемпотентность MAX, INV-07)

Стабильный идентификатор **одной доставки** update от MAX (для логов, трассировки в `payload`, будущих типов вроде `answer.given`):

| `update_type` | Правило |
|---------------|---------|
| `message_created` | если есть `message.body.mid` — использовать его как `max_update_id`; иначе fallback `msg_fallback:${message.timestamp}:${sender.user_id}` (крайний случай без `mid`). |
| `bot_started` | `bot_started:${timestamp}:${user.user_id}`. |

Если в будущем в корне Update появится поле `update_id` от платформы — оно получает приоритет над вычислением выше (расширение типов и этого раздела).

**Идемпотентность `user.started` (iter 1, вариант B):** ключ строки в БД — `idempotency_key = user.started:${max_user_id}`. Повторная доставка того же или другого update для уже известного пользователя не создаёт вторую строку `user.started`. В `payload` события допускается поле `max_update_id` для связи с конкретным вебхуком.

### Диалог iter-2 (первый статичный вопрос Core)

- **`correlation_id`** для `session.opened`, `question.asked`, `answer.given` одной сессии: строка **`session_id`** (UUID v7).
- В **`payload`** этих событий всегда есть **`max_user_id`** (число), чтобы выбирать цепочку по пользователю без отдельной таблицы сессий.
- **`session.opened` (iter-2):** `idempotency_key = session.opened:iter2:${max_user_id}` — одна такая сессия на пользователя в рамках iter-2. В payload опционально **`opening_message_mid`**: `message.body.mid` того `message_created`, после которого открыли сессию (если вход через текст пользователя). Нужен, чтобы **повторный вебхук с тем же mid** не записывался как `answer.given`. Для входа через **`bot_started`** поле не задаётся.
- **`question.asked` (первый вопрос Core):** `question_id = core:first`, `idempotency_key = question.asked:iter2:core:first:${max_user_id}`, в payload **`llm_call_id: null`**, текст вопроса из конфига приложения (`FIRST_CORE_QUESTION_TEXT` / дефолт в `config.ts`).
- **`answer.given`:** `idempotency_key = answer.given:${max_update_id}` (см. INV-07). В payload: **`max_update_id`**, **`max_user_id`**, **`answer_type`** (iter-2: `text`), **`answer_value`** — текст ответа.

### Диалог iter-3 (LLM-генерация следующего вопроса) — за feature-flag (ADR 002)

Логика iter-3 (`core:llm:k`) **остаётся в кодовой базе**, но на Core MVP **не используется**. Управляется feature-flag `DIALOG_LLM_NEXT_QUESTION` (default: false для Core). Применима к слоям без протокольной методики (если такие появятся в гибридном режиме). Контракт ниже — для случая, когда флаг включён:

- После **`answer.given`** на **`core:first`** и далее после каждого ответа на **`core:llm:k`**, пока номер шага меньше лимита (по умолчанию **5**, переменная окружения `LLM_FOLLOWUP_COUNT`), бот генерирует следующий вопрос через LLM.
- **`question_id` для LLM-вопросов:** `core:llm:1` … `core:llm:N` (один номер на ход).
- Порядок относительно исходящего сообщения пользователю (**INV-06**): сначала запись **`llm.called`**, затем **`question.asked`** с текстом вопроса, затем отправка в MAX.
- **`llm.called`:** `idempotency_key = llm.called:${session_id}:core:llm:${k}` (один вызов на номер вопроса `k`). В payload: **`session_id`**, **`max_user_id`**, **`model`**, **`provider`** (`anthropic` | `openai`), **`prompt_version`**, **`input_hash`**, **`latency_ms`**, **`question_text`** — сгенерированный текст следующего вопроса.
- **`question.asked` (LLM):** `idempotency_key = question.asked:${session_id}:core:llm:${k}`; в payload **`llm_call_id`** = `event_id` события **`llm.called`** для этого хода.

### Диалог iter-4 (Cognitive v1 по протоколу)

ADR 002. На Core MVP диалог идёт по очереди протокола методики, LLM используется как интерпретатор ответа, не как генератор следующего вопроса.

- **`question_id` для протокола:** `core:protocol:goal:1..4` (Ц1–Ц4), `core:protocol:modality:1..5` (М1–М5), `core:protocol:anchor:1..3` (Я1–Я3).
- **`idempotency_key`:** `question.asked:protocol:v1:${question_id}:${session_id}` — один и тот же протокольный вопрос не задаётся дважды в одной сессии.
- **`answer.given`** для протокольного вопроса: `idempotency_key = answer.given:${max_update_id}` (как в iter-2/3); в payload, помимо стандартных полей, ожидается, что `answer_value` нормализован под формат варианта методики (например, цифра или буква).
- **`protocol.coordinate_assigned`** (новый, ADR 002):
  - causation — `event_id` соответствующего `answer.given`;
  - correlation — `session_id`;
  - `idempotency_key = protocol.coordinate_assigned:${session_id}:${question_id}` — одна координата на ответ;
  - payload: `answer_id`, `user_id`, `card_type` (для iter-4 — `CognitiveIdentityMap`), `axis ∈ {goal, modality, anchor}`, `coordinate` (значение из таблиц §§3.2–3.4 методики), `source_question_id`, `llm_interpretation` (текст показанного объяснения), `llm_call_id`.
- **`llm.called`** (интерпретатор):
  - `purpose: "answer_interpretation"` (единственный purpose на момент iter-4);
  - `idempotency_key = llm.called:${session_id}:${question_id}:interpret`;
  - `prompt_version: "cognitive-interpret-answer@v5"`.
- **`answer.interpreted`** (новый, ADR 002):
  - causation — `event_id` соответствующего `answer.given`;
  - correlation — `session_id`;
  - `idempotency_key = answer.interpreted:${session_id}:${question_id}`;
  - payload: `session_id`, `question_id`, `axis`, `coordinate`, `llm_call_id`, `interpretation_text`.
  - **INV-10:** записывается ДО следующего `question.asked`.
- **`card.computed`** (после 12/12):
  - causation — `event_id` последнего `protocol.coordinate_assigned` (Я3);
  - `idempotency_key = card.computed:${session_id}:CognitiveIdentityMap`;
  - payload: `card_type`, `confidence`, `confidence_resolution` (опц.), `confidence_message` (опц.), `input_answer_ids`, `version`, `protocol_version` (`"v1"`), `coordinates {goal, modality, anchor}`, `matched_types[]` (1–3 типа из таблицы §4.1; пусто, если `confidence < CARD_CONFIDENCE_THRESHOLD`), `synthetic_drawing`, `core_unformed`.

---

## Каталог `event_type`

| type | Триггер | payload (поля) | causation / примечание |
|------|---------|----------------|------------------------|
| **user.started** | Первый вход /start в MAX | max_user_id, locale, referral_source | — |
| **session.opened** | Бот открыл сессию | session_id, layer, question_count_plan; iter-2: max_user_id, опц. opening_message_mid | после user.started или логики возврата |
| **question.asked** | Бот отправил вопрос | session_id, question_id, question_text, layer, llm_call_id; iter-2: max_user_id | iter-4 — берётся из очереди протокола методики |
| **answer.given** | Пользователь ответил | session_id, question_id, answer_value, answer_type; iter-2: max_user_id, max_update_id | **неизменяем**; causation для protocol.coordinate_assigned и answer.interpreted |
| **protocol.coordinate_assigned** | Mapper присвоил координату по протокольному ответу | answer_id, user_id, card_type, axis, coordinate, source_question_id, llm_interpretation, llm_call_id | iter-4; одна координата на ответ; ADR 002 |
| **answer.interpreted** | LLM-интерпретатор показал пользователю объяснение | session_id, question_id, axis, coordinate, llm_call_id, interpretation_text | iter-4; ДО следующего question.asked (INV-10); ADR 002 |
| **llm.called** | Вызов Claude/OpenAI | session_id, model, prompt_version, input_hash, latency_ms, purpose | до отправки сообщения (INV-06); `purpose=answer_interpretation` |
| **card.computed** | aeon_engine собрал карту по протоколу методики | card_type, confidence, confidence_resolution, confidence_message, input_answer_ids, version, protocol_version, coordinates, matched_types, synthetic_drawing, core_unformed | после 12/12; правило — единственный источник истины (ADR 002) |
| **session.completed** | Сессия завершена | session_id, duration_sec, answers_count, layers_covered | → запись в Book of Consciousness |
| **profile.built** | Профиль пересобран из событий | profile_version, cards_included, glyph_id | read model |
| **safety.triggered** | Gate 1/2 / кризис | session_id, trigger_category, action_taken | **без** сырого текста пользователя |
| **session.abandoned** | Истёк SESSION_IDLE_TIMEOUT | session_id, last_answer_at, answers_count | статус сессии → abandoned |

**Удалён ADR 002:** `card_signal.received` (заменён на `protocol.coordinate_assigned`).

---

## Будущее (QIP / монетизация)

Типы вида `qip.*` / `layer_unlock.*` — зафиксировать здесь и в `vibepp.yaml` при подключении биллинга (SPEC Блок 9).
