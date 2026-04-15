/**
 * 從 YouTube 說明欄解析時間戳行與超連結，供關鍵字搜尋索引。
 */

const TIMESTAMP_LINE =
  /^\s*((?:\d{1,2}:)?\d{1,3}:\d{2})\s*(.*)$/;

const URL_IN_TEXT =
  /https?:\/\/[^\s\]<>"'()]+|www\.[^\s\]<>"'()]+/gi;

const MARKDOWN_LINK = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;

function timestampToSeconds(ts) {
  const parts = ts.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

function normalizeUrl(raw) {
  let u = raw.trim().replace(/[),.;]+$/, "");
  if (u.startsWith("www.")) u = `https://${u}`;
  return u;
}

/**
 * @param {string} description
 * @returns {{ chapters: Array<{ raw: string, seconds: number|null, title: string, line: string }>, links: Array<{ url: string, anchorText: string, context: string }> }}
 */
export function parseYoutubeDescription(description) {
  const text = description || "";
  const lines = text.split(/\r?\n/);

  /** @type {Array<{ raw: string, seconds: number|null, title: string, line: string }>} */
  const chapters = [];
  for (const line of lines) {
    const m = line.match(TIMESTAMP_LINE);
    if (!m) continue;
    const raw = m[1];
    const title = (m[2] || "").trim();
    const seconds = timestampToSeconds(raw);
    chapters.push({
      raw,
      seconds,
      title,
      line: line.trim(),
    });
  }

  /** @type {Map<string, { url: string, anchorText: string, contexts: Set<string> }>} */
  const linkMap = new Map();

  function addLink(url, anchorText, context) {
    const normalized = normalizeUrl(url);
    if (!normalized.startsWith("http")) return;
    let entry = linkMap.get(normalized);
    if (!entry) {
      entry = { url: normalized, anchorText: anchorText || "", contexts: new Set() };
      linkMap.set(normalized, entry);
    }
    if (anchorText && !entry.anchorText) entry.anchorText = anchorText;
    if (context) entry.contexts.add(context.slice(0, 500));
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let md;
    const mdRe = new RegExp(MARKDOWN_LINK.source, "gi");
    while ((md = mdRe.exec(trimmed)) !== null) {
      addLink(md[2], md[1], trimmed);
    }

    const plain = trimmed.replace(MARKDOWN_LINK, " ");
    let um;
    const urlRe = new RegExp(URL_IN_TEXT.source, "gi");
    while ((um = urlRe.exec(plain)) !== null) {
      addLink(um[0], "", trimmed);
    }
  }

  const links = [...linkMap.values()].map((e) => ({
    url: e.url,
    anchorText: e.anchorText,
    context: [...e.contexts].join(" \n "),
  }));

  return { chapters, links };
}
