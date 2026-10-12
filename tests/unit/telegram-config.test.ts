import { describe, expect, it } from "vitest";
import {
  defaultTelegramChatId,
  isTelegramConfigured,
  normalizeTelegramChatId,
  resolveTelegramDestination,
  shouldShowWorkflowTelegramHint,
  workflowTelegramText,
} from "@/lib/telegram-config";

describe("normalizeTelegramChatId", () => {
  it("accepts a group id and a public channel", () => {
    expect(normalizeTelegramChatId(" -1001234567890 ")).toBe("-1001234567890");
    expect(normalizeTelegramChatId("@Mantenimiento")).toBe("@Mantenimiento");
  });

  it("rejects blank and free text", () => {
    expect(normalizeTelegramChatId("")).toBeNull();
    expect(normalizeTelegramChatId("canal")).toBeNull();
    expect(normalizeTelegramChatId("0")).toBeNull();
  });
});

describe("telegram env", () => {
  it("reads the bot token and the default chat", () => {
    const env = {
      TELEGRAM_BOT_TOKEN: "123:ABC",
      TELEGRAM_CHAT_ID: "@planta",
    };
    expect(isTelegramConfigured(env)).toBe(true);
    expect(defaultTelegramChatId(env)).toBe("@planta");
    expect(isTelegramConfigured({})).toBe(false);
  });

  it("prefers the action chat and skips when nothing is set", () => {
    const env = { TELEGRAM_BOT_TOKEN: "123:ABC", TELEGRAM_CHAT_ID: "@planta" };
    expect(
      resolveTelegramDestination({ actionChatId: "-1009", env })
    ).toEqual({ token: "123:ABC", chatId: "-1009" });
    expect(
      resolveTelegramDestination({ actionChatId: null, env: { TELEGRAM_BOT_TOKEN: "123:ABC" } })
    ).toEqual({ error: "Sin chat de Telegram", skipped: true });
    expect(resolveTelegramDestination({ actionChatId: "@planta", env: {} })).toEqual({
      error: "Telegram no configurado",
      skipped: true,
    });
  });

  it("hides the setup hint in production", () => {
    expect(
      shouldShowWorkflowTelegramHint({
        telegramConfigured: false,
        nodeEnv: "development",
      })
    ).toBe(true);
    expect(
      shouldShowWorkflowTelegramHint({
        telegramConfigured: false,
        nodeEnv: "production",
      })
    ).toBe(false);
  });
});

describe("workflowTelegramText", () => {
  it("joins title and body", () => {
    expect(workflowTelegramText("Folio {{folio}}", "Listo")).toBe(
      "Folio {{folio}}\n\nListo"
    );
    expect(workflowTelegramText("  ", "")).toBe("Aviso MSA");
  });
});
