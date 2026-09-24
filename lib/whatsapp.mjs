const encoder = new TextEncoder();

export async function validMetaSignature(body, header, appSecret) {
  if (!appSecret || !/^sha256=[0-9a-f]{64}$/i.test(header || "")) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const supplied = header.slice(7).toLowerCase();
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return difference === 0;
}

export function incomingTextMessages(payload, phoneNumberId) {
  if (payload?.object !== "whatsapp_business_account") return [];
  return (payload.entry || []).flatMap((entry) => (entry.changes || []).flatMap(({ value }) => {
    if (String(value?.metadata?.phone_number_id) !== String(phoneNumberId)) return [];
    return (value.messages || []).filter((message) => message.type === "text" && message.id && message.from)
      .map((message) => ({ id: message.id, from: message.from, text: message.text?.body || "" }));
  }));
}

export function replyFor(text) {
  const normalized = String(text || "").toLowerCase().replace(/[\u064b-\u065f\u0670]/g, "");
  if (/موقع|ويب|متجر|website|web|store/.test(normalized)) {
    return "أهلًا بك في هلوفيرا ديجتال 👋 نصمم مواقع ومتاجر للشركات والمشاريع. أرسل اسم نشاطك، الخدمة التي تقدمها، ورابط موقعك إن وجد، وسيتابع معك فريقنا.";
  }
  if (/اعلان|اعلانات|تسويق|ads|marketing/.test(normalized)) {
    return "أهلًا بك في هلوفيرا ديجتال 👋 للمساعدة في الإعلان والتسويق، أرسل نوع نشاطك، المدينة، وهدف الحملة والميزانية التقريبية. سيتابع معك فريقنا.";
  }
  if (/هوية|شعار|محتوى|تصميم|brand|content/.test(normalized)) {
    return "أهلًا بك في هلوفيرا ديجتال 👋 أرسل اسم نشاطك وما تحتاجه من هوية أو تصميم أو محتوى، مع أي أمثلة تعجبك. سيتابع معك فريقنا.";
  }
  return "أهلًا بك في هلوفيرا ديجتال 👋 كيف نساعدك؟ اكتب: موقع، إعلان، أو هوية. ويمكنك أيضًا وصف مشروعك هنا ليتابع معك فريقنا.";
}

export async function handleIncoming(payload, { DB, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_GRAPH_VERSION }, send = fetch) {
  if (!DB || !WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) throw new Error("WhatsApp integration is not configured");
  const version = WHATSAPP_GRAPH_VERSION || "v23.0";
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("Invalid Graph API version");
  const messages = incomingTextMessages(payload, WHATSAPP_PHONE_NUMBER_ID);
  if (!messages.length) return 0;
  await DB.prepare("CREATE TABLE IF NOT EXISTS whatsapp_processed_messages (message_id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  let sent = 0;
  for (const message of messages) {
    const inserted = await DB.prepare("INSERT OR IGNORE INTO whatsapp_processed_messages (message_id) VALUES (?)").bind(message.id).run();
    if (!inserted.meta?.changes) continue;
    try {
      const response = await send(`https://graph.facebook.com/${version}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: message.from,
          type: "text", text: { preview_url: false, body: replyFor(message.text) } }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`Meta message API returned ${response.status}`);
      const result = await response.json();
      if (!result.messages?.[0]?.id) throw new Error('Meta returned no message id');
      await DB.prepare("INSERT OR IGNORE INTO whatsapp_messages(id,phone,direction,body) VALUES(?,?,'out',?)")
        .bind(result.messages[0].id, message.from, replyFor(message.text)).run();
      sent++;
    } catch (error) {
      await DB.prepare("DELETE FROM whatsapp_processed_messages WHERE message_id = ?").bind(message.id).run();
      throw error;
    }
  }
  return sent;
}
