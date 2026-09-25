export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
    return new Response(challenge || "", { status: 200 });
  }

  return new Response("Verification failed", { status: 403 });
}

async function hasValidSignature(body, signature, secret) {
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  const actual = Uint8Array.from(signature.slice(7).match(/.{2}/g), (hex) => parseInt(hex, 16));

  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ actual[i];
  return difference === 0;
}

export async function POST(request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return Response.json({ received: false }, { status: 503 });

  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!(await hasValidSignature(body, signature, appSecret))) {
    return Response.json({ received: false }, { status: 403 });
  }

  try {
    JSON.parse(body);
  } catch {
    return Response.json({ received: false }, { status: 400 });
  }

  // The endpoint only acknowledges authenticated events for now. Message
  // storage and replies need their own implementation; do not log payloads.
  return Response.json({ received: true }, { status: 200 });
}
