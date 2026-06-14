# CODENAME COACH — 画面実装契約書

このドキュメントは各画面を実装するエージェント向けの**唯一の契約**である。
ここに書かれたAPI・デザイン規則・画面仕様に従い、**割り当てられたファイルのみ**を作成すること。
共有ファイル(App.tsx / store / domain / components / styles)は**編集禁止**(自分専用の `src/domain/coach/*.ts` の新規作成は可)。

## プロダクト概要

卓球選手本人専用のAIコーチPWA「CODENAME COACH」。
承認済み試合データから16タイプ(8コードネーム×α/Ω)を実測し、選手カルテが育つ。
UIテキストはすべて日本語。数値には必ず `[サンプル数pt]`(必要なら `±CI`)を併記する。

## 技術規約

- React 18 + TypeScript strict + react-router-dom v6。追加npm依存は**禁止**。
- インポートは `@/` エイリアス(例: `import { useAppStore } from '@/store/useAppStore'`)。
- 画面コンポーネントは **default export**。ファイル名と一致させる。
- 既存のCSSクラス(後述)とCSS変数を使う。新規グローバルCSSは書かない(必要なら inline style)。
- 日付は `todayStr()` を使う。IDは `uid()`。

## コアAPI

### ストア `@/store/useAppStore`

```ts
useAppStore(selector)  // zustand
uid(): string
todayStr(): string     // YYYY-MM-DD
selectApproved(s): Match[]          // 承認済み試合
selectPendingMatches(s): Match[]    // 未承認試合
selectPendingApprovals(s): Approval[]

// state: settings, diagnosis, matches, opponents, karte, approvals, sessions, snapshots, hydrated
// actions:
setSettings(p: Partial<Settings>)
completeDiagnosis(answers: DiagnosisAnswers)   // 仮タイプ付与+運用開始日設定
addMatch(m: Match)                              // 未承認として追加
approveMatch(id)                                // 承認→自動パイプライン(確定タグ提案等が approvals に積まれる)
rejectMatch(id, reason?)                        // 不採用→未取込リストへ
deleteMatch(id)
resolveApproval(id, accept: boolean)            // 要確認の承認/見送り
updateKarte(reason, mutate(karte))              // スナップショット付きカルテ更新
rollbackTo(snapshotId)
upsertOpponent(o: OpponentKarte)
addPracticeLog(e: PracticeLogEntry)
appendSession({date, mode, summary})            // セッション要約ログ(対話の終わりに追記)
loadDemo() / resetAll()
```

### 型 `@/domain/types`

主要型: `Match, RallyRow, Course(1-6), ServeType, DiagnosisAnswers, TypeResult, AxisResult, SelfKarte, TendencyEntry(status: observed|confirmed|resolved), CollapseLoop, CoachingMemo, PracticeLogEntry, PracticeAssignment, OpponentKarte, Approval, SessionLog, Settings, Persona, Skin, CodenameKey, Variant('alpha'|'omega'), MatchupResult`

### 定数 `@/domain/constants`

`CODENAMES`(8タイプ定義: style/winPattern/color/motif), `CODENAME_KEYS`, `AXIS_INFO`, `COURSE_LABELS`(1=バック前…6=フォア奥), `SERVE_TYPES`, `PERSONA_INFO`, `SKIN_INFO`, `STYLE_OPTIONS`, `GRIP_OPTIONS`, `MEASURED_MIN_MATCHES`(=5)

### エンジン

