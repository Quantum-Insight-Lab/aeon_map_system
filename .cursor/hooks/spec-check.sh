#!/usr/bin/env bash
# Хук перед git commit / git push: запускает валидатор SPEC.
# Возвращает permission=ask при предупреждениях/ошибках, чтобы агент остановился и спросил.
set -u
input=$(cat)

if ! command -v node >/dev/null 2>&1; then
  echo '{ "permission": "allow" }'
  exit 0
fi

out=$(node scripts/check-spec.mjs 2>&1)
code=$?

if [ $code -ne 0 ]; then
  # JSON с экранированием переносов
  safe=$(printf '%s' "$out" | sed 's/"/\\"/g' | tr '\n' ' ')
  printf '{ "permission": "ask", "user_message": "check-spec упал — подтвердите перед %s. Вывод: %s", "agent_message": "Валидатор SPEC/vibepp вернул ошибку. Прочти вывод и исправь перед коммитом." }' "git" "$safe"
  exit 0
fi

if echo "$out" | grep -qi "WARN:"; then
  safe=$(printf '%s' "$out" | sed 's/"/\\"/g' | tr '\n' ' ')
  printf '{ "permission": "ask", "user_message": "check-spec: есть предупреждения. Продолжить? %s", "agent_message": "Валидатор выдал предупреждения. Просмотри и подтверди, что это ожидаемо." }' "$safe"
  exit 0
fi

gp=$(node scripts/check-git-policy.mjs 2>&1)
gcode=$?
if [ $gcode -ne 0 ]; then
  safe=$(printf '%s' "$gp" | sed 's/"/\\"/g' | tr '\n' ' ')
  printf '{ "permission": "ask", "user_message": "check-git-policy (strict?): %s", "agent_message": "Политика веток GIT_STRATEGY: см. вывод. Исправь ветку или AEON_GIT_POLICY." }' "$safe"
  exit 0
fi
if echo "$gp" | grep -qi "git-policy"; then
  safe=$(printf '%s' "$gp" | sed 's/"/\\"/g' | tr '\n' ' ')
  printf '{ "permission": "ask", "user_message": "git-policy: %s Продолжить коммит?", "agent_message": "Коммит кода с main или нестандартная ветка — подтверди или переключись на feat/iter-N." }' "$safe"
  exit 0
fi

echo '{ "permission": "allow" }'
exit 0
