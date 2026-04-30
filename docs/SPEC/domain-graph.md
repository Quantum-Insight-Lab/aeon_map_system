# Граф домена — ÆON Map MAX Bot

**Источник правды (машинный):** `aeon-max-bot.vibepp.yaml` → `domain_graph`.  
**Формат рёбер:** ниже — в нотации «A [глагол] B», как в `CURSOR_PROMPT_MAX_BOT.md`.  
**ADR:** обновлено по **ADR 002** — `CardSignal` → `CoordinateMatch`; ребро `Answer contributes_signal_to Card` заменено на `Answer maps_to CoordinateMatch`.

---

## Сущности (кратко)

| Сущность | Назначение |
|----------|------------|
| **User** | Пользователь MAX; идентификация через `max_user_id`. |
| **Session** | Диалоговая сессия; слой, статус, временные границы. |
| **Answer** | Неизменяемый ответ пользователя (append-only). |
| **CoordinateMatch** | Зафиксированная координата по оси протокола методики (`card_type`, `axis`, `coordinate`, `source_question_id`, `llm_interpretation_ref`, `created_at`). Append-only. Заменяет `CardSignal` из пороговой модели (ADR 002). |
| **Card** | Вычисленная карта с `confidence`, версией и `protocol_version`. |
| **AeonProfile** | Read model профиля; пересборка из событий. |
| **Glyph** | Визуальный символ (DALL·E → `image_url`). |
| **BookOfConsciousness** | Таймлайн завершённых сессий (ADR 002). |
| **LlmCall** | Запись вызова LLM для воспроизводимости (`purpose=answer_interpretation`). |

Типы карт (`card_type`) — полный перечень в `vibepp.yaml` под `Card.card_types`.

---

## Рёбра: «A [глагол] B»

- User **имеет много** Session.
- User **имеет один** AeonProfile.
- User **имеет один** BookOfConsciousness.
- User **имеет много** Card.
- User **имеет много** Glyph.
- User **имеет много** CoordinateMatch.
- Session **содержит много** Answer.
- Session **принадлежит** Layer (слой ÆON Map).
- Answer **маппится в** CoordinateMatch *(детерминированный mapper по таблицам методики)*.
- CoordinateMatch **описывает** Card по `(card_type, axis)` *(собирается в карту по таблице соответствий методики)*.
- Card **входит в** AeonProfile.
- Session **порождает** LlmCall.
- LlmCall **производит** интерпретацию ответа *(показ пользователю; для следующего вопроса используется очередь протокола)*.
- AeonProfile **связан с** Glyph *(генерация/привязка)*.
- BookOfConsciousness **фиксирует** Session.completed *(ADR 002)*.

---

## ADR 002 — отличия от исходного графа

- Удалена сущность **`CardSignal`** и связанные рёбра «копилки веса».
- Удалено ребро `Answer contributes_signal_to Card (cross-layer)` — сквозной signal routing временно исключён.
- Один `answer.given` causation для **одной** `protocol.coordinate_assigned` (по своей оси протокола), а также для **одной** `answer.interpreted` (объяснение LLM).
