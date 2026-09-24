import { contentTables, generateDraft } from './content.mjs';

const QUERY = `[out:json][timeout:18];(nwr(around:7000,25.101,55.9128)[shop~"supermarket|convenience|bakery|clothes|furniture|beauty|hairdresser|mobile_phone|car_repair"];nwr(around:7000,25.101,55.9128)[amenity~"restaurant|cafe|fast_food"];);out center 120;`;
const CATEGORY = { supermarket:'سوبرماركت', convenience:'متجر', bakery:'مخبز', clothes:'ملابس', furniture:'أثاث', beauty:'صالون', hairdresser:'صالون', mobile_phone:'هواتف', car_repair:'سيارات', restaurant:'مطعم', cafe:'مقهى', fast_food:'مطعم' };

export async function discoveryTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS opportunity_discoveries (
    source_key TEXT PRIMARY KEY, business_name TEXT NOT NULL, category TEXT NOT NULL,
    location TEXT NOT NULL, phone TEXT, website TEXT, source_url TEXT NOT NULL,
    score INTEGER NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS opportunity_discovery_runs (
    area TEXT PRIMARY KEY, last_run_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export function normalizePlace(element) {
  const tags = element?.tags || {};
  const name = String(tags['name:ar'] || tags.name || '').trim().slice(0, 120);
  const type = tags.shop || tags.amenity;
  if (!name || !CATEGORY[type] || !['node','way','relation'].includes(element.type) || !Number.isSafeInteger(element.id)) return null;
  const contact = String(tags['contact:phone'] || tags.phone || '').split(/[;,]/)[0].trim();
  const phone = contact.replace(/[^\d+]/g, '').replace(/^\+/, '');
  const website = String(tags['contact:website'] || tags.website || '').slice(0, 300);
  const safeWebsite = /^https?:\/\//i.test(website) ? website : '';
  const hasPhone = /^\d{6,20}$/.test(phone);
  const score = Math.min(85, 30 + (hasPhone ? 25 : 0) + (!safeWebsite ? 15 : 0) + (['restaurant','cafe','fast_food','supermarket'].includes(type) ? 10 : 0));
  const reasons = [hasPhone ? 'رقم منشور في المصدر' : 'رقم التواصل غير متاح في المصدر',
    safeWebsite ? 'يوجد رابط موقع في المصدر' : 'لا يظهر رابط موقع في هذا المصدر؛ تحقق يدويًا'];
  return { source_key:`osm:${element.type}:${element.id}`, business_name:name, category:CATEGORY[type],
    location:'مليحة ومحيطها، الشارقة', phone:hasPhone ? phone : '', website:safeWebsite,
    source_url:`https://www.openstreetmap.org/${element.type}/${element.id}`, score, reason:reasons.join(' • ') };
}

export async function findLocalBusinesses(send = fetch) {
  const response = await send('https://overpass-api.de/api/interpreter', {
    method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8' },
    body:new URLSearchParams({ data: QUERY }).toString(), signal:AbortSignal.timeout(22000),
  });
  if (!response.ok) throw new Error(`Listing source returned ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.elements)) throw new Error('Invalid listing source');
  return data.elements.slice(0, 120).map(normalizePlace).filter(Boolean);
}

export async function prepareOffer(db, sourceKey, env) {
  await discoveryTables(db);
  await contentTables(db);
  const item = await db.prepare('SELECT * FROM opportunity_discoveries WHERE source_key=?').bind(sourceKey).first();
  if (!item) throw new Error('Not found');
  const brief = `${item.category} في ${item.location}. مصدر البيانات: ${item.source_url}. ${item.reason}. لا تدّع أن النشاط بلا موقع أو يحتاج خدماتنا دون تحقق.`;
  let draft;
  if (env.OPENAI_API_KEY && env.OPENAI_MODEL) {
    draft = await generateDraft({ kind:'offer', channel:'whatsapp_message', business_name:item.business_name, brief }, env);
  } else {
    draft = { title:`اقتراح حضور رقمي لـ${item.business_name}`, body:`مرحبًا فريق ${item.business_name}، نحن هلوفيرا ديجتال ونقدم تصميم المواقع وصفحات الخدمات والمحتوى الرقمي. إذا كان تطوير حضوركم الرقمي ضمن خططكم، يسعدنا فهم احتياجكم وتقديم تصور مناسب. هل تودون الاطلاع على أمثلة من أعمالنا؟` };
  }
  // No direct send: the owner must review the lead, recipient, text and approve separately.
  const id = crypto.randomUUID();
  const channel = /^\d{6,20}$/.test(item.phone || '') ? 'whatsapp_message' : 'website';
  await db.prepare(`INSERT INTO content_drafts(id,kind,channel,business_name,brief,recipient,title,body)
    VALUES(?,'offer',?,?,?,?,?,?)`).bind(id, channel, item.business_name, brief, channel === 'whatsapp_message' ? item.phone : '', draft.title, draft.body).run();
  await db.prepare("UPDATE opportunity_discoveries SET status='prepared' WHERE source_key=?").bind(sourceKey).run();
  return id;
}
