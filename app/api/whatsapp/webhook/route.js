import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleIncoming, validMetaSignature } from "../../../../lib/whatsapp.mjs";

export const runtime = "edge";
export const dynamic = "force-dynamic";

async function bindings() {
  return (await getCloudflareContext({ async: true })).env;
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const env = await bindings();
  if (params.get("hub.mode") === "subscribe" && env.WHATSAPP_VERIFY_TOKEN &&
      params.get("hub.verify_token") === env.WHATSAPP_VERIFY_TOKEN && params.has("hub.challenge")) {
    return new Response(params.get("hub.challenge"), { status: 200 });
  }
  return new Response("Verification failed", { status: 403 });
}

export async function POST(request) {
  const env = await bindings();
  const raw = await request.text();
  if (!(await validMetaSignature(raw, request.headers.get("x-hub-signature-256"), env.META_APP_SECRET))) {
    return new Response("Invalid signature", { status: 403 });
  }
  let payload;
  try { payload = JSON.parse(raw); }
  catch { return new Response("Invalid JSON", { status: 400 }); }
  if (env.WHATSAPP_AUTO_REPLY_ENABLED !== "true") return new Response("OK", { status: 200 });
  try {
    await handleIncoming(payload, env);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("WhatsApp processing failed", error);
    return new Response("Retry", { status: 503 });
  }
}
