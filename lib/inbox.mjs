const encoder = new TextEncoder();
const COOKIE = 'halovera_inbox';

async function digest(key, value) {
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function credentialsReady(env) {
  return typeof env.INBOX_ADMIN_PASSWORD === 'string' && env.INBOX_ADMIN_PASSWORD.length >= 24 &&
    typeof env.INBOX_SESSION_SECRET === 'string' && env.INBOX_SESSION_SECRET.length >= 32;
}
export async function passwordIsValid(candidate, env) {
  if (!credentialsReady(env) || typeof candidate !== 'string') return false;
  return same(await digest(env.INBOX_SESSION_SECRET, candidate), await digest(env.INBOX_SESSION_SECRET, env.INBOX_ADMIN_PASSWORD));
}
export async function sessionCookie(env) {
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const signature = await digest(env.INBOX_SESSION_SECRET, `inbox:${expiry}`);
  return `${COOKIE}=${expiry}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
}
export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
export async function isAuthorized(request, env) {
  if (!credentialsReady(env)) return false;
  const value = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [expiryText, signature] = value.split('.');
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now() || expiry > Date.now() + 7 * 24 * 60 * 60 * 1000 || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  return same(await digest(env.INBOX_SESSION_SECRET, `inbox:${expiry}`), signature);
}
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return Boolean(origin && new URL(origin).origin === new URL(request.url).origin);
}
export async function inboxTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    phone TEXT PRIMARY KEY, display_name TEXT, mode TEXT NOT NULL DEFAULT 'bot',
    last_message_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id TEXT PRIMARY KEY, phone TEXT NOT NULL, direction TEXT NOT NULL,
    body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS whatsapp_messages_phone_time ON whatsapp_messages(phone, created_at DESC)').run();
}
export async function storeIncoming(db, payload, phoneNumberId) {
  await inboxTables(db);
  const accepted = [];
  if (payload?.object !== 'whatsapp_business_account') return accepted;
  for (const entry of payload.entry || []) for (const change of entry.changes || []) {
    const value = change.value;
    if (String(value?.metadata?.phone_number_id) !== String(phoneNumberId)) continue;
    for (const message of value.messages || []) {
      if (!message.id || !/^\d{6,20}$/.test(String(message.from || ''))) continue;
      const body = message.type === 'text' ? String(message.text?.body || '') : `[رسالة ${message.type || 'غير نصية'} — عرض الوسائط غير متاح هنا بعد]`;
      const name = (value.contacts || []).find(contact => contact.wa_id === message.from)?.profile?.name?.slice(0, 120) || null;
      await db.prepare(`INSERT INTO whatsapp_conversations(phone, display_name, last_message_at) VALUES(?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(phone) DO UPDATE SET display_name=COALESCE(excluded.display_name, display_name), last_message_at=CURRENT_TIMESTAMP`).bind(message.from, name).run();
      const result = await db.prepare(`INSERT OR IGNORE INTO whatsapp_messages(id, phone, direction, body) VALUES(?, ?, 'in', ?)`).bind(message.id, message.from, body.slice(0, 4096)).run();
      if (result.meta?.changes) accepted.push(message);
    }
  }
  return accepted;
}
export async function sendMessage(env, phone, body, send = fetch) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) throw new Error('WhatsApp credentials missing');
  const version = env.WHATSAPP_GRAPH_VERSION || 'v23.0';
  if (!/^v\d+\.\d+$/.test(version)) throw new Error('Invalid Graph API version');
  const response = await send(`https://graph.facebook.com/${version}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phone,
      type: 'text', text: { preview_url: false, body } }), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Meta returned ${response.status}`);
  const data = await response.json();
  if (!data.messages?.[0]?.id) throw new Error('Meta returned no message id');
  return data.messages[0].id;
}
