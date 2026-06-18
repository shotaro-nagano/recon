/* ============================================================
   練習メニュー — ドリルライブラリ(純データ + 優先度ロジック)
   ① 練習メニュータブが使用。ユーザーは「強み(strong)」か「弱点(weak)」を
   選ぶだけ。選択に応じてカテゴリの優先順位が変わり、メニューを提示する。
   入力はこれ以上不要(本数・狙いはドリル側に内包)。
   ============================================================ */

/** 練習フォーカス: 強みを伸ばす / 弱点を埋める */
export type PracticeFocus = 'strong' | 'weak';

/** フォーカス選択の記録(裏DB) — いつ何を選んだかを残す */
export interface PracticeFocusEntry {
  id: string;
  date: string;
  focus: PracticeFocus;
}

export interface Drill {
  /** 冒頭の数語で意味が取れる短い名前 */
  name: string;
  /** 供給・狙い・意識点を1文で */
  detail: string;
}

export type DrillCategoryKey =
  | 'multiball' | 'footwork' | 'task' | 'serve' | 'receive' | 'overtable' | 'system';

export interface DrillCategory {
  key: DrillCategoryKey;
  label: string;
  /** カテゴリの狙い(1行) */
  aim: string;
  drills: Drill[];
}

/* ---- 7カテゴリ × 10ドリル ---- */

