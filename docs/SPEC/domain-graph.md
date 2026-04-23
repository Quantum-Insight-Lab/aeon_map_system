# Граф домена — ÆON Map MAX Bot

**Источник правды (машинный):** `aeon-max-bot.vibepp.yaml` → `domain_graph`.  
**Формат рёбер:** ниже — в нотации «A [глагол] B», как в `CURSOR_PROMPT_MAX_BOT.md`.

---

## Сущности (кратко)

| Сущность | Назначение |
|----------|------------|
| **User** | Пользователь MAX; идентификация через `max_user_id`. |
| **Session** | Диалоговая сессия; слой, статус, временные границы. |
| **Answer** | Неизменяемый ответ пользователя (append-only). |
| **CardSignal** | Вклад ответа в «копилку» целевой карты (сквозной routing). |
| **Card** | Вычисленная карта с `confidence` и версией. |
| **AeonProfile** | Read model профиля; пересборка из событий. |
| **Glyph** | Визуальный символ (DALL·E → `image_url`). |
| **BookOfConsciousness** | Таймлайн завершённых сессий / трансформаций. |
| **LlmCall** | Запись вызова LLM для воспроизводимости. |

Типы карт (`card_type`) — полный перечень в `vibepp.yaml` под `Card.card_types`.

---

## Рёбра: «A [глагол] B»

- User **имеет много** Session.
- User **имеет один** AeonProfile.
- User **имеет один** BookOfConsciousness.
- User **имеет много** Card.
- User **имеет много** Glyph.
- User **имеет много** CardSignal.
- Session **содержит много** Answer.
- Session **принадлежит** Layer (слой ÆON Map).
- Answer **вкладывается в** Card *(через event-проекцию)*.
- Answer **направляет сигнал в** Card *(cross-layer через CardSignal)*.
- CardSignal **агрегируется в** готовность Card *(перед `card.computed`)*.
- Card **входит в** AeonProfile.
- Session **порождает** LlmCall.
- LlmCall **порождает** next_question.
- AeonProfile **связан с** Glyph *(генерация/привязка)*.
- BookOfConsciousness **фиксирует** Session.completed.

---

## Расширение PDA (SPEC Блок 2)

Один `answer.given` может быть **causation** для нескольких **`card_signal.received`** — см. `events.md`.
