export type TelegramEnv = Record<string, string | undefined>;

const CHAT_ID_RE = /^-?\d{1,20}$/;
const CHANNEL_RE = /^@[A-Za-z][A-Za-z0-9_]{4,31}$/;

/** Numeric chat id (groups may be negative) or a public @canal. */
export function normalizeTelegramChatId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "0" || trimmed === "-0") return null;
  if (CHAT_ID_RE.test(trimmed) || CHANNEL_RE.test(trimmed)) return trimmed;
  return null;
}

export function telegramBotToken(env: TelegramEnv = process.env): string | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  return token.length > 0 ? token : null;
}

export function defaultTelegramChatId(env: TelegramEnv = process.env): string | null {
  return normalizeTelegramChatId(env.TELEGRAM_CHAT_ID);
}

export function isTelegramConfigured(env: TelegramEnv = process.env): boolean {
  return telegramBotToken(env) !== null;
}

/** Dev-only banner: do not surface Telegram env var names in production. */
export function shouldShowWorkflowTelegramHint(input: {
  telegramConfigured: boolean;
  nodeEnv?: string;
}): boolean {
  if (input.telegramConfigured) return false;
  return (input.nodeEnv ?? process.env.NODE_ENV) !== "production";
}

export function resolveTelegramDestination(input: {
  actionChatId: string | null;
  env?: TelegramEnv;
}): { token: string; chatId: string } | { error: string; skipped: true } {
  const env = input.env ?? process.env;
  const token = telegramBotToken(env);
  if (!token) {
    return { error: "Telegram no configurado", skipped: true };
  }
  const chatId = input.actionChatId ?? defaultTelegramChatId(env);
  if (!chatId) {
    return { error: "Sin chat de Telegram", skipped: true };
  }
  return { token, chatId };
}

export function workflowTelegramText(title: string, body: string): string {
  const head = title.trim() || "Aviso MSA";
  const rest = body.trim();
  const text = rest ? `${head}\n\n${rest}` : head;
  return text.slice(0, 4096);
}
