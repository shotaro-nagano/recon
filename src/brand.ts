/* ============================================================
   ブランド定義 — アプリ名はここ1箇所で管理する
   (manifest は vite.config.ts、HTML タイトルは index.html を別途参照)
   ============================================================ */
export const APP_NAME = 'RECON';
export const APP_TAGLINE = '卓球選手専用AIコーチ';
export const APP_PITCH = '会話するほど・試合を読ませるほど、あなた専用の分析官として育つ。';
export const APP_VERSION = 'v1.5';
/** ビルド(dev時はサーバー起動)時刻。どのビルドを見ているか確認用 */
export const APP_BUILD: string = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : '';
