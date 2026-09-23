import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function database() {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

export async function GET() {
  try {
    const db = await database();
    const result = await db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all();
    return NextResponse.json({ ok: true, projects: result.results || [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
    const slug = String(body.slug || name.toLowerCase().replace(/\s+/g, "-")).trim();
    const db = await database();
    const result = await db.prepare(
      "INSERT INTO projects (client_id,name,slug,category,description,domain,repository_url,live_url,status,priority,budget,amount_paid,start_date,due_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(
      body.client_id || null, name, slug, body.category || null, body.description || null,
      body.domain || null, body.repository_url || null, body.live_url || null,
      body.status || "planning", body.priority || "normal", Number(body.budget || 0),
      Number(body.amount_paid || 0), body.start_date || null, body.due_date || null
    ).run();
    return NextResponse.json({ ok: true, id: result.meta?.last_row_id || null }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