export const DRILL_CATEGORIES: DrillCategory[] = [
  {
    key: 'multiball',
    label: '多球練習',
    aim: '同じ球を反復して打球の質とフォームを固める',
    drills: [
      { name: 'フォアドライブ定点', detail: 'フォア側に下回転を1点供給→全球Fドライブでクロス。打点(頂点前)と腰の回転を固定。' },
      { name: 'バックドライブ定点', detail: 'バック側に下回転を1点供給→Bドライブをクロス・ストレートに打ち分け。肘を支点に前腕で振る。' },
      { name: '2点回り込み', detail: 'バックとミドルへ交互供給→全てFドライブ。戻りの一歩目を速く。' },
      { name: 'オールフォア(3点)', detail: 'フォア半面〜全面に散らす→全球Fドライブ。回り込み多用で決定力。' },
      { name: 'フォア・バック切り替え', detail: '両サイドに1本ずつ交互供給→FD/BD連続切り替え。上体の入れ替え。' },
      { name: 'ツッツキ→ドライブ', detail: '短い下回転と長い下回転を交互→台上ツッツキ後に下がってドライブ。前後の重心移動。' },
      { name: 'ブロック→カウンター', detail: '速い上回転を連続供給→ブロックで繋ぎチャンスでカウンター。緩急対応。' },
      { name: 'ミドル処理', detail: 'ボディへ集中供給→フォアかバックか瞬時判断。肘を抜いて一歩横へ。' },
      { name: 'ロビング粘り', detail: '強打を供給→下がってロビングで粘りチャンスで反撃。後陣の粘りと反撃判断。' },
      { name: '決定打(スマッシュ)', detail: '浮いたチャンス球を供給→強打で両サイド打ち分け。コース精度。' },
    ],
  },
  {
    key: 'footwork',
    label: 'フットワーク練習',
    aim: '動きの中で安定して打つ — 一歩目と戻りを速く',
    drills: [
      { name: '左右2点(フォア)', detail: 'バックとフォアへ交互ブロック→全球Fドライブ。サイドステップで戻り徹底。' },
      { name: 'フォア・バック切り替え', detail: '両サイドへ1本ずつ→FD/BDで処理。最短の体重移動。' },
      { name: '回り込み→飛びつき', detail: 'バックを回り込みFD→フォアサイドへ飛びつきFD。一歩目の方向転換。' },
      { name: '三角(ミドル⇔フォア⇔バック)', detail: '3点に散らされた球を処理。クロスステップ活用。' },
      { name: 'バック規則・フォアフリー', detail: '相方はバック固定、自分はFDコース自由。決め球の選択＋戻り。' },
      { name: '前後フットワーク', detail: '短いツッツキと長い球を交互→台に入る/下がる。前後の重心移動。' },
      { name: 'シャドープレー', detail: '球なしでフォア・バック・回り込みを連続。フォームと足を連動。' },
      { name: 'マーカー往復', detail: '床の目印をサイドステップで往復＋素振り。下半身の素早さ。' },
      { name: 'ランダム2〜3点', detail: 'ランダム送球→判断して動く。読みと反応。' },
      { name: 'フォア大振り飛びつき', detail: 'バック→大きくフォアサイド→戻りを連続。守備範囲を広く。' },
    ],
  },
  {
    key: 'task',
    label: '課題練習',
    aim: '相方とルール付きラリー — 実戦に近い形で技を磨く',
    drills: [
      { name: 'フォアクロス連打', detail: '互いにFドライブでクロス連打。安定して続ける。' },
      { name: 'バッククロス連打', detail: 'BD同士でクロス連打。ピッチを上げても崩れない。' },
      { name: 'ブロック対ドライブ', detail: '片方固定ブロック、片方コース自由ドライブ→交代。威力と安定。' },
      { name: 'ツッツキ→ドライブ', detail: 'レシーブ役は必ずツッツキ、サーブ役が3球目ドライブ→ラリー。下回転打ち精度。' },
      { name: 'フォア半面オール', detail: 'フォア半面のみでフリーラリー。狭い範囲の連続フットワーク。' },
      { name: 'ストレート規則', detail: '互いにストレートのみでドライブ/ブロック。コース精度。' },
      { name: '1本フォア1本バック', detail: '交互に送る→もう片方が切り替え。切り替えの安定。' },
      { name: 'ミドル攻め', detail: '片方が必ずミドルへ、もう片方が処理。ミドル対応の習熟。' },
      { name: '三球目固定', detail: 'サーブ→決めたレシーブ→3球目攻撃まで反復。パターン精度。' },
      { name: '条件付きゲーム', detail: '「3球目までに必ず1回ドライブ」等の条件付き試合。実戦適用。' },
    ],
  },
  {
    key: 'serve',
    label: 'サーブ練習',
    aim: '同じモーションから散らす — 3球目までを一連で',
    drills: [
      { name: '下回転ショート(フォア前)', detail: 'フォア前へ2バウンドで短く。低く短く回転量。' },
      { name: '下回転ロング(バック深)', detail: 'バックエンド際へ速い下回転。長さとスピードで差し込む。' },
      { name: '横下回転(YG/巻き込み)', detail: 'フォア前/バック前へ横下。見分けにくさ＋低さ。' },
      { name: 'ナックル短い', detail: '下回転と同モーションで無回転。レシーブを浮かせる。' },
      { name: '上回転ロング(フェイク)', detail: '下回転モーションから上回転ロング。緩急でミス誘発。' },
      { name: '3点打ち分け', detail: '同モーションでフォア前/ミドル/バック深を打ち分け。フォーム統一。' },
      { name: 'しゃがみ込み/変化系', detail: '回転量を最大化。3球目前提で。' },
      { name: '長短ミックス', detail: '短い下回転と速いロングを交互。長短の揺さぶり。' },
      { name: 'サーブ→3球目イメージ', detail: 'サーブ後に3球目ドライブの動きまで。攻撃の一連。' },
      { name: 'ターゲット当て', detail: '台上に目標物を置き狙う。精密コントロール。' },
    ],
  },
  {
    key: 'receive',
    label: 'レシーブ練習',
    aim: '低く・速く・散らす — 先に攻められない返球',
    drills: [
      { name: 'ストップ(短く)', detail: '下回転短サーブを2バウンドで止める。台から出さない。' },
      { name: '払い(深く)', detail: '下回転を素早く深く長く払う。エンドライン際を突く。' },
      { name: 'フリック', detail: '短い下回転/ナックルを弾いて先制。手首スナップと打点。' },
      { name: 'チキータ', detail: '台上バックで巻いて先制。回転をかけ深く。' },
      { name: '回り込みレシーブ', detail: 'バック前の短球を回り込みフォア処理。一歩踏み込み。' },
      { name: 'ロングをドライブ', detail: '速いロングサーブをドライブで反撃。差し込まれない姿勢。' },
      { name: '回転の見極め', detail: '横下/横上を見分け角度調整。回転判断精度。' },
      { name: 'レシーブ→4球目', detail: 'レシーブ後の返球を予測しブロック/カウンター。展開力。' },
      { name: 'コース変化', detail: '同じサーブをストレート/クロス/ミドルへ返し分け。主導権を握る。' },
      { name: 'ランダム実戦', detail: '回転・コース・長短をランダムに→最適レシーブ。総合判断。' },
    ],
  },
  {
    key: 'overtable',
    label: '台上技術練習',
    aim: '台の上で先手を取る — 低さとタッチ、3択判断',
    drills: [
      { name: 'ストップ精度', detail: '下回転を2バウンドで短く止める。低く台から出さない。' },
      { name: 'ダブルストップ', detail: '相手のストップにストップ返し。タッチ感覚。' },
      { name: 'フォアフリック', detail: 'フォア前を弾く。打点と方向。' },
      { name: 'チキータ連続', detail: '連続チキータ。安定と回転量。' },
      { name: '逆チキータ/バックフリック', detail: 'バック前を逆方向へ。コースの意外性。' },
      { name: 'ツッツキ長短', detail: '短いツッツキと払いを交互。長短の差。' },
      { name: '流し(横回転ツッツキ)', detail: '横回転を混ぜる。相手ドライブを狂わせる。' },
      { name: '台上一発(フォア)', detail: '浮いた台上球をミニスマッシュ。チャンス見極め。' },
      { name: '3択処理', detail: 'ストップ/ツッツキ/フリックをランダム判断。判断力。' },
      { name: '台上→展開', detail: '台上処理後に下がる/攻めるを予測。連動。' },
    ],
  },
  {
    key: 'system',
    label: 'システム・戦術練習',
    aim: 'パターンで点を取る — サーブ起点〜決め球まで',
    drills: [
      { name: 'サーブ→3球目FD', detail: '下回転短サーブ→ツッツキ→回り込みFドライブ。' },
      { name: 'サーブ→3球目BD', detail: 'バック前サーブ→チキータ/ツッツキ→BD。' },
      { name: 'ロングサーブ→カウンター', detail: '速いロング→相手の攻撃をカウンター。' },
      { name: 'チキータ→4球目', detail: 'チキータ先制→相手ブロック→4球目で連打。' },
      { name: 'ストップ→ブロック→反撃', detail: '台上で短く→相手の長球をブロック→チャンスで攻撃。' },
      { name: '両ハンド連続', detail: '3球目BD→4球目FDの連続。' },
      { name: 'ミドル戦術', detail: 'ミドルで詰まらせ空いたサイドを攻める。' },
      { name: '緩急パターン', detail: 'つなぎループ→次にスピードドライブ。' },
      { name: '前後揺さぶり', detail: '短いストップ→深い攻撃で前後に動かす。' },
      { name: '競り合い(9-9想定)', detail: 'デュース場面を得意パターンで決める練習ゲーム。' },
    ],
  },
];

