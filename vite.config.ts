import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// ビルド(dev時はサーバー起動)時刻。アプリ内に表示して「どのビルドを見ているか」を確認できるようにする(JST)
const BUILD_STAMP = `${new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')} JST`;

export default defineConfig({
  define: {
    __APP_BUILD__: JSON.stringify(BUILD_STAMP),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'RECON — 卓球AIコーチ',
        short_name: 'RECON',
        description: 'RECON — 会話するほど・試合を読ませるほど精度が増す、卓球選手本人専用のAIコーチ。',
        lang: 'ja',
        dir: 'ltr',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F6FA',
        theme_color: '#FFFFFF',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 戦術カードを含む全画面をオフラインで開けるよう、アプリ資産を全てプリキャッシュする
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // 新ビルドを即時反映(旧Service Workerの待機を避ける)＋古いキャッシュを破棄
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
