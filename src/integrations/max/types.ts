/** Сырой Update с webhook MAX (см. dev.max.ru docs-api/objects/Update и реальные payload). */
export type MaxUpdate = MessageCreatedUpdate | BotStartedUpdate | UnknownUpdate;

export type UnknownUpdate = {
  update_type: string;
  timestamp: number;
  message?: MaxMessage;
  user_locale?: string | null;
};

export interface MessageCreatedUpdate {
  update_type: 'message_created';
  timestamp: number;
  message: MaxMessage;
  user_locale?: string | null;
}

export interface BotStartedUpdate {
  update_type: 'bot_started';
  timestamp: number;
  chat_id: number;
  user: { user_id: number; name?: string; username?: string };
  payload?: string | null;
}

export interface MaxMessage {
  sender?: { user_id: number; is_bot?: boolean; name?: string };
  recipient?: { user_id?: number; chat_id?: number; chat_type?: string };
  timestamp: number;
  body?: { mid?: string; text?: string; seq?: number } | null;
}
