/** Inline tokens in `notes.body` (same as `app/api/work-orders/[id]/notes/route.ts`). */
const ATTACHMENT_TOKEN_REGEX = /\[\[file:([^|\]]+)\|([^\]]+)\]\]/g;
const ATTACHMENT_TOKEN_WITH_ID_REGEX = /\[\[fileid:([^|\]]+)\|([^\]]+)\]\]/g;

export function publicAttachmentDownloadPath(attachmentId: string, folio: string | number): string {
  const qs = `folio=${encodeURIComponent(String(folio))}`;
  return `/api/solicitud/attachments/${encodeURIComponent(attachmentId)}/download?${qs}`;
}

export function buildPublicAttachmentUrlMaps(
  rows: { id: string; fileUrl: string }[],
  folio: string | number
): { byId: Map<string, string>; byUrl: Map<string, string> } {
  const byId = new Map(
    rows.map((r) => [r.id, publicAttachmentDownloadPath(r.id, folio)])
  );
  const byUrl = new Map(
    rows.map((r) => [r.fileUrl, publicAttachmentDownloadPath(r.id, folio)])
  );
  return { byId, byUrl };
}

/** Rewrite `[[fileid:...]]` / `[[file:...]]` to public `/api/solicitud/attachments/...` URLs. */
export function rewriteNoteBodyToPublicDownloadUrls(
  body: string,
  folio: string | number,
  byId: Map<string, string>,
  byUrl: Map<string, string>
): string {
  const fallback = (id: string) => publicAttachmentDownloadPath(id, folio);
  const withNewTokens = body.replace(
    ATTACHMENT_TOKEN_WITH_ID_REGEX,
    (_full, attachmentId: string, encodedFilename: string) =>
      `[[file:${encodedFilename}|${byId.get(attachmentId) ?? fallback(attachmentId)}]]`
  );
  return withNewTokens.replace(
    ATTACHMENT_TOKEN_REGEX,
    (_full, encodedFilename: string, fileUrl: string) =>
      `[[file:${encodedFilename}|${byUrl.get(fileUrl) ?? fileUrl}]]`
  );
}

/** After rewrite, split visible text vs inline file links. */
export function extractInlineFilesFromRewrittenNote(body: string): {
  text: string;
  files: { filename: string; url: string }[];
} {
  const files: { filename: string; url: string }[] = [];
  const text = body.replace(ATTACHMENT_TOKEN_REGEX, (_full, encodedFilename: string, url: string) => {
    files.push({ filename: decodeURIComponent(encodedFilename), url });
    return "";
  });
  return { text: text.trim(), files };
}