export const DRILL_CATEGORY_MAP: Record<DrillCategoryKey, DrillCategory> =
  Object.fromEntries(DRILL_CATEGORIES.map((c) => [c.key, c])) as Record<DrillCategoryKey, DrillCategory>;

/* ---- フォーカス別の優先順位 ---- */

interface FocusOrder {
  /** 優先順(先頭ほど高優先) */
  order: DrillCategoryKey[];
  /** カテゴリごとの「なぜ今これか」 */
  reason: Partial<Record<DrillCategoryKey, string>>;
}

const FOCUS_ORDER: Record<PracticeFocus, FocusOrder> = {
  strong: {
    order: ['multiball', 'system', 'serve', 'footwork', 'task', 'overtable', 'receive'],
    reason: {
      multiball: '武器を1本に固める。決定力を伸ばす反復から。',
      system: 'サーブ起点〜決め球をパターン化して再現性を上げる。',
      serve: '得点源のサーブを磨き、3球目までを一連にする。',
      footwork: '武器を打ち切るための足。動きの中でも質を落とさない。',
    },
  },
  weak: {
    order: ['receive', 'overtable', 'task', 'footwork', 'system', 'serve', 'multiball'],
    reason: {
      receive: '先に攻められないレシーブから。低く・速く・散らす。',
      overtable: '台上で後手に回らない。ストップとタッチ、3択判断。',
      task: 'ルール付きラリーで弱い局面を実戦に近い形で反復。',
      footwork: '届かない・詰まるを減らす。守備範囲と戻りを広げる。',
    },
  },
};

export interface PracticeMenuSection {
  category: DrillCategory;
  /** 1 = 最優先 */
  priority: number;
  /** なぜ今このカテゴリか */
  reason: string;
  /** まず取り組む推奨ドリル(上位3) */
  recommended: Drill[];
}

/**
 * 選択(strong/weak)に応じて優先度付きの練習メニューを組み立てる純関数。
 * ユーザー入力はフォーカス選択のみ。
 */
export function buildPracticeMenu(focus: PracticeFocus): PracticeMenuSection[] {
  const fo = FOCUS_ORDER[focus];
  return fo.order.map((key, i) => {
    const category = DRILL_CATEGORY_MAP[key];
    return {
      category,
      priority: i + 1,
      reason: fo.reason[key] ?? category.aim,
      recommended: category.drills.slice(0, 3),
    };
  });
}

export const FOCUS_LABEL: Record<PracticeFocus, string> = {
  strong: '強みを伸ばす',
  weak: '弱点を埋める',
};