```ts
// @/domain/typeEngine
computeTypeResult(approvedMatches, diagnosis, settings, today): TypeResult
  // stage: 'none'(未診断) | 'provisional'(仮) | 'measured'(実測, 承認5試合以上)
provisionalType(diagnosis): {codename, variant}
selfGap(diagnosis, result)  // Q3自己評価と実測クラッチのギャップ {text,...}|null
isBeta(settings, today): boolean   // β校正期間か

// @/domain/axisEngine
computeAxes(approved): AxisResult[]   // {axis,score(0-100),ci,pole,boundary,pt}
computeClutch(approved): {diff,pt,ci}|null
totalPt(approved): number

// @/domain/insights
serveStats(approved): {serveType,mainCourse,count,winRate,ci}[]      // サーブ別成績(直近5試合)
courseLossStats(approved): {course,label,count,lossRate,ci}[]        // コース別失点(レシーブ)
axisTrend(approved): {endDate, axes: AxisResult[]}[]                  // 軸スコア推移
bestDataOfMatch(m: Match): {text, pt}                                 // その試合の良かったデータ

// @/domain/compatibility
matchup(self:{codename,variant}, opp:{codename,variant?}, history?:{matches,opponents}): MatchupResult
  // {symbol:'◎○●▲×', score, notes[], sampleSize} — sampleSize 0なら「理論値」と必ず明示
SYMBOL_LABEL: Record<symbol, '有利'|...>
fullTable(): 8×8理論表

// @/domain/persona
voice(persona)(kind, ctx) // kind: greet|preMatch|postGood|postIssue|weekly|dataGrow|encourage|deferHuman
OUT_OF_SCOPE_NOTICE        // 扱わない領域の定型文

// @/domain/csv
parseMatchCsv(text, id): {match|null, errors[]}
serializeMatchCsv(m): string
CSV_TEMPLATE: string

// @/domain/stats
fmtRate(p, pt, ci?): "62%[31pt, ±17%]"
fmtDiff(d, pt, ci?): "+7%[28pt, ±15%]"

// @/domain/accent
typeColor(codename): string
```

### コンポーネント

```tsx
// @/components/ui
<Screen title right?>{children}</Screen>     // 画面ラッパー(タイトルはOswald表示)
<Card accent?>...</Card>
<SectionLabel>...</SectionLabel>
<EmptyState title hint? action? />           // 空状態は誘いにする
<TypeBadge codename variant? beta? boundaryWith? />
<CourseBadge course />                        // 1-6の六角バッジ
<Segmented options value onChange />
<Sparkline values color? width? height? min? max? />
<ApprovalCard approval onResolve />           // 要確認カード(全画面共通の承認UI)
<AxisBar label loLabel hiLabel score ci pt boundary />
codenameDesc(codename): string

// @/components/Emblem (default)
<Emblem codename? variant? stage size? reveal? />  // reveal=確定の瞬間のみtrue

// @/components/PrecisionMeter (default)
<PrecisionMeter result={typeResult} />
```

## デザイン規則 (DESIGN.md「ナイトゲーム」— 厳守)

- 背景 `var(--night-court)`、カード `var(--deep-court)`、テキスト `var(--court-line)`、補助 `var(--line-dim)`、アクセント `var(--accent)`(タイプ色が自動浸透)。**独自の色を発明しない**。
- 見出しは `.display`(Oswald・大文字)。**見出し以外にOswaldを使わない**。
- pt数・%・スコア等の数値は必ず `.mono`。
- 角丸8px・影なし・グラデーション/走査線/グリッド演出**禁止**。
- 区切りは `.divider`(25%)、強調区切りのみ `.divider-strong`。
- ボタンは `.btn` / `.btn-primary` / `.btn-ghost`。文言は動詞(「カルテを更新」「明日見る」)。
- エラーは原因と次の行動を書く。空状態は `EmptyState` で誘いにする。
- 出現アニメは `.fade-in` のみ。**戦術カード画面はアニメ完全禁止**(`.tactical-root` で自動無効化される)。

## コーチの鉄則 (全画面共通)

1. 1回の助言で提案は**3つまで**・必ず優先順位をつける
2. 「観察中」の傾向は**「可能性」と表現**し断定しない(確定タグのみ断定可)
3. フォーム細部/体調・怪我/深いメンタル → `voice(p)('deferHuman')` + `OUT_OF_SCOPE_NOTICE`
4. データにない推測で相手を分析しない。相性助言には必ず[対戦サンプル数]併記(0なら「理論値」)
5. 未取込試合(`karte.missingMatches`)がある期間の傾向は「暫定」と明示
6. 数値には必ず[pt]を併記(`fmtRate`/`fmtDiff`を活用)
7. ペルソナ(settings.persona)で語り口だけ変える。内容・書式は共通(`voice()`を使う)

---

# 画面仕様

## HomeScreen (`src/screens/HomeScreen.tsx`)

