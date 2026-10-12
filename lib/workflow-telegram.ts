import {
  resolveTelegramDestination,
  type TelegramEnv,
} from "@/lib/telegram-config";

export type WorkflowTelegramMessage = {
  chatId: string | null;
  text: string;
};

type SendDeps = {
  env?: TelegramEnv;
  fetchImpl?: typeof fetch;
};

export async function sendWorkflowTelegram(
  message: WorkflowTelegramMessage,
  deps: SendDeps = {}
): Promise<{ ok: true } | { ok: false; skipped?: boolean; error: string }> {
  const destination = resolveTelegramDestination({
    actionChatId: message.chatId,
    env: deps.env,
  });
  if ("error" in destination) {
    return { ok: false, skipped: true, error: destination.error };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = `https://api.telegram.org/bot${destination.token}/sendMessage`;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: destination.chatId,
        text: message.text,
        disable_web_page_preview: true,
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; description?: string }
      | null;
    if (res.ok && data?.ok) return { ok: true };
    const description =
      typeof data?.description === "string" && data.description.trim()
        ? data.description.trim()
        : "Telegram rechazó el mensaje";
    return { ok: false, error: hideToken(description, destination.token) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al enviar a Telegram";
    return { ok: false, error: hideToken(msg, destination.token) };
  }
}

function hideToken(message: string, token: string): string {
  return token ? message.split(token).join("***") : message;
}
