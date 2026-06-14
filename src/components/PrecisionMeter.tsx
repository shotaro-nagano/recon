/* ============================================================
   精度メーター (CLAUDE.md 技術要件)
   カルテ残高(pt)と主要指標の信頼区間幅を表示。
   データ追加で±が縮む様子を可視化 = 「育つ」の正直な見せ方
   ============================================================ */
import { MEASURED_MIN_MATCHES } from '@/domain/constants';
import type { TypeResult } from '@/domain/types';

export default function PrecisionMeter({ result }: { result: TypeResult }) {
  const { totalPt, matchCount, clutch } = result;
  const remaining = Math.max(0, MEASURED_MIN_MATCHES - matchCount);

  // 主要指標 = クラッチのCI半幅。±30%をメーター最大幅とする
  const ciPct = clutch ? Math.min(0.3, clutch.ci) : 0.3;
  const bandHalf = (ciPct / 0.3) * 50;

  return (
    <div>
      <div className="spread">
        <span className="section-label" style={{ marginBottom: 0 }}>精度メーター</span>
        <span className="mono small" style={{ color: 'var(--court-line)' }}>
          {totalPt}<span className="muted">pt</span>
        </span>
      </div>
      <div className="meter-track" style={{ marginTop: 8 }}>
        <div
          className="meter-band"
          style={{ left: `${50 - bandHalf}%`, right: `${50 - bandHalf}%` }}
        />
      </div>
      <div className="spread small" style={{ marginTop: 4 }}>
        <span className="mono muted">
          {clutch
            ? `クラッチ ±${Math.round(clutch.ci * 100)}% [${clutch.pt}pt]`
            : 'クラッチ ±--%(データ待ち)'}
        </span>
        <span className="mono muted">
          {result.stage === 'measured'
            ? `${matchCount}試合で確定`
            : remaining > 0
              ? `あと${remaining}試合で確定`
              : ''}
        </span>
      </div>
    </div>
  );
}
