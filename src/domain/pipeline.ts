/* ============================================================
   試合承認後のパイプライン — 二層承認の振り分け (CLAUDE.md準拠)
   - 要確認(本人タップ): 新規確定タグ / 崩壊ループ変更 / タイプ変更 / 解消移動
   - 自動反映: 成績数値の更新 / 「観察中」への追加 (後から修正可)
   ============================================================ */
import type {
  Approval, CodenameKey, DiagnosisAnswers, Match, SelfKarte, Settings,
  TendencyEntry, TypeHistoryEntry, Variant,
} from './types';
import { detectReceiveWeaknesses, detectResolved } from './insights';
import { computeTypeResult, shouldProposeTypeChange } from './typeEngine';

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export interface PipelineResult {
  karte: SelfKarte;
  newApprovals: Approval[];
  autoNotes: string[];
}

export function runPostApprovalPipeline(
  karte: SelfKarte,
  approvedMatches: Match[],
  diagnosis: DiagnosisAnswers | null,
  settings: Settings,
  today: string,
  existingApprovals: Approval[],
): PipelineResult {
  const next: SelfKarte = structuredClone(karte);
  const newApprovals: Approval[] = [];
  const autoNotes: string[] = [];
  const pendingKeys = new Set(
    existingApprovals.filter((a) => a.status === 'pending').map((a) => JSON.stringify([a.kind, (a.payload as { key?: string })?.key])),
  );

  // 1) レシーブ弱点の検出 → 確定タグ提案 or 観察中へ自動追加
  for (const c of detectReceiveWeaknesses(approvedMatches)) {
    const existing = next.tendencies.find((t) => t.key === c.key && t.status !== 'resolved');
    if (c.confirmable && (!existing || existing.status === 'observed')) {
      const dupe = pendingKeys.has(JSON.stringify(['新規確定タグ', c.key]));
      if (!dupe) {
        newApprovals.push({
          id: uid(), kind: '新規確定タグ', createdAt: today,
          summary: `確定タグ提案: ${c.text} [${c.pt}pt, ±${Math.round(c.ci * 100)}%](3試合連続で観測)`,
          payload: { key: c.key, text: c.text, pt: c.pt, value: c.value, ci: c.ci },
          status: 'pending',
        });
      }
    } else if (!existing) {
      const entry: TendencyEntry = {
        id: uid(), key: c.key,
        text: `${c.text}の可能性`,
        pt: c.pt, value: c.value, ci: c.ci, status: 'observed',
        firstSeen: today, lastSeen: today,
      };
      next.tendencies.push(entry);
      autoNotes.push(`観察中に追加: ${entry.text}[${c.pt}pt]`);
    } else if (existing.status === 'observed') {
      existing.pt = c.pt;
      existing.value = c.value;
      existing.ci = c.ci;
      existing.lastSeen = today;
      autoNotes.push(`観察中を更新: ${existing.text}[${c.pt}pt]`);
    } else {
      // 確定済み → 数値のみ自動更新
      existing.pt = c.pt;
      existing.value = c.value;
      existing.ci = c.ci;
      existing.lastSeen = today;
    }
  }

  // 2) 解消候補 → 要確認
  for (const t of detectResolved(next, approvedMatches)) {
    const dupe = pendingKeys.has(JSON.stringify(['解消移動', t.key]));
    if (!dupe) {
      newApprovals.push({
        id: uid(), kind: '解消移動', createdAt: today,
        summary: `解消提案: 「${t.text}」が直近2試合で観測されていません。解消済みへ移動しますか?`,
        payload: { key: t.key, tendencyId: t.id },
        status: 'pending',
      });
    }
  }

  // 3) タイプ変更の提案(ヒステリシス通過時のみ・要確認)
  const result = computeTypeResult(approvedMatches, diagnosis, settings, today);
  const lastMeasured = [...next.typeHistory].reverse().find((h) => h.stage === 'measured');
  const current = lastMeasured
    ? { codename: lastMeasured.codename, variant: lastMeasured.variant }
    : null;
  if (result.stage === 'measured' && result.codename && result.variant) {
    const { propose, reason } = shouldProposeTypeChange(current, result, approvedMatches);
    if (propose) {
      const variantLabel = result.variant === 'alpha' ? 'α' : 'Ω';
      const dupe = pendingKeys.has(JSON.stringify(['タイプ変更', `${result.codename}-${result.variant}`]));
      if (!dupe) {
        newApprovals.push({
          id: uid(), kind: 'タイプ変更', createdAt: today,
          summary: current
            ? `タイプ変更提案: ${current.codename} → ${result.codename}-${variantLabel}(${reason})`
            : `実測タイプ確定: ${result.codename}-${variantLabel}(バックフィル完了)`,
          payload: { key: `${result.codename}-${result.variant}`, codename: result.codename, variant: result.variant },
          status: 'pending',
        });
      }
    }
  }

  return { karte: next, newApprovals, autoNotes };
}

/** 承認されたApprovalをカルテへ適用する */
export function applyApproval(karte: SelfKarte, approval: Approval, today: string): SelfKarte {
  const next = structuredClone(karte);
  const p = approval.payload as Record<string, unknown>;
  switch (approval.kind) {
    case '新規確定タグ': {
      const existing = next.tendencies.find((t) => t.key === p.key && t.status !== 'resolved');
      if (existing) {
        existing.status = 'confirmed';
        existing.text = String(p.text);
        existing.pt = Number(p.pt);
        existing.value = p.value as number | undefined;
        existing.ci = p.ci as number | undefined;
        existing.lastSeen = today;
      } else {
        next.tendencies.push({
          id: approval.id, key: String(p.key), text: String(p.text),
          pt: Number(p.pt), value: p.value as number | undefined, ci: p.ci as number | undefined,
          status: 'confirmed', firstSeen: today, lastSeen: today,
        });
      }
      break;
    }
    case '解消移動': {
      const t = next.tendencies.find((x) => x.id === p.tendencyId || (p.key && x.key === p.key));
      if (t) {
        t.status = 'resolved';
        t.resolvedAt = today;
      }
      break;
    }
    case 'タイプ変更': {
      next.typeHistory.push({
        date: today.slice(0, 7),
        codename: p.codename as CodenameKey,
        variant: p.variant as Variant,
        stage: 'measured',
      } satisfies TypeHistoryEntry);
      break;
    }
    case 'コーチングメモ': {
      next.memos.push({
        id: approval.id,
        date: today,
        text: String(p.text),
        effect: p.effect ? String(p.effect) : undefined,
      });
      break;
    }
    case '崩壊ループ変更': {
      const loop = p as unknown as SelfKarte['loops'][number];
      const idx = next.loops.findIndex((l) => l.id === loop.id);
      if (idx >= 0) next.loops[idx] = loop; else next.loops.push({ ...loop, id: loop.id || approval.id });
      break;
    }
  }
  return next;
}
