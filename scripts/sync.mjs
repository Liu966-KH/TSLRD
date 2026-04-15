/**
 * 以管理者 API Key 同步頻道影片說明欄，輸出 public/data/videos.json
 * 環境變數：YOUTUBE_API_KEY、YOUTUBE_CHANNEL_ID 或 YOUTUBE_PLAYLIST_ID
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseYoutubeDescription } from "../lib/parseDescription.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public", "data", "videos.json");

const API = "https://www.googleapis.com/youtube/v3";

function getEnv(name, required = true) {
  const v = process.env[name];
  if (required && (!v || !String(v).trim())) {
    console.error(`缺少環境變數 ${name}`);
    process.exit(1);
  }
  return v ? String(v).trim() : "";
}

async function yt(pathname, params) {
  const key = getEnv("YOUTUBE_API_KEY");
  const u = new URL(API + pathname);
  u.searchParams.set("key", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  const res = await fetch(u);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

async function fetchAllPages(listFn) {
  const items = [];
  let pageToken;
  do {
    const chunk = await listFn(pageToken);
    items.push(...(chunk.items || []));
    pageToken = chunk.nextPageToken;
  } while (pageToken);
  return items;
}

async function getUploadsPlaylistId(channelId) {
  const data = await yt("/channels", {
    part: "contentDetails",
    id: channelId,
  });
  const pl =
    data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!pl) throw new Error("找不到上傳清單，請確認 YOUTUBE_CHANNEL_ID（須為 UC…）");
  return pl;
}

async function main() {
  const channelId = getEnv("YOUTUBE_CHANNEL_ID", false);
  let playlistId = getEnv("YOUTUBE_PLAYLIST_ID", false);

  if (!playlistId) {
    if (!channelId) {
      console.error("請設定 YOUTUBE_CHANNEL_ID 或 YOUTUBE_PLAYLIST_ID");
      process.exit(1);
    }
    playlistId = await getUploadsPlaylistId(channelId);
    console.error("上傳清單 ID:", playlistId);
  }

  const playlistItems = await fetchAllPages((pageToken) =>
    yt("/playlistItems", {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: 50,
      pageToken: pageToken || "",
    })
  );

  const videoIds = [
    ...new Set(
      playlistItems
        .map((it) => it.contentDetails?.videoId || it.snippet?.resourceId?.videoId)
        .filter(Boolean)
    ),
  ];

  const videos = [];

  const chunkSize = 50;
  for (let i = 0; i < videoIds.length; i += chunkSize) {
    const batch = videoIds.slice(i, i + chunkSize);
    const data = await yt("/videos", {
      part: "snippet,contentDetails",
      id: batch.join(","),
    });
    for (const v of data.items || []) {
      const id = v.id;
      const snippet = v.snippet || {};
      const description = snippet.description || "";
      const parsed = parseYoutubeDescription(description);
      videos.push({
        id,
        title: snippet.title || "",
        publishedAt: snippet.publishedAt || "",
        description,
        watchUrl: `https://www.youtube.com/watch?v=${id}`,
        ...parsed,
      });
    }
  }

  videos.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    playlistId,
    channelId: channelId || null,
    count: videos.length,
    videos,
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.error("已寫入", OUT, "共", videos.length, "支影片");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
