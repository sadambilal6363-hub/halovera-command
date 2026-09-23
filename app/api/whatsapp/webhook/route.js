export const runtime = "edge";

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

export async function POST(request) {
  try {
    const payload = await request.json();

    // Meta requires a fast 200 response. Message parsing, D1 logging,
    // rules and replies will be added after the phone/webhook is authorized.
    console.log("WhatsApp webhook event", JSON.stringify(payload));

    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("WhatsApp webhook error", error);
    return Response.json({ received: false }, { status: 200 });
  }
}
