import { describe, expect, it } from 'vitest';
import {
  buildProtocolAnswerPayload,
  parseProtocolAnswerPayload,
  PROTOCOL_ANSWER_PAYLOAD_PREFIX,
} from '../src/integrations/max/keyboard.js';

describe('protocol answer payload', () => {
  it('parse ↔ build для кириллицы и цифр', () => {
    const payload = buildProtocolAnswerPayload(10, 'Ж');
    expect(payload.startsWith(`${PROTOCOL_ANSWER_PAYLOAD_PREFIX}|`)).toBe(true);
    expect(parseProtocolAnswerPayload(payload)).toEqual({ questionIndex: 10, variantKey: 'Ж' });
    expect(parseProtocolAnswerPayload(buildProtocolAnswerPayload(3, '5'))).toEqual({
      questionIndex: 3,
      variantKey: '5',
    });
  });

  it('отвергает мусор', () => {
    expect(parseProtocolAnswerPayload('protocol_continue')).toBeNull();
    expect(parseProtocolAnswerPayload('pa|99|1')).toBeNull();
    expect(parseProtocolAnswerPayload('pa|')).toBeNull();
  });
});
