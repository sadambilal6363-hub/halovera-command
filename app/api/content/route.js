import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isAuthorized, sameOrigin } from '../../../lib/inbox.mjs';
import { contentTables, generateDraft, validDraft, kinds, channels } from '../../../lib/content.mjs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!(await isAuthorized(request, env))) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await contentTables(env.DB);
    const { results } = await env.DB.prepare('SELECT * FROM content_drafts ORDER BY created_at DESC LIMIT 100').all();
    return Response.json({ drafts: results || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'تعذر قراءة المسودات' }, { status: 503 }); }
}

export async function POST(request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!(await isAuthorized(request, env))) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: 'Origin mismatch' }, { status: 403 });
  try {
    const input = await request.json();
    if (!kinds.includes(input?.kind) || !channels.includes(input?.channel) ||
        typeof input.business_name !== 'string' || !input.business_name.trim() || input.business_name.length > 120 ||
        typeof input.brief !== 'string' || !input.brief.trim() || input.brief.length > 2500 ||
        !['generate', 'manual'].includes(input.action)) return Response.json({ error: 'بيانات غير صالحة' }, { status: 400 });
    const generated = input.action === 'generate' ? await generateDraft(input, env) : { title: input.title, body: input.body };
    const draft = { ...input, ...generated };
    if (!validDraft(draft)) return Response.json({ error: 'النص أو العنوان غير صالح' }, { status: 400 });
    await contentTables(env.DB);
    const id = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO content_drafts(id,kind,channel,business_name,brief,title,body)
      VALUES(?,?,?,?,?,?,?)`).bind(id, draft.kind, draft.channel, draft.business_name.trim(), draft.brief.trim(), draft.title.trim(), draft.body.trim()).run();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message === 'AI is not configured' ? 'أضف إعداد الذكاء أولًا أو اكتب المسودة يدويًا' : 'تعذر تجهيز المسودة' }, { status: 503 });
  }
}
