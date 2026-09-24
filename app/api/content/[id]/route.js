import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isAuthorized, sameOrigin } from '../../../../lib/inbox.mjs';
import { contentTables, fingerprint, validDraft } from '../../../../lib/content.mjs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { env } = await getCloudflareContext({ async: true });
  if (!(await isAuthorized(request, env))) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: 'Origin mismatch' }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: 'معرف غير صالح' }, { status: 400 });
  try {
    const input = await request.json();
    await contentTables(env.DB);
    const draft = await env.DB.prepare('SELECT * FROM content_drafts WHERE id=?').bind(id).first();
    if (!draft) return Response.json({ error: 'المسودة غير موجودة' }, { status: 404 });
    if (input.action === 'edit') {
      const next = { ...draft, title: input.title, body: input.body };
      if (!validDraft(next)) return Response.json({ error: 'النص أو العنوان غير صالح' }, { status: 400 });
      await env.DB.prepare(`UPDATE content_drafts SET title=?,body=?,status='draft',approved_hash=NULL,approved_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status!='published'`)
        .bind(next.title.trim(), next.body.trim(), id).run();
      return Response.json({ status: 'draft' });
    }
    if (input.action === 'approve') {
      const hash = await fingerprint(draft);
      await env.DB.prepare(`UPDATE content_drafts SET status='approved',approved_hash=?,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='draft'`)
        .bind(hash, id).run();
      return Response.json({ status: draft.status === 'draft' ? 'approved' : draft.status });
    }
    if (input.action === 'publish') {
      if (draft.status !== 'approved' || !draft.approved_hash || draft.approved_hash !== await fingerprint(draft))
        return Response.json({ error: 'راجع واعتمد النسخة الحالية أولًا' }, { status: 409 });
      // No channel connector is configured: never mark content as published without a provider receipt.
      return Response.json({ error: 'قناة النشر غير مربوطة بعد؛ المسودة معتمدة ولم تُنشر' }, { status: 409 });
    }
    return Response.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch { return Response.json({ error: 'تعذر تنفيذ الطلب' }, { status: 503 }); }
}
