# Каталог событий — ÆON Map MAX Bot

**Источник:** `aeon-max-bot.vibepp.yaml` → `events`.  
**Контракт:** обязательные поля — `event_id`, `event_type`, `occurred_at`, `actor`, `subject`, `payload`, `idempotency_key`, `schema_version`; опционально `causation_id`, `correlation_id`.

**Правило хранилища:** только `INSERT` в таблицу событий (см. `rules.hard`).

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
