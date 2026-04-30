/**
 * Разбивает длинный текст карты на несколько сообщений MAX (лимит текста на сообщение не формализован в API — держим запас).
 * Стремимся резать перед разделом «7. Парадокс мыслителя», чтобы не рвать логику пополам случайно.
 */
export function splitCognitiveCardText(text: string, maxLen = 3800): string[] {
  const t = text.trim();
  if (t.length <= maxLen) return [t];

  const cutBeforeSec7 = /\n\n7\.\s+Парадокс мыслителя/;
  const m = cutBeforeSec7.exec(t);
  if (m != null && m.index >= 400 && m.index < t.length - 200) {
    const a = t.slice(0, m.index).trim();
    const b = t.slice(m.index).trim();
    if (a.length <= maxLen && b.length <= maxLen) return [a, b];
  }

  const half = Math.floor(t.length / 2);
  const breakPt = t.lastIndexOf('\n\n', half + 500);
  const idx = breakPt > 800 ? breakPt : half;
  return [t.slice(0, idx).trim(), t.slice(idx).trim()];
}