ホーム = 選手の「現在地」。上から:
1. **エンブレム+コードネーム**: `Emblem`(size 120程度) + `TypeBadge`(β表示含む) + `codenameDesc`。
   - stage='none': シルエット+「診断を受けてコードネームを解析しよう」→ `/diagnosis` への `.btn-primary`
   - stage='provisional': 仮タイプ表示 + 「実測まであと{5-matchCount}試合」
   - stage='measured': 実測タイプ + 境界帯なら `boundaryWith` を正直に複合表示
2. **精度メーター**: `<PrecisionMeter result>` をカードで
3. **要確認**: `selectPendingApprovals` を `ApprovalCard` で列挙(承認は `resolveApproval`)
4. **未承認の試合**: `selectPendingMatches` があれば「承認待ちの試合が{n}件」→ `/matches` リンク
5. **軸スコア**: 4軸を `AxisBar` で(stage measured/provisionalでデータがある時のみ)。`AXIS_INFO` 使用
6. **次のアクション**: 検証待ち assignment、今週の試合数、`/coach` への動線
- データ完全空のとき: デモデータの誘い(`loadDemo`)も小さく置く(「デモデータで試す」)

## DiagnosisScreen (`src/screens/DiagnosisScreen.tsx`)

オンボーディング診断(約2分)。1問ずつのウィザード形式(進捗表示 1/7)。
- Q1 戦型(`STYLE_OPTIONS`) / Q2 利き手とグリップ(`GRIP_OPTIONS`) / Q3 競り合いの自己評価(1-5、5段階ボタン)
- Q4 [A/S] 「相手のレシーブが浅く浮いた。9-9」 a.迷わず強打 / b.深く送って次で仕留める
- Q5 [V/R] 「得意サーブが2本連続で効かれた」 a.別のサーブに切替 / b.同じサーブの精度を上げ押し切る
- Q6 [F/L] 「自分の勝ちパターンに近いのは?」 a.序盤に飛ばして逃げ切る / b.様子を見て終盤に仕掛ける
- Q7 [C/N] 「10-10で自分のサーブ」 a.一番得意なサーブで勝負 / b.相手が嫌がりそうなサーブを探す
- 完了 → `completeDiagnosis` → **発表演出**: `Emblem reveal` + 仮タイプ名 + style/winPattern。
  すでに実測タイプがある場合(再受験)は「診断は実測タイプに影響しない。自己認識の変化として記録する」と明示し、実測とのギャップ(`selfGap`)を表示。
- 再受験はいつでも可(入口で「再受験」と分かる文言)。

## TacticalCardScreen (`src/screens/TacticalCardScreen.tsx`) + `src/domain/coach/preMatch.ts`

試合前モード。**スマホで試合直前に見る画面 — スクロールなし1画面・5項目以内・アニメ禁止**。
- ルート直下を `<div className="tactical-root">` で包む。
- 入口: 相手選択(既存 `opponents` から or 「初見の相手」or「データ最小」)。選択後にカード表示。
- カード書式(仕様書通り・1画面に収める。本文16px・各項目は冒頭の数語で意味が取れる書き方):
```
━━ 戦術カード vs {相手} ━━
相手タイプ: {CODENAME}-{α/Ω} [判定根拠 {n}pt] ※不明なら「初見」
① 攻め筋(相性+相手の失点パターン上位から)
② 警戒(相手の得点パターン)
③ 勝負どころ(9点以降)の方針
④ 基礎プラン(初見の相手なら最初の6本の情報収集手順)
⑤ 戻る場所: 崩れかけた時に戻る自分のサーブ・展開
```
- 分岐: a.相手カルテあり→`matchup`+実データで①②具体化 / b.初見→④中心・②は自分の勝ちパターン軸 / c.データ最小→⑤と崩壊ループ非突入チェックポイント中心
- ⑤は `karte.loops[].escapeAction` から生成。なければ得意サーブ(serveStats上位)から。
- `preMatch.ts` に生成ロジック(`buildTacticalCard(...)`)を分離。型を定義して画面は表示に徹する。
- 相性表示には `MatchupResult.notes`(理論値明示/α・Ω注記)を必ず添える。
- 画面下に小さく「オフライン保存済み — 会場で電波がなくても開けます」(PWAプリキャッシュ済みであることの説明)。
- 表示したら `appendSession({mode:'試合前', summary:...})` を1回だけ(useEffect+ref guard)。

