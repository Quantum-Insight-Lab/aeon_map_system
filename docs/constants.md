# Константы — ÆON Map MAX Bot

**Источник:** `aeon-max-bot.vibepp.yaml` → `constants`.  
**Правило:** в коде — из конфига/ENV, не захардкоженные магические числа; каждая константа имеет «карточку» здесь.

| Ключ | Значение | Зачем | Ломается без | Калибровка |
|------|----------|--------|--------------|------------|
| MIN_AGGREGATE_SIGNAL_WEIGHT_FOR_CARD | 0.5 | Черновой порог суммарного веса сигналов (0–1) перед `card.computed`. | Карты слишком рано или сигналы игнорируются. | A/B retention и качество профиля |
| CARD_CONFIDENCE_THRESHOLD | 0.72 | Ниже — карта ненадёжна. | Профиль на слабом сигнале. | A/B retention, feedback |
| MIN_ANSWERS_PER_LAYER | 4 | Минимум ответов на слой перед unlock следующего. | Поверхностный профиль. | completion rate по слоям |
| MAX_QUESTIONS_PER_SESSION | 12 | Лимит вопросов за сессию. | Усталость или мало данных. | session_completion_rate |
| SESSION_IDLE_TIMEOUT_MIN | 30 | Молчание → abandoned. | Ghost sessions, утечки в Redis. | медиана времени между ответами |
| LLM_QUESTION_TEMP | 0.7 | Температура вопросов LLM. | Слишком сухо или хаос. | blind A/B операторов |
| DAILY_SESSION_LIMIT | 3 | Лимит сессий в день на пользователя. | Злоупотребления, cost. | p99 сессий/день |
| MAX_BOT_REPLY_TIMEOUT_SEC | 8 | Целевой UX-лимит ответа в MAX. | Повторы, дропы. | p95 LLM + overhead |

При добавлении константы — обновить **и** этот файл, **и** `vibepp.yaml`.
