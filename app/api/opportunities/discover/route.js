import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isAuthorized, sameOrigin } from '../../../../lib/inbox.mjs';
import { discoveryTables, findLocalBusinesses, prepareOffer } from '../../../../lib/discovery.mjs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { env } = await getCloudflareContext({ async:true });
  if (!(await isAuthorized(request, env))) return Response.json({ error:'Unauthorized' }, { status:401 });
  try {
    await discoveryTables(env.DB);
    const { results } = await env.DB.prepare('SELECT * FROM opportunity_discoveries ORDER BY score DESC, created_at DESC LIMIT 100').all();
    const run = await env.DB.prepare("SELECT last_run_at FROM opportunity_discovery_runs WHERE area='mleiha'").first();
    return Response.json({ items:results || [], last_run_at:run?.last_run_at || null }, { headers:{ 'Cache-Control':'no-store' } });
  } catch { return Response.json({ error:'تعذر تحميل الفرص' }, { status:503 }); }
}

export async function POST(request) {
  const { env } = await getCloudflareContext({ async:true });
  if (!(await isAuthorized(request, env))) return Response.json({ error:'Unauthorized' }, { status:401 });
  if (!sameOrigin(request)) return Response.json({ error:'Origin mismatch' }, { status:403 });
  try {
    const input = await request.json();
    await discoveryTables(env.DB);
    if (input?.action === 'prepare') {
      if (typeof input.source_key !== 'string' || !/^osm:(node|way|relation):\d+$/.test(input.source_key))
        return Response.json({ error:'معرف غير صالح' }, { status:400 });
      const id = await prepareOffer(env.DB, input.source_key, env);
      return Response.json({ id }, { status:201 });
    }
    if (input?.action !== 'scan') return Response.json({ error:'إجراء غير معروف' }, { status:400 });
    const previous = await env.DB.prepare("SELECT last_run_at FROM opportunity_discovery_runs WHERE area='mleiha'").first();
    if (previous && Date.now() - Date.parse(previous.last_run_at.replace(' ', 'T') + 'Z') < 6 * 60 * 60 * 1000)
      return Response.json({ error:'آخر بحث حديث؛ تتوفر إعادة البحث بعد 6 ساعات' }, { status:429 });
    const places = await findLocalBusinesses();
    for (const p of places) await env.DB.prepare(`INSERT OR IGNORE INTO opportunity_discoveries
      (source_key,business_name,category,location,phone,website,source_url,score,reason)
      VALUES(?,?,?,?,?,?,?,?,?)`).bind(p.source_key,p.business_name,p.category,p.location,p.phone,p.website,p.source_url,p.score,p.reason).run();
    await env.DB.prepare(`INSERT INTO opportunity_discovery_runs(area,last_run_at) VALUES('mleiha',CURRENT_TIMESTAMP)
      ON CONFLICT(area) DO UPDATE SET last_run_at=CURRENT_TIMESTAMP`).run();
    return Response.json({ found:places.length });
  } catch { return Response.json({ error:'تعذر جلب البيانات العامة؛ حاول لاحقًا' }, { status:503 }); }
}