## PostMatchScreen (`src/screens/PostMatchScreen.tsx`) + `src/domain/coach/postMatch.ts`

試合後モード。`/coach/post/:matchId?` — matchId未指定なら承認済み試合の選択リスト。
流れ(仕様書通り):
1. `voice('postGood')` + **良かったデータ1つ**(`bestDataOfMatch`)を必ず最初に
2. 惨敗チェック: セット0-3かつ得点率が低い場合 →「今すぐ見る / 明日見る」の選択を先に出す。
   「明日見る」→ 要点1行だけ表示して分析を畳む(state保持でOK)
3. ほころび・弱点・崩壊ループの分析: その試合のコース別失点(`courseLossStats`を単試合相当で計算するか、rallyから直接集計)、クラッチ、サーブ別。数値は`fmtRate`。観察中レベルは「可能性」表現
4. **「次の練習で1つだけやること」**(1項目のみ・`.btn-primary`で「練習リストに追加」→ `updateKarte`で `assignments` に追加)
5. カルテ更新案: `selectPendingApprovals` を `ApprovalCard` で(承認パイプラインが積んだもの)
6. 初見相手なら「相手カルテを作成」ボタン → `upsertOpponent` で3項目の雛形(サーブ傾向/レシーブの穴/勝負どころの癖、その試合の集計値を暫定[pt]付きで)
7. 終了時 `appendSession({mode:'試合後',...})`(ref guardで1回)
- 体調・試作の申告UI: 「この試合で伝えておくこと(任意)」テキスト入力 → 「コーチングメモとして提案」→ approvals に積む(`updateKarte`は使わず、要確認として)。※会話からの学習の v1 実装
  - 実装: store には直接 Approval を積むアクションがないため、`updateKarte('コーチングメモ追加', k=>k.memos.push(...))` で**本人入力=本人承認済み**として直接追加してよい(effectは空でよい)

## WeeklyScreen (`src/screens/WeeklyScreen.tsx`) + `src/domain/coach/weekly.ts`

週次モード。
1. **練習メニュー**(直近7日の試合から、優先順位つき・3項目まで)。
   生成前に粒度確認: `Segmented`「がっちり(本数・セット数まで)/ふわっと(テーマと狙いのみ)」(初期値 settings.menuGranularity、変更したら setSettings)
   メニュー根拠: 確定タグ・観察中(「可能性」表現)・直近試合の課題。各項目に[pt]併記
2. **解消報告**: `karte.tendencies` の resolved(成果の見える化、resolvedBy併記)
3. **軸スコア推移**: `axisTrend` を軸ごとに `Sparkline`。タイプ遷移(typeHistory)があれば祝う
4. **自己認識ギャップ**: `selfGap` の推移(現状値の表示でよい)
5. **β確認**: `isBeta` 中は「タイプ判定は実感と合っている?」→ 合っている/ズレている ボタン → `appendSession` に記録
6. **シーズンオフ**(settings.offseason): 試合データの代わりに `karte.practiceLog` の成功率推移(`Sparkline`)と「シーズン再開時に検証すべき項目」(assignments) 中心に切替
7. 表示時 `appendSession({mode:'週次',...})`(ref guard)
- 試合が1つもない週は practiceLog 中心の表示にフォールバック

## MatchesScreen (`src/screens/MatchesScreen.tsx`) + MatchDetailScreen (`src/screens/MatchDetailScreen.tsx`)

