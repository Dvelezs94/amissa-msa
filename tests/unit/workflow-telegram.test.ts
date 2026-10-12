import { describe, expect, it } from "vitest";
import { sendWorkflowTelegram } from "@/lib/workflow-telegram";

describe("sendWorkflowTelegram", () => {
  it("posts the message to the Bot API", async () => {
    const calls: { url: string; body: string }[] = [];
    const result = await sendWorkflowTelegram(
      { chatId: null, text: "Hola" },
      {
        env: { TELEGRAM_BOT_TOKEN: "999:SECRET", TELEGRAM_CHAT_ID: "@planta" },
        fetchImpl: async (input, init) => {
          calls.push({ url: String(input), body: String(init?.body ?? "") });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
      }
    );
    expect(result).toEqual({ ok: true });
    expect(calls[0]?.url).toBe(
      "https://api.telegram.org/bot999:SECRET/sendMessage"
    );
    expect(JSON.parse(calls[0]!.body)).toMatchObject({
      chat_id: "@planta",
      text: "Hola",
    });
  });

  it("returns the Telegram error without the bot token", async () => {
    const result = await sendWorkflowTelegram(
      { chatId: "-1001", text: "Hola" },
      {
        env: { TELEGRAM_BOT_TOKEN: "999:SECRET" },
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              ok: false,
              description: "chat not found token 999:SECRET",
            }),
            { status: 400 }
          ),
      }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("chat not found");
      expect(result.error).not.toContain("999:SECRET");
    }
  });
});
