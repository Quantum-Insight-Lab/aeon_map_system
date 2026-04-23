# Инварианты — ÆON Map MAX Bot

**Источник:** `aeon-max-bot.vibepp.yaml` → `invariants`.  
**Тесты:** property-based — `Vitest` + `fast-check` в `tests/invariants/` (появляется с кодом).

| ID | Правило | Обеспечение |
|----|---------|-------------|
| **INV-01** | Session имеет ровно один статус из {active, completed, abandoned, paused}. | domain validator + DB constraint |
| **INV-02** | Answer неизменяем после записи; редактирование — только новая сессия. | append-only, no UPDATE/DELETE в ORM |
| **INV-03** | Card назначается только при confidence ≥ CARD_CONFIDENCE_THRESHOLD (0.72). | Stability Engine, не LLM |
| **INV-04** | Card не в двух взаимоисключающих состояниях без явного флага (напр. «синтетик»). | domain validator перед записью Card |
| **INV-05** | Следующий слой не открыт, пока у предыдущего нет ≥ MIN_ANSWERS_PER_LAYER ответов. | Stability Engine |
| **INV-06** | LlmCall сохраняется до отправки ответа пользователю, не после. | транзакция: write LlmCall → send message |
| **INV-07** | Одно сообщение пользователя → не более одного Answer event (идемпотентность). | idempotency_key = max_update_id |
| **INV-08** | AeonProfile пересобирается только из событий, не редактируется вручную. | profile builder только из event store |
| **INV-09** | Card не назначается, пока суммарный вес CardSignal по card_type < MIN_AGGREGATE_SIGNAL_WEIGHT_FOR_CARD. | Stability Engine + агрегация CardSignal |
| **INV-S01** | Кризисные маркеры → стоп профилирования, горячая линия. | Gate 1 до дорогих вызовов; Gate 2 в system prompt |
| **INV-S02** | Нет мед/юр/фин советов — только рефлексия и инсайты. | system prompt + content filter |

**Hard rules (репозиторий):** см. `vibepp.yaml` → `rules.hard`.
