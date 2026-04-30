import { describe, expect, it } from 'vitest';
import { protocolBlockClosure, protocolQuestionIndex } from '../src/protocols/cognitive_v1/queue.js';

describe('protocol queue', () => {
  it('protocolQuestionIndex: порядок 12 вопросов', () => {
    expect(protocolQuestionIndex('core:protocol:goal:1')).toBe(0);
    expect(protocolQuestionIndex('core:protocol:goal:4')).toBe(3);
    expect(protocolQuestionIndex('core:protocol:modality:5')).toBe(8);
    expect(protocolQuestionIndex('core:protocol:anchor:3')).toBe(11);
  });

  it('protocolBlockClosure: только концы блоков Ц/М/Я', () => {
    expect(protocolBlockClosure('core:protocol:goal:3')).toBe(null);
    expect(protocolBlockClosure('core:protocol:goal:4')).toBe('goal');
    expect(protocolBlockClosure('core:protocol:modality:5')).toBe('modality');
    expect(protocolBlockClosure('core:protocol:anchor:3')).toBe('anchor');
    expect(protocolBlockClosure('unknown')).toBe(null);
  });
});
