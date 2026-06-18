/* ============================================================
   弱点分析 — 失点パターンカタログ(純データ)
   ③ 弱点分析タブが使用。実試合で失点しやすいパターンを、
   状況→経過→失点局面のシーケンスで提示する(自分宛)。
   ※将来、動画解析の実データが入れば「発生頻度」で並べ替える。
   現状は想定パターンのカタログ + 関連する練習カテゴリへの導線。
   ============================================================ */
import type { DrillCategoryKey } from './drills';

export type WeaknessTag =
  | 'レシーブ' | '台上' | 'サーブ' | 'ラリー' | 'フットワーク' | 'イレギュラー';

export interface WeaknessPattern {
  id: string;
  /** 短い見出し */
  title: string;
  tag: WeaknessTag;
  /** 状況→経過のシーケンス(最後の missPoint で失点) */
  steps: string[];
  /** 失点した局面・ミスの種類 */
  missPoint: string;
  /** 元の説明(欠落なく保持) */
  detail: string;
  /** この弱点に効く練習カテゴリ */
  relatedDrill: DrillCategoryKey;
  /** 最初に挙げる代表パターン(一旦の4パターン) */
  featured?: boolean;
}

export const WEAKNESS_PATTERNS: WeaknessPattern[] = [
  {
    id: 'w01', title: 'ツッツキ→ループのカウンターミス', tag: 'ラリー', featured: true,
    steps: ['相手バックへツッツキ', '相手がフォアへループ', 'カウンターを狙う'],
    missPoint: 'カウンターミス',
    detail: '相手のBにツッツキをして自分のFにループされたボールに対してのカウンターミス。',
    relatedDrill: 'multiball',
  },
  {
    id: 'w02', title: '台上の応酬からのBDミス', tag: '台上', featured: true,
    steps: ['相手がフォア前へストップ', 'ダブルストップで返す', '相手がバックへツッツキ', 'バックドライブで打つ'],
    missPoint: 'BD(バックドライブ)ミス',
    detail: '相手にF前にストップされた後にダブルストップしてバックにツッツキされたボールに対してのBDミス。',
    relatedDrill: 'overtable',
  },
  {
    id: 'w03', title: 'ミドルツッツキの3球目判断ミス', tag: 'サーブ', featured: true,
    steps: ['下回転サーブを出す', '相手がミドルへツッツキ', '3球目をフォアかバックか判断'],
    missPoint: 'フォア・バック判断の遅れによる3球目ミス',
    detail: '下回転サーブを出して、ミドルにツッツキされたボールに対しての三球目フォア・バック判断遅れのミス。',
    relatedDrill: 'task',
  },
  {
    id: 'w04', title: 'ロングサーブ後のブロックミス', tag: 'レシーブ', featured: true,
    steps: ['相手のロングサーブ', '甘く長くレシーブしてしまう', '相手が3球目で強打', 'ブロックで止める'],
    missPoint: 'ブロックミス',
    detail: '相手のロングサーブをレシーブで甘く長く返して、三球目に強打されたボールに対してのブロックミス。',
    relatedDrill: 'receive',
  },
  {
    id: 'w05', title: 'ツッツキ合戦からのミドル処理ミス', tag: 'ラリー',
    steps: ['ツッツキ合戦が続く', '相手が先にミドル(ボディ)を突く', 'フォア/バックへ切り替えて処理'],
    missPoint: '切り替え処理ミス',
    detail: 'ツッツキ合戦から先に相手にミドル（ボディ）を突かれたボールに対しての切り替え処理ミス。',
    relatedDrill: 'footwork',
  },
  {
    id: 'w06', title: '横下回転の回転読み違えミス', tag: 'レシーブ',
    steps: ['相手の横下回転サーブ', 'ツッツキで返球', '回転を読み違える'],
    missPoint: 'レシーブのオーバー(またはネット)ミス',
    detail: '横下回転サーブをツッツキで返球する際、回転を読み違えてのレシーブのオーバー（またはネット）ミス。',
    relatedDrill: 'receive',
  },
  {
    id: 'w07', title: 'ストップ応酬からのフリックミス', tag: '台上',
    steps: ['相手の短いサーブ', 'ストップで返す', '相手もストップで返す', '台上フリックで処理'],
    missPoint: '台上フリック処理ミス',
    detail: '短いサーブにストップで返し、相手にもストップ返しされたボールに対しての台上フリック処理ミス。',
    relatedDrill: 'overtable',
  },
  {
    id: 'w08', title: '振った後の逆突き・戻り遅れ', tag: 'フットワーク',
    steps: ['相手をフォア・バックに振る', '逆を突かれる', '切り返される'],
    missPoint: '戻り遅れによるミス',
    detail: '相手をフォア・バックに振った後、逆を突かれて切り返されたボールに対しての戻り遅れミス。',
    relatedDrill: 'footwork',
  },
  {
    id: 'w09', title: 'ネットイン後のタッチ調整ミス', tag: 'イレギュラー',
    steps: ['ネットインする', '不規則なバウンドになる', 'タッチを合わせにいく'],
    missPoint: 'タッチ調整ミス',
    detail: 'ネットイン後の不規則なバウンドのボールに対してのタッチ調整ミス。',
    relatedDrill: 'task',
  },
  {
    id: 'w10', title: 'エッジ後の無理な返球ミス', tag: 'イレギュラー',
    steps: ['エッジボールになる', '体勢を崩される', '無理に返球する'],
    missPoint: '無理な返球ミス',
    detail: 'エッジボールで体勢を崩された後のボールに対しての無理な返球ミス。',
    relatedDrill: 'footwork',
  },
  {
    id: 'w11', title: 'サーブが長くなり先に攻められる', tag: 'サーブ',
    steps: ['自分のサーブが長くなる', 'レシーブから先に攻められる', 'カウンター(ブロック)で対応'],
    missPoint: 'カウンター(ブロック)ミス',
    detail: '自分のサーブが長くなってしまい、レシーブから先に攻められたボールに対してのカウンター（ブロック）ミス。',
    relatedDrill: 'serve',
  },
  {
    id: 'w12', title: '速いロングサーブに詰まる', tag: 'レシーブ',
    steps: ['相手の速いロングサーブ', '差し込まれる', '詰まった体勢になる'],
    missPoint: '詰まった体勢でのレシーブミス',
    detail: '相手の速いロングサーブに差し込まれて、詰まった体勢でのレシーブミス。',
    relatedDrill: 'receive',
  },
  {
    id: 'w13', title: 'ミドル深球の肘元処理ミス', tag: 'ラリー',
    steps: ['ラリー中', 'ミドルへ深く来る', '肘元(体の正面)で処理'],
    missPoint: '肘元の処理ミス',
    detail: 'ラリー中にミドルへ深く来たボールに対しての肘元（体の正面）の処理ミス。',
    relatedDrill: 'footwork',
  },
  {
    id: 'w14', title: '緩いループへの打ち急ぎミス', tag: 'ラリー',
    steps: ['相手の緩いつなぎループ', '打ち急ぐ', 'タイミングが合わない'],
    missPoint: 'オーバーミス',
    detail: '緩いつなぎループに対して打ち急ぎ、タイミングが合わずのオーバーミス。',
    relatedDrill: 'multiball',
  },
  {
    id: 'w15', title: '強回転への角度合わせミス', tag: 'ラリー',
    steps: ['相手の回転量が多い球', 'ラケット角度を合わせる', '角度が合わない'],
    missPoint: 'ネットミス',
    detail: '相手の回転量の多いボールに対して、ラケット角度を合わせ切れずのネットミス。',
    relatedDrill: 'receive',
  },
  {
    id: 'w16', title: '競り場の消極レシーブからの失点', tag: 'レシーブ',
    steps: ['競った場面(デュース・終盤)', '無難にツッツキでレシーブ', '相手が3球目強打', 'ブロックで止める'],
    missPoint: 'ブロックミス',
    detail: '競った場面（デュース・終盤）でレシーブを無難にツッツキして、三球目に強打されたボールに対してのブロックミス。',
    relatedDrill: 'receive',
  },
  {
    id: 'w17', title: '警戒しすぎでレシーブが浮く', tag: 'レシーブ',
    steps: ['サーブを警戒しすぎる', 'レシーブが浮く', '先に強打される'],
    missPoint: '守備ミス',
    detail: 'サーブを警戒しすぎてレシーブが浮き、先に強打されたボールに対しての守備ミス。',
    relatedDrill: 'receive',
  },
  {
    id: 'w18', title: 'フェイクにコースを読み違える', tag: 'レシーブ',
    steps: ['相手のフェイク(出球モーション)', 'コースを読み違える'],
    missPoint: '反応遅れミス',
    detail: '相手のフェイク（出球モーション）に釣られてコースを読み違えたボールに対しての反応遅れミス。',
    relatedDrill: 'receive',
  },
  {
    id: 'w19', title: 'ラリー終盤の足止まりミス', tag: 'フットワーク',
    steps: ['長いラリーが続く', '足が止まる', 'サイドを切られる'],
    missPoint: '追いつけずミス',
    detail: '長いラリーで足が止まり、サイドを切られたボールに対しての追いつけずのミス。',
    relatedDrill: 'footwork',
  },
  {
    id: 'w20', title: 'ナックルの読み違えオーバー', tag: 'レシーブ',
    steps: ['相手のナックル(無回転)', '下回転と読み違える', '持ち上げすぎる'],
    missPoint: 'オーバーミス',
    detail: 'ナックル（無回転）を下回転と読み違えて持ち上げすぎたボールに対してのオーバーミス。',
    relatedDrill: 'receive',
  },
  {
    id: 'w21', title: 'チキータ後の4球目ブロックミス', tag: 'ラリー',
    steps: ['相手のチキータレシーブ', 'コースを絞り切れず甘く返す', '相手の4球目', 'ブロックで止める'],
    missPoint: '4球目ブロックミス',
    detail: '相手のチキータレシーブに対してコースを絞り切れず甘く返したボールに対しての四球目ブロックミス。',
    relatedDrill: 'system',
  },
  {
    id: 'w22', title: '前後の揺さぶり・前進処理ミス', tag: 'フットワーク',
    steps: ['台から下げられる', '前後(短く落とす)に揺さぶられる', '前進して処理'],
    missPoint: '前進処理ミス',
    detail: '台から下げられた後、前後（短く落とす）に揺さぶられたボールに対しての前進処理ミス。',
    relatedDrill: 'footwork',
  },
];

export const WEAKNESS_TAGS: WeaknessTag[] = [
  'レシーブ', '台上', 'サーブ', 'ラリー', 'フットワーク', 'イレギュラー',
];

export function featuredWeaknesses(): WeaknessPattern[] {
  return WEAKNESS_PATTERNS.filter((w) => w.featured);
}

export function weaknessesByTag(tag: WeaknessTag): WeaknessPattern[] {
  return WEAKNESS_PATTERNS.filter((w) => w.tag === tag);
}
