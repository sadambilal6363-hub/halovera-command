import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isAuthorized, inboxTables } from '../../../../../lib/inbox.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!(await isAuthorized(request, env))) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await inboxTables(env.DB);
    const { results } = await env.DB.prepare(`SELECT c.phone, c.display_name, c.mode, c.last_message_at,
      (SELECT body FROM whatsapp_messages m WHERE m.phone=c.phone ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) last_text
      FROM whatsapp_conversations c ORDER BY c.last_message_at DESC LIMIT 100`).all();
    return Response.json({ conversations: results || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Inbox unavailable' }, { status: 503 }); }
}
