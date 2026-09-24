import { getCloudflareContext } from '@opennextjs/cloudflare';
import { credentialsReady, passwordIsValid, sessionCookie, clearSessionCookie, sameOrigin } from '../../../../../lib/inbox.mjs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, 403);
  const { env } = await getCloudflareContext({ async: true });
  if (!credentialsReady(env) || !env.DB) return json({ error: 'Inbox is not configured' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid input' }, 400); }
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const identifier = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const key = Array.from(new Uint8Array(identifier), x => x.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS whatsapp_login_attempts (client TEXT PRIMARY KEY, attempts INTEGER NOT NULL, updated_at INTEGER NOT NULL)').run();
  const current = await env.DB.prepare('SELECT attempts, updated_at FROM whatsapp_login_attempts WHERE client = ?').bind(key).first();
  if (current?.attempts >= 5 && Date.now() - current.updated_at < 15 * 60 * 1000) return json({ error: 'Try again later' }, 429);
  if (!(await passwordIsValid(body?.password, env))) {
    const attempts = current && Date.now() - current.updated_at < 15 * 60 * 1000 ? current.attempts + 1 : 1;
    await env.DB.prepare('INSERT INTO whatsapp_login_attempts(client, attempts, updated_at) VALUES(?,?,?) ON CONFLICT(client) DO UPDATE SET attempts=excluded.attempts, updated_at=excluded.updated_at').bind(key, attempts, Date.now()).run();
    return json({ error: 'Wrong password' }, 401);
  }
  await env.DB.prepare('DELETE FROM whatsapp_login_attempts WHERE client = ?').bind(key).run();
  const response = json({ ok: true }); response.headers.set('Set-Cookie', await sessionCookie(env)); return response;
}
export async function DELETE(request) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, 403);
  const response = json({ ok: true }); response.headers.set('Set-Cookie', clearSessionCookie()); return response;
}
