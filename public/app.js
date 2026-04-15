const qEl = document.getElementById("q");
const metaEl = document.getElementById("meta");
const errEl = document.getElementById("err");
const resultsEl = document.getElementById("results");

/** @type {{ generatedAt?: string, count?: number, videos: any[] } | null} */
let data = null;

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlight(text, needle) {
  if (!needle) return esc(text);
  const t = String(text);
  const lower = t.toLowerCase();
  const n = needle.toLowerCase();
  let out = "";
  let i = 0;
  while (i < t.length) {
    const j = lower.indexOf(n, i);
    if (j === -1) {
      out += esc(t.slice(i));
      break;
    }
    out += esc(t.slice(i, j));
    out += `<span class="mark">${esc(t.slice(j, j + n.length))}</span>`;
    i = j + n.length;
  }
  return out;
}

function withTimestampUrl(videoId, seconds) {
  if (seconds == null || Number.isNaN(seconds)) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.max(0, Math.floor(seconds))}s`;
}

function normalizeNeedle(s) {
  return String(s || "").trim();
}

function matches(haystack, needle) {
  if (!needle) return true;
  return String(haystack).toLowerCase().includes(needle.toLowerCase());
}

function searchVideos(needle) {
  if (!data?.videos?.length) return [];
  const n = normalizeNeedle(needle);
  const out = [];
  for (const v of data.videos) {
    /** @type {{ type: string, label: string, href: string }[]} */
    const hits = [];

    for (const ch of v.chapters || []) {
      const blob = `${ch.title} ${ch.line} ${ch.raw}`;
      if (matches(blob, n)) {
        hits.push({
          type: "章節",
          label: ch.line,
          href: withTimestampUrl(v.id, ch.seconds),
        });
      }
    }

    for (const lk of v.links || []) {
      const blob = `${lk.url} ${lk.anchorText || ""} ${lk.context || ""}`;
      if (matches(blob, n)) {
        const label =
          lk.anchorText && lk.anchorText !== lk.url
            ? `${lk.anchorText} — ${lk.url}`
            : lk.url;
        hits.push({
          type: "連結",
          label,
          href: lk.url,
        });
      }
    }

    if (hits.length) out.push({ video: v, hits });
  }
  return out;
}

function render() {
  errEl.hidden = true;
  resultsEl.innerHTML = "";

  if (!data) {
    errEl.textContent = "尚未載入資料。";
    errEl.hidden = false;
    return;
  }

  const needle = normalizeNeedle(qEl.value);
  const rows = searchVideos(needle);

  metaEl.textContent = data.generatedAt
    ? `資料時間：${data.generatedAt} · 共 ${data.count ?? data.videos.length} 支 · 命中 ${rows.length} 支`
    : `共 ${data.videos?.length ?? 0} 支`;

  if (!needle) {
    resultsEl.innerHTML =
      '<p class="sub" style="margin:0;color:var(--muted)">輸入關鍵字以篩選章節與連結；留空時不顯示列表（避免一次載入過多）。</p>';
    return;
  }

  if (!rows.length) {
    resultsEl.innerHTML =
      '<p class="sub" style="margin:0;color:var(--muted)">沒有符合的章節或連結。</p>';
    return;
  }

  for (const { video: v, hits } of rows) {
    const card = document.createElement("article");
    card.className = "card";
    const title = esc(v.title || "(無標題)");
    card.innerHTML = `
      <h2><a href="${esc(v.watchUrl)}" target="_blank" rel="noopener">${title}</a></h2>
      <ul class="hits"></ul>
    `;
    const ul = card.querySelector(".hits");
    for (const h of hits) {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${esc(h.type)}</strong>：${highlight(h.label, needle)} — <a href="${esc(h.href)}" target="_blank" rel="noopener">開啟</a>`;
      ul.appendChild(li);
    }
    resultsEl.appendChild(card);
  }
}

async function load() {
  try {
    const res = await fetch("./data/videos.json", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? "找不到 data/videos.json。請在本機執行 npm run sync（需 .env 內的 YOUTUBE_API_KEY），或部署前產生該檔。"
          : `載入失敗（HTTP ${res.status}）`
      );
    }
    data = await res.json();
  } catch (e) {
    errEl.textContent = String(e?.message || e);
    errEl.hidden = false;
    data = null;
  }
  render();
}

qEl.addEventListener("input", () => render());

await load();
