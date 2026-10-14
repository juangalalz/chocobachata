import "server-only";

// Avisos al móvil por un bot de Telegram. Los errores van solo a TELEGRAM_CHAT_ID;
// las ventas, a todos los de TELEGRAM_SALES_CHAT_IDS (separados por comas).
// Sin token ni chats solo queda el log de Vercel.
async function send(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.error("[aviso]", text);
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });

    if (!response.ok) {
      console.error("[aviso] Telegram respondió", response.status, chatId, text);
    }
  } catch (error) {
    console.error("[aviso] No se pudo avisar por Telegram", error, text);
  }
}

export async function notify(text: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!chatId) {
    console.error("[aviso]", text);
    return;
  }

  await send(chatId, text);
}

export async function notifySale(text: string): Promise<void> {
  const chatIds = (process.env.TELEGRAM_SALES_CHAT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (chatIds.length === 0) {
    console.log("[venta]", text);
    return;
  }

  await Promise.all(chatIds.map((chatId) => send(chatId, text)));
}
