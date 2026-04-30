# Константы — ÆON Map MAX Bot

**Источник:** `aeon-max-bot.vibepp.yaml` → `constants`.  
**Правило:** в коде — из конфига/ENV, не захардкоженные магические числа.  
**ADR:** ADR 002 (+ правка 2026-04-30: снят `LLM_RULE_AGREEMENT_THRESHOLD`).

| Ключ | Значение | Зачем |
|------|----------|--------|
| CARD_CONFIDENCE_THRESHOLD | 0.5 | Ниже — в payload карты не показывается имя типа (только `confidence_message`). |
| CARD_CONFIDENCE_STRONG_THRESHOLD | 0.75 | Выше — пользователю отдаётся короткая строка без оговорок. |
| MAX_QUESTIONS_PER_SESSION | 12 | Длина протокола Cognitive v1 (4×Ц + 5×М + 3×Я). |
| COGNITIVE_PROTOCOL_VERSION | "v1" | Версия методики, по которой собрана карта (аудит/миграции). |
| SESSION_IDLE_TIMEOUT_MIN | 30 | Молчание → `session.abandoned`. |
| LLM_QUESTION_TEMP | 0.7 | Температура LLM-интерпретатора. |
| DAILY_SESSION_LIMIT | 3 | Лимит сессий/день/пользователь. |
| MAX_BOT_REPLY_TIMEOUT_SEC | 8 | Целевой UX-лимит ответа в MAX. |

**Удалены ADR 002:** `MIN_AGGREGATE_SIGNAL_WEIGHT_FOR_CARD`, `MIN_ANSWERS_PER_LAYER`, `LLM_RULE_AGREEMENT_THRESHOLD`.
