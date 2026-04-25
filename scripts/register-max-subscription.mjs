/**
 * Регистрация webhook в MAX (POST /subscriptions) или просмотр (GET /subscriptions).
 * @see https://dev.max.ru/docs-api/methods/POST/subscriptions
 *
 * Usage:
 *   node --env-file=.env scripts/register-max-subscription.mjs
 *   node --env-file=.env scripts/register-max-subscription.mjs --status
 */

const base = (process.env.MAX_API_BASE_URL ?? 'https://platform-api.max.ru').replace(/\/$/, '');
const token = process.env.MAX_BOT_TOKEN ?? '';
const publicUrl = (process.env.MAX_WEBHOOK_PUBLIC_URL ?? '').trim();
const secret = (process.env.MAX_WEBHOOK_SECRET ?? '').trim();

const isStatus = process.argv.includes('--status');

function requireToken() {
  if (!token) {
    console.error('Нужен MAX_BOT_TOKEN в .env');
    process.exit(1);
  }
  return { Authorization: token };
}

async function getStatus() {
  const res = await fetch(`${base}/subscriptions`, {
    method: 'GET',
    headers: requireToken(),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`GET /subscriptions — ${res.status}: ${text}`);
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.log(text);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

async function postSubscription() {
  const auth = requireToken();
  if (!publicUrl) {
    console.error('Нужен MAX_WEBHOOK_PUBLIC_URL в .env (полный https URL, например https://....ngrok-free.app/webhook)');
    process.exit(1);
  }
  if (!publicUrl.startsWith('https://')) {
    console.error('MAX_WEBHOOK_PUBLIC_URL должен начинаться с https://');
    process.exit(1);
  }
  if (!/\/webhook\/?$/.test(publicUrl)) {
    console.warn('Подсказка: в этом репо обработчик — POST /webhook; проверь путь в URL.');
  }

  const body = {
    url: publicUrl,
    update_types: ['message_created', 'bot_started'],
  };
  if (secret) {
    if (!/^[a-zA-Z0-9_-]{5,256}$/.test(secret)) {
      console.error(
        'MAX_WEBHOOK_SECRET по правилам MAX: только A-Z, a-z, 0-9, _, -; длина 5…256. Исправь .env',
      );
      process.exit(1);
    }
    body.secret = secret;
  } else {
    console.warn('MAX_WEBHOOK_SECRET пуст — вебхук без проверки заголовка (нежелательно в проде).');
  }

  const res = await fetch(`${base}/subscriptions`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`POST /subscriptions — ${res.status}: ${text}`);
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.log('OK', text);
    return;
  }
  console.log('Подписка обновлена:', JSON.stringify(data, null, 2));
}

if (isStatus) {
  await getStatus();
} else {
  await postSubscription();
}
