# SPEC — краткое саммари (ревью перед Этапом 2)

**Продукт:** MAX-бот ÆON Map — протокольный диалог по методикам карт, профиль как read model над event log, без онбординга «ÆON» для пользователя (живой разговор + зеркало).

**ЦА MVP:** только primary (люди в точке выбора, практики развития, лидеры). **JTBD:** «не понимаю, в чём моя реальная сила». **Успех:** D7 ≥ 25%; лучше возврат / шеринг PNG / подтверждение инсайта, чем красивые фразы.

**Слои MVP:** I Core (CognitiveIdentityMap по протоколу `Cognitive_Identity_Map_v1.md`, 12 вопросов), II/IV — ждут собственных методик. BehavioralPatternMap перенесена из MVP-Core в iter-5/v1. Сквозной signal routing временно отключён (ADR 002).

**Диалог:** строго 12 вопросов протокола (4×Ц + 5×М + 3×Я); очередь детерминирована методикой; LLM на каждом ответе показывает интерпретацию и в конце сообщения задаёт следующий вопрос; кнопки по числу вариантов методики (8/2/…); персона ÆON.

**LLM:** Claude (`cognitive-interpret-answer@v1`) + OpenAI fallback + DALL·E глиф; mapper детерминированный (без LLM) → `protocol.coordinate_assigned` → LLM-интерпретатор → `answer.interpreted` → следующий вопрос из очереди протокола. Финал: правило-маппер — основной источник истины; LLM-расхождение — в Book of Consciousness.

**Safety:** Gate 1 в stability/; Gate 2 в system prompt.

**Вывод:** два сообщения в конце (пауза 2–3 с); push через 24 ч персонализированно; шеринг PNG (sharp+resvg); только чат в MVP.

**MAX:** webhook, HTTPS, бот создан; TS/Node 22/Fastify; один узел ~до ~5k MAU, без K8s в MVP.

**Приватность:** GDPR-like, PII отдельно, данные в РФ, автоматизированное удаление.

**Монетизация:** freemium + QIP; платные слои позже в event-контуре.

**Разработка:** solo + Cursor; `feat/iter-N`; `docs/*` + `vibepp.yaml`; валидатор `scripts/check-spec.mjs`.

**Следующий шаг:** Этап 2 — **Iteration 4** (см. ADR 002 и `GITHUB_ISSUES.md` Issue 5), ветка `feat/iter-4`.
