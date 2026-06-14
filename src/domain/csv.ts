/* ============================================================
   試合CSVの入出力
   ①得点チェックリストアプリ・②撮影判定アプリの出力を想定した1試合1ファイル形式。
   列: set,my_score,opp_score,server,serve_type,serve_course,rally_length,third_ball_attack,winner
   メタ行(先頭、#で開始): date / opponent / tournament / result / source
   ============================================================ */
import type { Course, Match, MatchSource, RallyRow } from './types';

export function parseMatchCsv(text: string, id: string): { match: Match | null; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const meta: Record<string, string> = {};
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('#')) {
      const m = line.slice(1).split(':');
      if (m.length >= 2) meta[m[0].trim().toLowerCase()] = m.slice(1).join(':').trim();
    } else {
      dataLines.push(line);
    }
  }
  if (dataLines.length === 0) return { match: null, errors: ['データ行がありません'] };

  // ヘッダー行の判定
  let startIdx = 0;
  const header = dataLines[0].toLowerCase();
  if (header.includes('set') && header.includes('server')) startIdx = 1;

  const rallies: RallyRow[] = [];
  for (let i = startIdx; i < dataLines.length; i++) {
    const cols = dataLines[i].split(',').map((c) => c.trim());
    if (cols.length < 9) {
      errors.push(`${i + 1}行目: 列が不足(9列必要)`);
      continue;
    }
    const course = Number(cols[5]);
    if (!(course >= 1 && course <= 6)) {
      errors.push(`${i + 1}行目: serve_courseは1-6`);
      continue;
    }
    rallies.push({
      set: Number(cols[0]) || 1,
      myScore: Number(cols[1]) || 0,
      oppScore: Number(cols[2]) || 0,
      server: cols[3] === 'me' ? 'me' : 'opp',
      serveType: cols[4] || '不明',
      serveCourse: course as Course,
      rallyLength: Math.max(1, Number(cols[6]) || 1),
      thirdBallAttack: cols[7] === '1' || cols[7].toLowerCase() === 'true',
      winner: cols[8] === 'me' ? 'me' : 'opp',
    });
  }
  if (rallies.length === 0) return { match: null, errors: [...errors, '有効なラリー行がありません'] };

  const result = (meta['result'] ?? '0-0').split('-');
  const source = (meta['source'] as MatchSource) ?? '手入力';
  const match: Match = {
    id,
    date: meta['date'] ?? new Date().toISOString().slice(0, 10),
    opponentId: '',
    opponentName: meta['opponent'] ?? '不明',
    tournament: meta['tournament'],
    mySets: Number(result[0]) || 0,
    oppSets: Number(result[1]) || 0,
    source: ['得点チェックリスト', '撮影判定', '手入力', 'デモ'].includes(source) ? source : '手入力',
    approved: false,
    rallies,
  };
  return { match, errors };
}

export function serializeMatchCsv(m: Match): string {
  const head = [
    `# date: ${m.date}`,
    `# opponent: ${m.opponentName}`,
    m.tournament ? `# tournament: ${m.tournament}` : null,
    `# result: ${m.mySets}-${m.oppSets}`,
    `# source: ${m.source}`,
    'set,my_score,opp_score,server,serve_type,serve_course,rally_length,third_ball_attack,winner',
  ].filter(Boolean);
  const rows = m.rallies.map((r) =>
    [r.set, r.myScore, r.oppScore, r.server, r.serveType, r.serveCourse, r.rallyLength, r.thirdBallAttack ? 1 : 0, r.winner].join(','),
  );
  return [...head, ...rows].join('\n');
}

/** CSVテンプレート(インポート画面の説明用) */
export const CSV_TEMPLATE = `# date: 2026-06-13
# opponent: 山田太郎
# tournament: 県リーグ
# result: 3-1
# source: 得点チェックリスト
set,my_score,opp_score,server,serve_type,serve_course,rally_length,third_ball_attack,winner
1,0,0,me,巻き込み,1,3,1,me
1,1,0,opp,ロング,4,5,0,opp`;
