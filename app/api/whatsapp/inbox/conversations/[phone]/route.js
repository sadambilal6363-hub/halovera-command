import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isAuthorized, sameOrigin, inboxTables, sendMessage } from '../../../../../../lib/inbox.mjs';
export const dynamic = 'force-dynamic';
const response = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function context(request, params) {
  const { env } = await getCloudflareContext({ async: true });
  if (!(await isAuthorized(request, env))) return { error: response({ error: 'Unauthorized' }, 401) };
  const { phone } = await params;
  if (!/^\d{6,20}$/.test(phone)) return { error: response({ error: 'Invalid phone' }, 400) };
  await inboxTables(env.DB);
  const conversation = await env.DB.prepare('SELECT * FROM whatsapp_conversations WHERE phone=?').bind(phone).first();
  if (!conversation) return { error: response({ error: 'Unknown conversation' }, 404) };
  return { env, phone, conversation };
}
export async function GET(request, { params }) {
  try {
    const data = await context(request, params); if (data.error) return data.error;
    const { results } = await data.env.DB.prepare('SELECT id,direction,body,created_at FROM whatsapp_messages WHERE phone=? ORDER BY created_at DESC, rowid DESC LIMIT 100').bind(data.phone).all();
    let suggestion = null;
    try { suggestion = await data.env.DB.prepare('SELECT category,summary,draft,is_lead,needs_human,created_at FROM whatsapp_ai_suggestions WHERE phone=? ORDER BY created_at DESC, rowid DESC LIMIT 1').bind(data.phone).first(); } catch { /* Optional AI table is not created until enabled. */ }
    return response({ conversation: data.conversation, messages: (results || []).reverse(), suggestion });
  } catch { return response({ error: 'Inbox unavailable' }, 503); }
}
export async function POST(request, { params }) {
  if (!sameOrigin(request)) return response({ error: 'Forbidden' }, 403);
  let body;
  try { body = await request.json(); } catch { return response({ error: 'Invalid JSON' }, 400); }
  try {
    const data = await context(request, params); if (data.error) return data.error;
    if (body.action === 'mode' && ['bot', 'human'].includes(body.mode)) {
      await data.env.DB.prepare('UPDATE whatsapp_conversations SET mode=? WHERE phone=?').bind(body.mode, data.phone).run();
      return response({ ok: true, mode: body.mode });
    }
    if (body.action !== 'send' || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4096) return response({ error: 'Invalid message' }, 400);
    const text = body.text.trim();
    // Hand off to a human before sending, so subsequent inbound messages are not auto-answered.
    await data.env.DB.prepare("UPDATE whatsapp_conversations SET mode='human' WHERE phone=?").bind(data.phone).run();
    try {
      const id = await sendMessage(data.env, data.phone, text);
      await data.env.DB.prepare("INSERT OR IGNORE INTO whatsapp_messages(id,phone,direction,body) VALUES(?,?,'out',?)").bind(id, data.phone, text).run();
      await data.env.DB.prepare('UPDATE whatsapp_conversations SET last_message_at=CURRENT_TIMESTAMP WHERE phone=?').bind(data.phone).run();
      return response({ ok: true, id });
    } catch { return response({ error: 'Message was not confirmed by Meta; check the conversation before retrying' }, 502); }
  } catch { return response({ error: 'Inbox unavailable' }, 503); }
}
