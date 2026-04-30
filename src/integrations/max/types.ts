/** Сырой Update с webhook MAX (см. dev.max.ru docs-api/objects/Update и реальные payload). */
export type MaxUpdate =
  | MessageCreatedUpdate
  | BotStartedUpdate
  | MessageCallbackUpdate
  | UnknownUpdate;

export type UnknownUpdate = {
  update_type: string;
  timestamp: number;
  /** Если платформа MAX начнёт отдавать стабильный id update в корне — приоритет для max_update_id */
  update_id?: string | number;
  message?: MaxMessage;
  user_locale?: string | null;
};

/** Нажатие inline-кнопки (callback). */
export interface MessageCallbackUpdate {
  update_type: 'message_callback';
  timestamp: number;
  update_id?: string | number;
  callback: {
    callback_id: string;
    payload?: string;
    user?: { user_id?: number; name?: string; is_bot?: boolean };
  };
  message?: MaxMessage;
  user_locale?: string | null;
}

export interface MessageCreatedUpdate {
  update_type: 'message_created';
  timestamp: number;
  update_id?: string | number;
  message: MaxMessage;
  user_locale?: string | null;
}

export interface BotStartedUpdate {
  update_type: 'bot_started';
  timestamp: number;
  update_id?: string | number;
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
