# Git-хуки и проверки — как пользоваться

В репозитории три уровня проверок:

| Что | Когда срабатывает | Назначение |
|-----|-------------------|------------|
| **`scripts/check-spec.mjs`** | Вручную, в pre-commit, в Cursor hook | SPEC ↔ vibepp ↔ GITHUB_ISSUES |
| **`scripts/check-git-policy.mjs`** | Вручную, в pre-commit, в Cursor hook | Ветка vs изменения кода (`GIT_STRATEGY.md`) |
| **`.cursor/hooks/spec-check.sh`** | Только в Cursor перед `git commit` / `git push` | Остановить агента и спросить пользователя |

---

## 1. Один раз: включить переносимые git-хуки

Git по умолчанию не смотрит в `.githooks/`. Выполни **из корня репозитория**:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

Проверка:

```bash
git config core.hooksPath
# должно вывести: .githooks
```

**Клонирование на другую машину:** снова выполни `git config core.hooksPath .githooks` (настройка локальная, в `.git/config`).

---

## 2. Ручной запуск (без коммита)

```bash
node scripts/check-spec.mjs
node scripts/check-git-policy.mjs
```

---

## 3. Режим политики веток: `AEON_GIT_POLICY`

| Значение | Поведение |
|----------|-----------|
| `warn` | **По умолчанию.** Коммит кода с `main` — только предупреждение в stderr, код 0. |
| `strict` | Коммит **кода** с `main` → **ошибка**, код 1 (коммит отменится). |
| `off` | `check-git-policy` ничего не проверяет. |

Пример для CI или жёсткого режима:

```bash
export AEON_GIT_POLICY=strict
git commit -m "..."
```

### Что считается «кодом»

Срабатывает политика, если в индексе есть пути вроде `src/`, `migrations/`, `tests/`, `package.json`, lock-файлы, `tsconfig*`, `vitest.config*`, `docker-compose*`, `Dockerfile`, `.githooks/`, `prompts/`, `.cursor/hooks/`, большинство файлов в `scripts/` (кроме самих `check-*.mjs`).

**Не считается кодом:** `docs/`, `pics/`, `.env.example` — такие коммиты на любой ветке не триггерят предупреждение о `main`.

---

## 4. Cursor hook (уже в репо)

Файл `.cursor/hooks.json` вызывает `.cursor/hooks/spec-check.sh` перед **`git commit`** и **`git push`**.

Сейчас скрипт запускает **`check-spec.mjs`** и при WARN/ERROR возвращает `permission: ask` — Cursor должен спросить подтверждение.

**Git-policy:** в `spec-check.sh` добавлен второй шаг — `check-git-policy.mjs`; при `strict` и коммите кода с `main` вывод попадёт в ask.

Перезагрузи Cursor после правок `hooks.json`. Смотри канал **Hooks** в выводе, если что-то не срабатывает.

---

## 5. Рекомендуемый рабочий цикл (итерации)

1. `git checkout -b feat/iter-0` (или текущая итерация).
2. Разработка, частые коммиты.
3. `git push -u origin feat/iter-0`, PR, merge в `main`, удалить ветку.
4. Следующая: `feat/iter-1`.

Если коммитишь **только доки** — можно остаться на `main`; хук не будет ругаться на политику веток.

---

## 6. Отключить всё временно

- Git: `git commit --no-verify` (обходит pre-commit).
- Cursor: подтвердить диалог hook или временно отключить hook в настройках.
- Политика веток: `AEON_GIT_POLICY=off node scripts/check-git-policy.mjs`

Подробнее о ветках и частоте коммитов — `GIT_STRATEGY.md`.
