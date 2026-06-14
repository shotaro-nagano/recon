/* ============================================================
   ChatScreen — AIコーチとチャット(端末内・外部送信なし)
   あなたのカルテ・タイプ・相性・試合データから答える。
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { todayStr, useAppStore } from '@/store/useAppStore';
import { computeTypeResult } from '@/domain/typeEngine';
import { buildCoachSystemPrompt, coachReply, DEFAULT_CHIPS, greetingReply, type ChatContext, type ChatReply } from '@/domain/coach/chat';
import { createDeviceSession, deviceAISupported, type DeviceSession } from '@/domain/coach/deviceAI';

export default function ChatScreen() {
  const settings = useAppStore((s) => s.settings);
  const diagnosis = useAppStore((s) => s.diagnosis);
  const matches = useAppStore((s) => s.matches);
  const opponents = useAppStore((s) => s.opponents);
  const karte = useAppStore((s) => s.karte);
  const chat = useAppStore((s) => s.chat);
  const pushChat = useAppStore((s) => s.pushChat);
  const resetChat = useAppStore((s) => s.resetChat);

  const [draft, setDraft] = useState('');
  const [chips, setChips] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const alive = useRef(true);
  const deviceSession = useRef<DeviceSession | null>(null);

  const useDevice = settings.chatEngine === 'device' && deviceAISupported();

  useEffect(() => () => {
    alive.current = false;
    deviceSession.current?.destroy();
  }, []);

  // エンジン切替時はセッションを作り直す
  useEffect(() => {
    deviceSession.current?.destroy();
    deviceSession.current = null;
    setNotice(null);
  }, [settings.chatEngine]);

  const ctx: ChatContext = useMemo(() => {
    const today = todayStr();
    const approved = matches.filter((m) => m.approved);
    return {
      result: computeTypeResult(approved, diagnosis, settings, today),
      approved,
      karte,
      opponents,
      diagnosis,
      settings,
      today,
    };
  }, [matches, diagnosis, settings, karte, opponents]);

  // 初回挨拶(チャットが空のとき1回だけ)
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const g = greetingReply(ctx);
    if (chat.length === 0) {
      g.texts.forEach((t) => pushChat({ role: 'coach', text: t }));
    }
    setChips(g.chips);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 新着・考え中の表示で最下部へ
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length, thinking]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // 少し考えてから返す(考え中ドット → 吹き出しを少しずつ)
  async function respond(reply: ChatReply) {
    setChips([]);
    setThinking(true);
    const len = reply.texts.join('').length;
    await sleep(600 + Math.min(1200, len * 7)); // 内容が長いほど少し長く考える
    if (!alive.current) return;
    setThinking(false);
    for (let i = 0; i < reply.texts.length; i++) {
      if (!alive.current) return;
      pushChat({ role: 'coach', text: reply.texts[i] });
      if (i < reply.texts.length - 1) await sleep(360);
    }
    if (!alive.current) return;
    setChips(reply.chips);
  }

  // 端末内蔵AIで応答(失敗時はかんたん応答にフォールバック)
  async function respondDevice(text: string) {
    setChips([]);
    setThinking(true);
    try {
      if (!deviceSession.current) {
        setNotice('端末のAIを準備中…(初回はモデルのダウンロードが必要な場合があります)');
        deviceSession.current = await createDeviceSession(buildCoachSystemPrompt(ctx));
        if (!alive.current) return;
        setNotice(null);
      }
      const out = await deviceSession.current.prompt(text);
      if (!alive.current) return;
      setThinking(false);
      pushChat({ role: 'coach', text: out.trim() || '(うまく答えられなかった。質問を変えてみてくれ)' });
      setChips(DEFAULT_CHIPS);
    } catch {
      if (!alive.current) return;
      setThinking(false);
      setNotice('この端末では内蔵AIが使えなかったので、かんたん応答で答えるぞ。(設定で切り替えられる)');
      const reply = coachReply(text, ctx);
      reply.texts.forEach((t) => pushChat({ role: 'coach', text: t }));
      setChips(reply.chips);
    }
  }

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    pushChat({ role: 'me', text });
    setDraft('');
    if (useDevice) void respondDevice(text);
    else void respond(coachReply(text, ctx));
  };

  return (
    <div className="fade-in chat-screen">
      <div className="spread" style={{ marginBottom: 8 }}>
        <h1 className="display screen-title" style={{ margin: 0 }}>チャット</h1>
        {chat.length > 0 && (
          <button
            className="btn btn-ghost"
            style={{ minHeight: 34, padding: '4px 10px', fontSize: 13 }}
            onClick={() => {
              if (!window.confirm('チャットの履歴を消去しますか?')) return;
              resetChat();
              const g = greetingReply(ctx);
              g.texts.forEach((t) => pushChat({ role: 'coach', text: t }));
              setChips(g.chips);
            }}
          >
            履歴を消す
          </button>
        )}
      </div>

      <p className="small muted" style={{ marginBottom: 12 }}>
        あなたのカルテ・タイプ・相性・試合データから答えます。データは端末内のみ・外部送信はありません。
        <br />
        応答エンジン: <b style={{ color: 'var(--accent)' }}>{useDevice ? '端末のAI' : 'かんたん応答'}</b>
        {settings.chatEngine === 'device' && !deviceAISupported() && '（この端末は内蔵AI非対応のため、かんたん応答で動作）'}
        <span className="muted">（設定で変更できます）</span>
      </p>

      {/* メッセージ */}
      <div className="chat-list">
        {chat.map((m) => (
          <div key={m.id} className={`bubble ${m.role === 'me' ? 'bubble-me' : 'bubble-coach'}`}>
            {m.text}
          </div>
        ))}
        {thinking && (
          <div className="bubble bubble-coach typing" aria-label="コーチが入力中">
            <span /><span /><span />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* 入力バー(下部に固定) */}
      <div className="chat-input-bar">
        {notice && (
          <p className="small" style={{ color: 'var(--accent)', marginBottom: 8 }}>{notice}</p>
        )}
        {chips.length > 0 && !thinking && (
          <div className="chat-chips">
            {chips.map((c) => (
              <button key={c} className="chat-chip" onClick={() => send(c)}>{c}</button>
            ))}
          </div>
        )}
        <div className="chat-input-row">
          <textarea
            rows={1}
            value={draft}
            placeholder={thinking ? 'コーチが考えています…' : 'コーチに相談する… (例: 弱点は？)'}
            aria-label="メッセージ入力"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); }
            }}
            style={{ resize: 'none', maxHeight: 120 }}
          />
          <button className="btn btn-primary" style={{ flexShrink: 0 }} disabled={!draft.trim() || thinking} onClick={() => send(draft)}>
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
