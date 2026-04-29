# Инварианты — ÆON Map MAX Bot

**Источник:** `aeon-max-bot.vibepp.yaml` → `invariants`.  
**Тесты:** property-based — `Vitest` + `fast-check` в `tests/invariants/` (появляется с кодом).  
**ADR:** изменения от **ADR 002** (протокольный режим карт) — INV-05 переформулирован, INV-09 удалён, INV-10 добавлен.

| ID | Правило | Обеспечение |
|----|---------|-------------|
| **INV-01** | Session имеет ровно один статус из {active, completed, abandoned, paused}. | domain validator + DB constraint |
| **INV-02** | Answer неизменяем после записи; редактирование — только новая сессия. | append-only, no UPDATE/DELETE в ORM |
| **INV-03** | Card назначается только при confidence ≥ CARD_CONFIDENCE_THRESHOLD (0.72). Confidence в протокольном режиме = мера согласованности координат с типом из таблицы соответствий и/или согласия LLM с правилом (ADR 002). | aeon_engine, не LLM |
| **INV-04** | Card не в двух взаимоисключающих состояниях без явного флага «синтетический рисунок» (методика допускает множественные типы — §4.3 Cognitive_Identity_Map_v1.md). | domain validator перед записью Card; флаг рисунка — в payload card.computed |
| **INV-05** | Карта не вычисляется (нет `card.computed`) до завершения её протокола. Для Cognitive v1 — 12/12 ответов протокола. | aeon_engine — проверяет полноту `protocol.coordinate_assigned` по сессии |
| **INV-06** | LlmCall сохраняется до отправки ответа пользователю, не после. | транзакция: write LlmCall → send message |
| **INV-07** | Одно сообщение пользователя → не более одного Answer event (идемпотентность). | idempotency_key = max_update_id |
| **INV-08** | AeonProfile пересобирается только из событий, не редактируется вручную. | profile builder только из event store |
| **INV-10** | На каждом протокольном ответе `answer.interpreted` записывается ДО следующего `question.asked` (аналог INV-06 для шага LLM-интерпретации). | dialog engine: транзакция answer.interpreted → question.asked → send message |
| **INV-S01** | Кризисные маркеры → стоп профилирования, горячая линия. | Gate 1 до дорогих вызовов; Gate 2 в system prompt |
| **INV-S02** | Нет мед/юр/фин советов — только рефлексия и инсайты. | system prompt + content filter |

**Удалён ADR 002:** INV-09 («Card не назначается, пока суммарный вес CardSignal по card_type < MIN_AGGREGATE_SIGNAL_WEIGHT_FOR_CARD») — пороговая модель веса сигналов исключена вместе с константой.

**Hard rules (репозиторий):** см. `vibepp.yaml` → `rules.hard`.
