# Наблюдаемость — ÆON Map MAX Bot

**Источник:** `aeon-max-bot.vibepp.yaml` → `observability`.  
**Цель (PDA):** видимость устойчивости системы — time-to-clarity, здоровье домена, качество LLM, надёжность, safety.

---

## Дашборды и метрики

### 1. User clarity
- `time_to_clarity_sec` — медиана от /start до **profile.built**
- `session_completion_rate` — доля completed
- `layer_dropoff_rate` — где бросают

### 2. Domain health
- `invariant_violations_total` — **должно быть ~0**
- `card_rejection_rate` — отклонённые карты (confidence < threshold)
- `answer_conflict_rate` — противоречия в ответах

### 3. LLM quality
- `llm_latency_p95_ms`
- `llm_timeout_rate`
- `prompt_version_distribution`

### 4. Reliability
- `webhook_duplicate_rate`
- `error_rate_5xx`
- `queue_lag_sec` (если есть очередь)

### 5. Safety
- `safety_trigger_rate`
- `crisis_category_distribution`

---

## Алерты (из vibepp)

| Условие | Действие |
|---------|----------|
| invariant_violations_total > 0 за 5 мин | Critical |
| session_completion_rate < 0.40 за 1 ч | Warning |
| llm_latency_p95_ms > 6000 за 5 мин | Warning |
| safety_trigger_rate > 0.05 за 1 ч | Critical |

**Итерация 6** roadmap: Grafana (или аналог), все метрики и тестовый триггер алерта.
