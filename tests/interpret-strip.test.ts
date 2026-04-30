import { describe, expect, it } from 'vitest';
import { stripEchoedNextProtocolQuestion } from '../src/dialog/deliver-protocol-step.js';

describe('stripEchoedNextProtocolQuestion', () => {
  it('не меняет текст без маркера следующего вопроса', () => {
    const s = 'Такой ответ хорошо ложится на «понимание».\n\nДальше уточним вторую полярность цели.';
    expect(stripEchoedNextProtocolQuestion(s)).toBe(s.replace(/\r\n/g, '\n').trim());
  });

  it('отрезает хвост после «Вопрос N из 12»', () => {
    const head =
      'Твой выбор отражает тягусценарию возможности.\n\nДальше — второй шаг блока целей.';
    const junk =
      '\n\n**Вопрос 2 из 12, блок Ц2.**\n\nТы только что прочитал длинный текст.\n\n1. первый вариант';
    expect(stripEchoedNextProtocolQuestion(head + junk)).toBe(head);
  });

  it('отрезает без markdown-жирного', () => {
    const head = 'Краткий комментарий.';
    const junk = '\n\nВопрос 3 из 12 — продолжение.';
    expect(stripEchoedNextProtocolQuestion(head + junk)).toBe(head);
  });
});
