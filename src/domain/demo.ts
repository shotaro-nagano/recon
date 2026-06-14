/* ============================================================
   デモデータ生成器(シード付き乱数で毎回同じ選手像を再現)
   選手像: PHANTOM-Ω 寄り — 攻め(A)・勝負強い(C)・変化(V)・後半型(L)
   弱点: バック前(1)へのサーブに対する失点率が高い
   診断は JOKER-Ω と答えており、実測とのギャップ演出が見える
   ============================================================ */
import type {
  Approval, CoachingMemo, CollapseLoop, Course, DiagnosisAnswers, Match,
  OpponentKarte, PracticeAssignment, PracticeLogEntry, RallyRow, SelfKarte,
  ServeType, SessionLog, Settings, TendencyEntry,
} from './types';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SERVES: ServeType[] = ['ロング', 'ショート下', 'ショートナックル', '巻き込み', 'YG', '横回転'];

function isoDaysAgo(today: string, days: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function simulateMatch(
  rng: () => number, id: string, date: string,
  opponentId: string, opponentName: string, tournament: string, approved: boolean,
): Match {
  const rallies: RallyRow[] = [];
  let mySets = 0; let oppSets = 0; let setNo = 0;
  while (mySets < 3 && oppSets < 3) {
    setNo += 1;
    let my = 0; let opp = 0;
    const meServesFirst = setNo % 2 === 1;
    while (!((my >= 11 || opp >= 11) && Math.abs(my - opp) >= 2) && my + opp < 30) {
      const total = my + opp;
      const deuce = my >= 10 && opp >= 10;
      const servePairIndex = deuce ? total : Math.floor(total / 2);
      const meServes = (servePairIndex % 2 === 0) === meServesFirst;

      // 多彩なサーブ(V) — 状況で球種を散らす
      const serveType = SERVES[Math.floor(rng() * SERVES.length)];
      let serveCourse = (1 + Math.floor(rng() * 6)) as Course;
      if (!meServes && rng() < 0.3) serveCourse = 1; // 相手はバック前を多めに突いてくる

      let rallyLength = 1 + Math.floor(rng() * 3) + Math.floor(rng() * 4);
      const thirdBallAttack = meServes && rallyLength >= 3 && rng() < 0.5;

      // 勝率モデル: ベース52% / 終盤(L)・クラッチ(C)で上振れ / バック前レシーブが弱点
      let p = 0.52;
      const late = Math.max(my, opp) >= 8;
      const clutch = Math.max(my, opp) >= 9;
      const early = my <= 5 && opp <= 5;
      if (late) p += 0.05;
      if (clutch) p += 0.05;
      if (early) p -= 0.05;
      if (meServes && thirdBallAttack) p += 0.1;
      if (!meServes && serveCourse === 1) p -= 0.16; // 弱点
      const winner: 'me' | 'opp' = rng() < p ? 'me' : 'opp';

      rallies.push({
        set: setNo, myScore: my, oppScore: opp,
        server: meServes ? 'me' : 'opp',
        serveType, serveCourse,
        rallyLength: Math.max(thirdBallAttack ? 3 : 1, rallyLength),
        thirdBallAttack, winner,
      });
      if (winner === 'me') my += 1; else opp += 1;
    }
    if (my > opp) mySets += 1; else oppSets += 1;
  }
  return {
    id, date, opponentId, opponentName, tournament,
    mySets, oppSets, source: 'デモ', approved,
    approvedAt: approved ? date : undefined,
    rallies,
  };
}

export interface DemoData {
  settings: Settings;
  diagnosis: DiagnosisAnswers;
  matches: Match[];
  opponents: OpponentKarte[];
  karte: SelfKarte;
  approvals: Approval[];
  sessions: SessionLog[];
}

export function buildDemoData(today: string): DemoData {
  const rng = mulberry32(20260613);

  const opponents: OpponentKarte[] = [
    {
      id: 'opp-mishima', name: '三島 蓮', affiliation: '県立北高',
      provisionalCodename: 'FORTRESS', provisionalVariant: 'alpha', judgedPt: 96,
      serveTendency: ['下回転ショートをミドル前(2)に集中(58%)[31pt]'],
      receiveHoles: ['フォア奥(6)へのロングサーブにブロック一辺倒[14pt]'],
      clutchHabits: ['競ると同じ下回転ショートに固める(終盤の球種が1つに減る)[12pt]'],
      notes: [{ date: isoDaysAgo(today, 18), tournament: '県リーグ', text: '3-2勝ち。終盤のフォア奥ロングが効いた' }],
    },
    {
      id: 'opp-hayakawa', name: '早川 周', affiliation: '私立南高',
      provisionalCodename: 'BULLET', provisionalVariant: 'alpha', judgedPt: 41,
      serveTendency: ['ロングサーブをバック奥(4)に集中(64%)[25pt]'],
      receiveHoles: ['巻き込みサーブへのレシーブが浮く[9pt] ※暫定'],
      clutchHabits: ['序盤に飛ばし、第3セット以降は失速傾向[16pt]'],
      notes: [{ date: isoDaysAgo(today, 32), tournament: '市民大会', text: '3-1勝ち。序盤2セットは取られかけた' }],
    },
    {
      id: 'opp-yuki', name: '結城 真央', affiliation: '青葉学園',
      provisionalCodename: 'SNIPER', provisionalVariant: 'omega', judgedPt: 28,
      serveTendency: ['横回転を3コースに散らす(暫定)[18pt]'],
      receiveHoles: ['データ不足 — 次戦で要観察'],
      clutchHabits: ['カウンター待ちが増える(暫定)[10pt]'],
      notes: [{ date: isoDaysAgo(today, 11), tournament: '練習試合', text: '2-3負け。こちらの強打をカウンターされた' }],
    },
  ];

  const schedule: { days: number; opp: number; t: string; approved: boolean }[] = [
    { days: 44, opp: 1, t: '市民大会', approved: true },
    { days: 39, opp: 0, t: '練習試合', approved: true },
    { days: 32, opp: 1, t: '市民大会', approved: true },
    { days: 25, opp: 0, t: '県リーグ', approved: true },
    { days: 18, opp: 0, t: '県リーグ', approved: true },
    { days: 11, opp: 2, t: '練習試合', approved: true },
    { days: 5, opp: 2, t: '練習試合', approved: true },
    { days: 2, opp: 1, t: '県リーグ', approved: false }, // 承認フロー体験用
  ];
  const matches = schedule.map((s, i) =>
    simulateMatch(
      rng, `demo-m${i + 1}`, isoDaysAgo(today, s.days),
      opponents[s.opp].id, opponents[s.opp].name, s.t, s.approved,
    ),
  );

  const tendencies: TendencyEntry[] = [
    {
      id: 'demo-t1', key: 'receive-loss:c1',
      text: 'バック前(1)へのサーブに対する失点率62%',
      pt: 31, value: 0.62, ci: 0.17, status: 'confirmed',
      firstSeen: isoDaysAgo(today, 39), lastSeen: isoDaysAgo(today, 5),
    },
    {
      id: 'demo-t2', key: 'late-serve-fix',
      text: '8-8以降、自分のサーブが下回転ショートに固まる可能性[8pt]',
      pt: 8, status: 'observed',
      firstSeen: isoDaysAgo(today, 18), lastSeen: isoDaysAgo(today, 5),
    },
    {
      id: 'demo-t3', key: 'receive-loss:c4',
      text: 'バック奥(4)へのロングサーブに対する失点率58% → 練習で解消',
      pt: 22, value: 0.58, ci: 0.2, status: 'resolved',
      firstSeen: isoDaysAgo(today, 44), lastSeen: isoDaysAgo(today, 25),
      resolvedAt: isoDaysAgo(today, 11), resolvedBy: 'ロングサーブ待ちの足運び練習',
    },
  ];

  const loops: CollapseLoop[] = [
    {
      id: 'demo-l1',
      trigger: 'バック前(1)を2本連続で突かれる',
      middle: 'レシーブが浮く → 強打される',
      result: '3連続失点でセットを落とす',
      occurrences: 4, matches: 7, avgLost: 3.2,
      escapeAction: '一度ロングサーブに切り替えて時間を作り、台から距離を取る',
    },
  ];

  const memos: CoachingMemo[] = [
    {
      id: 'demo-memo1', date: isoDaysAgo(today, 25),
      text: '第2セットから膝に違和感(本人申告)',
      effect: '当該試合の後半データはほころび判定から除外',
    },
    {
      id: 'demo-memo2', date: isoDaysAgo(today, 11),
      text: '巻き込みサーブは現在試作中(本人申告)',
      effect: '巻き込みサーブの失点は弱点認定しない',
    },
  ];

  const practiceLog: PracticeLogEntry[] = [
    { id: 'demo-p1', date: isoDaysAgo(today, 21), drill: 'バック前ストップ→フォア展開', successRate: 0.48 },
    { id: 'demo-p2', date: isoDaysAgo(today, 14), drill: 'バック前ストップ→フォア展開', successRate: 0.62 },
    { id: 'demo-p3', date: isoDaysAgo(today, 7), drill: 'バック前ストップ→フォア展開', successRate: 0.71 },
  ];

  const assignments: PracticeAssignment[] = [
    {
      id: 'demo-a1', date: isoDaysAgo(today, 7),
      menu: 'バック前ストップからの先手展開(1本目を浮かさない)',
      status: '検証待ち',
    },
  ];

  const karte: SelfKarte = {
    tendencies, loops, memos, practiceLog, assignments,
    missingMatches: [
      { id: 'demo-miss1', date: isoDaysAgo(today, 28), opponentName: '矢野 圭', reason: '撮影失敗' },
    ],
    typeHistory: [
      {
        date: isoDaysAgo(today, 21).slice(0, 7),
        codename: 'JOKER', variant: 'omega', stage: 'provisional',
      },
      {
        date: isoDaysAgo(today, 11).slice(0, 7),
        codename: 'PHANTOM', variant: 'omega', stage: 'measured',
      },
    ],
  };

  const diagnosis: DiagnosisAnswers = {
    style: 'シェーク裏裏', grip: '右シェーク', selfRating: 2,
    q4: 'a', q5: 'a', q6: 'b', q7: 'b', // → JOKER-Ω(仮)。実測はPHANTOM-Ω
    answeredAt: isoDaysAgo(today, 21),
  };

  const settings: Settings = {
    playerName: '悠真',
    onboarded: true,
    tourSeen: true,
    simpleMode: false, // デモは全機能を見せる
    chatEngine: 'rule',
    persona: 'operator',
    skin: 'A',
    operationStartDate: isoDaysAgo(today, 21), // β校正期間中
    offseason: false,
    menuGranularity: 'ふわっと',
  };

  const approvals: Approval[] = [];

  const sessions: SessionLog[] = [
    {
      id: 'demo-s1', date: isoDaysAgo(today, 5), mode: '試合後',
      summary: 'vs結城戦の分析。カウンター対策として強打のコース散らしを提案。バック前の課題は継続観察。',
    },
    {
      id: 'demo-s2', date: isoDaysAgo(today, 7), mode: '週次',
      summary: '練習メニュー: バック前ストップ→フォア展開を最優先。成功率71%まで改善、次戦で検証予定。',
    },
  ];

  return { settings, diagnosis, matches, opponents, karte, approvals, sessions };
}
