# YouTube 說明欄查詢（靜態站）

以**管理者的** YouTube Data API Key 同步頻道影片，從說明欄解析**時間戳章節**與**超連結**，產生 `public/data/videos.json`；訪客只開靜態網頁搜尋，**不需要** API Key。

## 本機使用

1. 安裝 [Node.js](https://nodejs.org/) 18+。
2. 複製環境變數範本並填入：

   ```powershell
   copy .env.example .env
   ```

   - `YOUTUBE_API_KEY`：Google Cloud 專案啟用 YouTube Data API v3 後建立的 Key。
   - `YOUTUBE_CHANNEL_ID`：頻道 ID（`UC…`）。程式會自動讀「上傳」清單。
   - 若不要整個上傳清單，可改設 `YOUTUBE_PLAYLIST_ID`（並可留空 `YOUTUBE_CHANNEL_ID`）。

3. 同步資料：

   ```powershell
   npm run sync
   ```

4. 用靜態伺服器開 `public`（任選其一）：

   ```powershell
   npx --yes serve public
   ```

   瀏覽器開提示的網址即可搜尋。

## GitHub Pages

1. 將此 repo 推到 GitHub，在 **Settings → Pages** 將來源設為 **GitHub Actions**。
2. 在 **Settings → Secrets and variables → Actions** 新增：
   - `YOUTUBE_API_KEY`
   - `YOUTUBE_CHANNEL_ID` 或 `YOUTUBE_PLAYLIST_ID`
3. 到 **Actions** 手動執行「Sync and deploy Pages」，或等排程（預設每天 UTC 06:00）。

## 專案結構

- `lib/parseDescription.mjs`：解析說明欄時間戳與連結。
- `scripts/sync.mjs`：呼叫 API、寫入 `public/data/videos.json`。
- `public/`：查詢介面（`index.html`、`app.js`）。
