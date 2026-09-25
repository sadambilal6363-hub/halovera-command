import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isAuthorized, sameOrigin } from '../../../../lib/inbox.mjs';
import { contentTables, fingerprint, validDraft } from '../../../../lib/content.mjs';
import { sendMessage } from '../../../../lib/inbox.mjs';
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
      if (!['draft', 'approved'].includes(draft.status)) return Response.json({ error: 'لا يمكن تعديل مسودة أُرسلت أو قيد الإرسال' }, { status: 409 });
      const next = { ...draft, title: input.title, body: input.body };
      if (!validDraft(next)) return Response.json({ error: 'النص أو العنوان غير صالح' }, { status: 400 });
      await env.DB.prepare(`UPDATE content_drafts SET title=?,body=?,status='draft',approved_hash=NULL,approved_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('draft','approved')`)
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
      if (draft.channel === 'whatsapp_status')
        return Response.json({ error: 'حالة واتساب جاهزة للنسخ؛ انشرها من تحديثات تطبيق واتساب أعمال. لا يوجد نشر آلي رسمي للحالة هنا.' }, { status: 409 });
      if (draft.channel !== 'whatsapp_message')
        return Response.json({ error: 'قناة النشر غير مربوطة بعد؛ المسودة معتمدة ولم تُنشر' }, { status: 409 });
      if (!input.consentConfirmed) return Response.json({ error: 'أكد أن العميل طلب العرض، أو أنه وافق على تلقي عروض هلوفيرا' }, { status: 400 });
      if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID)
        return Response.json({ error: 'اربط رقم واتساب الحقيقي أولًا؛ لم تُرسل الرسالة' }, { status: 409 });
      const recent = await env.DB.prepare(`SELECT id FROM whatsapp_messages WHERE phone=? AND direction='in'
        AND created_at>=datetime('now','-24 hours') ORDER BY created_at DESC LIMIT 1`).bind(draft.recipient).first();
      if (!recent) return Response.json({ error: 'لا توجد رسالة واردة حديثة من هذا العميل؛ تحتاج الرسائل خارج نافذة 24 ساعة إلى قالب معتمد' }, { status: 409 });
      // Claim the exact approved draft before calling Meta so two clicks cannot send twice.
      const claimed = await env.DB.prepare(`UPDATE content_drafts SET status='sending',updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND status='approved' AND approved_hash=?`).bind(id, draft.approved_hash).run();
      if (!claimed.meta?.changes) return Response.json({ error: 'هذه الرسالة قيد الإرسال أو تغيرت حالتها' }, { status: 409 });
      try {
        const messageId = await sendMessage(env, draft.recipient, `${draft.title}\n\n${draft.body}`.slice(0, 4096));
        await env.DB.prepare(`UPDATE content_drafts SET status='published',provider_message_id=?,published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='sending'`).bind(messageId, id).run();
        return Response.json({ status: 'published', provider_message_id: messageId });
      } catch {
        // A timeout can happen after Meta accepted the message. Require human review before any retry.
        await env.DB.prepare(`UPDATE content_drafts SET status='send_unknown',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='sending'`).bind(id).run();
        return Response.json({ error: 'تعذر تأكيد الإرسال. تحقق من محادثة العميل قبل أي محاولة جديدة.' }, { status: 502 });
      }
    }
    return Response.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch { return Response.json({ error: 'تعذر تنفيذ الطلب' }, { status: 503 }); }
}
