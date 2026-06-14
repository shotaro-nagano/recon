/* ============================================================
   端末内蔵AI連携(ブラウザの組み込みAI / Chrome Prompt API)
   端末上で動くモデル(例: Gemini Nano)を使う。外部サーバー送信なし。
   API表記の世代差(LanguageModel グローバル / window.ai.languageModel)を吸収する。
   対応していない端末では supported()=false → 呼び出し側がフォールバックする。
   ============================================================ */

export type DeviceAvailability =
  | 'available'      // すぐ使える
  | 'downloadable'   // モデルのDLが必要
  | 'downloading'    // DL中
  | 'unavailable'    // 非対応
  | 'unknown';

/* グローバルなAPIハンドルを取得(世代差を吸収) */
function getLM(): any {
  const g = globalThis as any;
  return g.LanguageModel ?? g.ai?.languageModel ?? null;
}

/** この端末/ブラウザが内蔵AIに対応しているか */
export function deviceAISupported(): boolean {
  return getLM() != null;
}

/** 利用可否(モデルのDL要否を含む) */
export async function deviceAIAvailability(): Promise<DeviceAvailability> {
  const lm = getLM();
  if (!lm) return 'unavailable';
  try {
    if (typeof lm.availability === 'function') {
      const a = await lm.availability();
      if (a === 'available' || a === 'readily') return 'available';
      if (a === 'downloadable' || a === 'after-download') return 'downloadable';
      if (a === 'downloading') return 'downloading';
      if (a === 'unavailable' || a === 'no') return 'unavailable';
      return 'unknown';
    }
    if (typeof lm.capabilities === 'function') {
      const c = await lm.capabilities();
      if (c?.available === 'readily') return 'available';
      if (c?.available === 'after-download') return 'downloadable';
      return 'unavailable';
    }
  } catch {
    return 'unknown';
  }
  return 'unknown';
}

export interface DeviceSession {
  prompt(text: string): Promise<string>;
  destroy(): void;
}

/** 端末内蔵AIのセッションを作る(systemプロンプトでコーチ人格・データを注入) */
export async function createDeviceSession(
  system: string,
  onDownload?: (loaded: number) => void,
): Promise<DeviceSession> {
  const lm = getLM();
  if (!lm) throw new Error('device-ai-unavailable');

  const monitor = onDownload
    ? (m: any) => m?.addEventListener?.('downloadprogress', (e: any) => onDownload(e?.loaded ?? 0))
    : undefined;

  let session: any;
  try {
    // 新しめのAPI: initialPrompts に system ロール
    session = await lm.create({ initialPrompts: [{ role: 'system', content: system }], monitor });
  } catch {
    // 旧API: systemPrompt フィールド
    session = await lm.create({ systemPrompt: system });
  }

  return {
    prompt: (t: string) => session.prompt(t),
    destroy: () => { try { session.destroy?.(); } catch { /* noop */ } },
  };
}
