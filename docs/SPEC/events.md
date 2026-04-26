# Каталог событий — ÆON Map MAX Bot

**Источник:** `aeon-max-bot.vibepp.yaml` → `events`.  
**Контракт:** обязательные поля — `event_id`, `event_type`, `occurred_at`, `actor`, `subject`, `payload`, `idempotency_key`, `schema_version`; опционально `causation_id`, `correlation_id`.

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

---

## Каталог `event_type`

| type | Триггер | payload (поля) | causation / примечание |
|------|---------|----------------|------------------------|
| **user.started** | Первый вход /start в MAX | max_user_id, locale, referral_source | — |
| **session.opened** | Бот открыл сессию | session_id, layer, question_count_plan | после user.started или логики возврата |
| **question.asked** | Бот отправил вопрос | session_id, question_id, question_text, layer, llm_call_id | может следовать за llm.called |
| **answer.given** | Пользователь ответил | session_id, question_id, answer_value, answer_type | **неизменяем**; causation для card_signal.received |
| **card_signal.received** | Классификатор сигналов | answer_id, user_id, card_type, weight, source_layer | несколько на один answer.given |
| **llm.called** | Вызов Claude/OpenAI | session_id, model, prompt_version, input_hash, latency_ms | до отправки сообщения пользователю (INV-06) |
| **card.computed** | Stability Engine назначил карту | card_type, confidence, input_answer_ids, version | после порогов сигналов + confidence |
| **session.completed** | Сессия завершена | session_id, duration_sec, answers_count, layers_covered | → запись в Book of Consciousness |
| **profile.built** | Профиль пересобран из событий | profile_version, cards_included, glyph_id | read model |
| **safety.triggered** | Gate 1/2 / кризис | session_id, trigger_category, action_taken | **без** сырого текста пользователя |
| **session.abandoned** | Истёк SESSION_IDLE_TIMEOUT | session_id, last_answer_at, answers_count | статус сессии → abandoned |

---

## Будущее (QIP / монетизация)

Типы вида `qip.*` / `layer_unlock.*` — зафиксировать здесь и в `vibepp.yaml` при подключении биллинга (SPEC Блок 9).