試合データ管理。
- 一覧: 日付降順。スコア(mySets-oppSets を `.mono`)、相手名、大会、ソース、承認状態(未承認は `accent` カードで上部に)
- **承認フロー**: 未承認試合カード→「内容を確認して承認」→ 詳細プレビュー(ラリー数・セットスコア・サーブ内訳の要約)→「承認する」(`approveMatch`)/「不採用にする」(`rejectMatch`→未取込リスト行きと説明)
- **インポート**: CSV貼り付け(textarea)+ファイル選択(`<input type=file accept=".csv,text/csv">`、FileReader)。`parseMatchCsv` 使用。エラーは行番号つきで表示。`CSV_TEMPLATE` を「テンプレートを見る」で開示
- 取込時に相手名が `opponents` に存在すれば `opponentId` を紐付け、なければ未紐付けのまま(試合後モードでカルテ作成を促す)
- 未取込リスト(`karte.missingMatches`)もこの画面の下部に表示(欠損の記録)
- MatchDetail (`/matches/:id`): セットごとのスコア推移、サーブ別成績(その試合)、コース別失点、ラリー表(table.data、最大表示は折りたたみ)、承認済みでなければ承認ボタンも

## KarteScreen (`src/screens/KarteScreen.tsx`) + OpponentsScreen (`src/screens/OpponentsScreen.tsx`)

カルテ閲覧。タブかセグメントで「自分/相手」切替でもよいし、KarteScreen内に相手一覧へのリンクでもよい(ルートは /karte と /opponents 両方ある)。
- 自分カルテ: 仕様書テンプレートの全セクションをカードで:
  基本(診断より)/ CODENAME(現在+軸スコア+クラッチ指標+自己申告ギャップ+タイプ遷移履歴) /
  サーブ別成績(serveStats、table.data) / コース別失点傾向(courseLossStats+CourseBadge) /
  確定タグ(断定表現・[pt]) / 観察中(「可能性」表現・[pt]) / 解消済み(resolvedBy) /
  崩壊ループ(R1: trigger→middle→result、発生頻度、脱出成功時の行動) /
  直近の課題と練習履歴(assignments: 検証待ち→「検証済みにする」ボタンで outcome 入力) /
  練習ログ(practiceLog+小さな注記「タイプ計算には不使用」) /
  コーチングメモ(memos) / 未取込試合リスト(missingMatches)
- 編集: 観察中エントリの「確定に昇格は承認が必要」なので編集UIは最小限: 観察中の削除(誤った自動反映の修正)と、崩壊ループ・メモの手動追加(updateKarte)
- 相手カルテ(OpponentsScreen): 一覧(名前・所属・暫定タイプTypeBadge・対戦数) → 詳細(/opponents/:id): 暫定CODENAME[判定根拠pt]+「※暫定」表示、3項目分析、対戦メモ、編集(upsertOpponent)、新規作成ボタン
- プライバシー注記をフッターに: 「カルテは本人のみに表示。共有・エクスポート機能はありません」

## CoachScreen (`src/screens/CoachScreen.tsx`) + SettingsScreen (`src/screens/SettingsScreen.tsx`)

- CoachScreen: コーチハブ。`voice(persona)('greet',{codename,name})` の挨拶 + データ残高(`dataGrow`、totalPt) + 直近セッション要約(sessions末尾2件: 「先週話したことを忘れない」) + 3モードへの大きな入口カード(試合前/試合後/週次、それぞれ説明1行) + 「伝えておくこと」(体調・試作サーブ等)入力→memos直接追加(本人入力=承認済み) + 動画/CSVアップロードの誘い(1画面で1度だけ・控えめに) + `OUT_OF_SCOPE_NOTICE` を小さくフッターに
- SettingsScreen: 
  - プレイヤー名(input → setSettings)
  - ペルソナ切替(PERSONA_INFO、3択カード、説明つき)
  - スキン切替(SKIN_INFO A/B/C、「見た目のみ・タイプ判定とは無関係」と明記)
  - シーズンオフ切替(トグル: 「試合がない期間は週次が練習ログ中心になります」)
  - 練習メニュー粒度の既定値(Segmented)
  - β情報: 運用開始日と残り日数
  - データ管理: スナップショット一覧(reason+日時)→「この時点に戻す」(rollbackTo、confirm付き) / 「デモデータを読み込む」(loadDemo、確認つき: 現在のデータは置き換わる) / 「すべてのデータを削除」(resetAll、二重確認)
  - プライバシー方針の表示(本人のみ・外部出力なし・共有機能なし)
  - アプリ情報: v1.5 / PWA(ホーム画面に追加でアプリとして使える説明)
