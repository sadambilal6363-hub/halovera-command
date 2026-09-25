import { getCloudflareContext } from '@opennextjs/cloudflare';
import { handleIncoming, incomingTextMessages, validMetaSignature } from '../../../../lib/whatsapp.mjs';
import { storeIncoming } from '../../../../lib/inbox.mjs';

export const dynamic = 'force-dynamic';
async function bindings() { return (await getCloudflareContext({ async: true })).env; }
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const env = await bindings();
  if (params.get('hub.mode') === 'subscribe' && env.WHATSAPP_VERIFY_TOKEN &&
      params.get('hub.verify_token') === env.WHATSAPP_VERIFY_TOKEN && params.has('hub.challenge')) {
    return new Response(params.get('hub.challenge'), { status: 200 });
  }
  return new Response('Verification failed', { status: 403 });
}
export async function POST(request) {
  const env = await bindings();
  const raw = await request.text();
  if (!(await validMetaSignature(raw, request.headers.get('x-hub-signature-256'), env.META_APP_SECRET))) {
    return new Response('Invalid signature', { status: 403 });
  }
  let payload;
  try { payload = JSON.parse(raw); }
  catch { return new Response('Invalid JSON', { status: 400 }); }
  if (!env.DB || !env.WHATSAPP_PHONE_NUMBER_ID) return new Response('Storage not configured', { status: 503 });
  try {
    await storeIncoming(env.DB, payload, env.WHATSAPP_PHONE_NUMBER_ID);
    if (env.WHATSAPP_AUTO_REPLY_ENABLED === 'true') {
      const enabled = new Set();
      for (const message of incomingTextMessages(payload, env.WHATSAPP_PHONE_NUMBER_ID)) {
        const mode = (await env.DB.prepare('SELECT mode FROM whatsapp_conversations WHERE phone = ?').bind(message.from).first())?.mode;
        if (mode === 'bot') enabled.add(message.from);
      }
      const filtered = structuredClone(payload);
      for (const entry of filtered.entry || []) for (const change of entry.changes || []) {
        change.value.messages = (change.value.messages || []).filter(m => enabled.has(m.from));
      }
      await handleIncoming(filtered, env);
    }
    return new Response('OK');
  } catch (error) {
    console.error('WhatsApp processing failed', error);
    return new Response('Retry', { status: 503 });
  }
}
