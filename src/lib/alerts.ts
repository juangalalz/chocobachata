import "server-only";

// Avisos al móvil por un bot de Telegram. Sin TELEGRAM_BOT_TOKEN y
// TELEGRAM_CHAT_ID solo queda el log de Vercel.
export async function notify(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
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
      console.error("[aviso] Telegram respondió", response.status, text);
    }
  } catch (error) {
    console.error("[aviso] No se pudo avisar por Telegram", error, text);
  }
}
