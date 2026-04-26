import { describe, expect, it } from 'vitest';
import { resolveMaxUpdateId } from '../src/integrations/max/update-id.js';
import type { MaxUpdate } from '../src/integrations/max/types.js';

describe('resolveMaxUpdateId', () => {
  it('uses root update_id when present', () => {
    const u = {
      update_type: 'message_created',
      timestamp: 1,
      update_id: 'max-root-42',
      message: {
        timestamp: 2,
        body: { mid: 'mid-ignored' },
        sender: { user_id: 7 },
      },
    } as MaxUpdate;
    expect(resolveMaxUpdateId(u)).toBe('max-root-42');
  });

  it('uses message.body.mid for message_created', () => {
    const u: MaxUpdate = {
      update_type: 'message_created',
      timestamp: 100,
      message: {
        timestamp: 100,
        body: { mid: 'mid.abc', text: 'hi' },
        sender: { user_id: 99 },
      },
    };
    expect(resolveMaxUpdateId(u)).toBe('mid.abc');
  });

  it('fallback when mid missing', () => {
    const u: MaxUpdate = {
      update_type: 'message_created',
      timestamp: 50,
      message: {
        timestamp: 200,
        body: { text: 'no mid' },
        sender: { user_id: 5 },
      },
    };
    expect(resolveMaxUpdateId(u)).toBe('msg_fallback:200:5');
  });

  it('bot_started composite id', () => {
    const u: MaxUpdate = {
      update_type: 'bot_started',
      timestamp: 1_577_777_777_188,
      chat_id: 1,
      user: { user_id: 12345 },
    };
    expect(resolveMaxUpdateId(u)).toBe('bot_started:1577777777188:12345');
  });

  it('returns null for unknown shape', () => {
    const u: MaxUpdate = {
      update_type: 'message_callback',
      timestamp: 1,
    };
    expect(resolveMaxUpdateId(u)).toBeNull();
  });
});
