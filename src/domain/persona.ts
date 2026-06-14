/* ============================================================
   ペルソナ口調エンジン (prompts/coach.md 準拠)
   鉄則・モード・出力書式は全ペルソナ共通。変わるのは語り口だけ。
   ============================================================ */
import type { Persona } from './types';

type LineKind =
  | 'greet'        // 呼びかけ
  | 'preMatch'     // 試合前の送り出し
  | 'postGood'     // 良かったデータの前置き
  | 'postIssue'    // 課題に入る前置き
  | 'weekly'       // 週次の前置き
  | 'dataGrow'     // データ残高の提示
  | 'encourage'    // 締め
  | 'deferHuman';  // 人間の指導を優先

interface Ctx {
  name?: string;
  codename?: string;
  pt?: number;
  extra?: string;
}

const LINES: Record<Persona, Record<LineKind, (c: Ctx) => string>> = {
  operator: {
    greet: (c) => `${c.codename ?? c.name ?? 'プレイヤー'}、状況を共有する。`,
    preMatch: () => `作戦は以上だ。コートでは迷うな — 迷ったら⑤に戻れ。`,
    postGood: () => `まず確認すべきデータがある。`,
    postIssue: () => `次に、修正対象を報告する。`,
    weekly: () => `今週の収支を報告する。`,
    dataGrow: (c) => `現在${c.pt}pt。${c.extra ?? ''}`,
    encourage: () => `以上だ。次の任務で会おう。`,
    deferHuman: () => `この件は現場の判断が上だ。監督・コーチの指示を優先しろ。`,
  },
  passion: {
    greet: (c) => `よし${c.name ?? ''}、顔上げていくぞ!`,
    preMatch: () => `準備はできてる! 自分のゲームをやり切れば結果はついてくるぞ!`,
    postGood: () => `まずはこれを見ろ、今日一番の収穫だ!`,
    postIssue: () => `その上で、次に強くなれるポイントはここだ!`,
    weekly: () => `今週もよくやった! 振り返るぞ!`,
    dataGrow: (c) => `データは${c.pt}ptまで貯まった! ${c.extra ?? ''}`,
    encourage: () => `お前なら必ず伸びる。明日もコートで会おう!`,
    deferHuman: () => `そこは監督やコーチに直接ぶつけてこい! それが一番の近道だ!`,
  },
  analyst: {
    greet: (c) => `${c.name ?? 'プレイヤー'}さん。データを確認します。`,
    preMatch: () => `以上が分析結果です。実行判断は本人に委ねます。`,
    postGood: () => `まず、ポジティブな観測値から。`,
    postIssue: () => `続いて、改善余地のある観測値です。`,
    weekly: () => `今週分の集計です。`,
    dataGrow: (c) => `現在${c.pt}pt。${c.extra ?? ''}`,
    encourage: () => `以上です。データは嘘をつきません。`,
    deferHuman: () => `この領域は本システムの対象外です。監督・コーチ・トレーナーへの相談を推奨します。`,
  },
};

export function voice(persona: Persona) {
  return (kind: LineKind, ctx: Ctx = {}) => LINES[persona][kind](ctx);
}

/** 扱わない領域(鉄則3): フォーム細部 / 体調・怪我・疲労 / 深いメンタル相談 */
export const OUT_OF_SCOPE_NOTICE =
  'フォームの細部・体調や怪我・深いメンタル相談はAIの担当外。監督・コーチ・トレーナーに相談を。';
