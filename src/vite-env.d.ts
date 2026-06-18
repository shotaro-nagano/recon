/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** ビルド(dev時はサーバー起動)時刻。vite.config.ts の define で注入 */
declare const __APP_BUILD__: string;
