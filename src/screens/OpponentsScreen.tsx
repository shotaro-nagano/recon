/* ============================================================
   OpponentsScreen — 相手カルテ(一覧 /opponents・詳細 /opponents/:id)
   相手のタイプ判定はすべて暫定。判定根拠[pt]と「※暫定」を必ず併記する
   ============================================================ */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { todayStr, uid, useAppStore } from '@/store/useAppStore';
import { CODENAME_KEYS, CODENAMES } from '@/domain/constants';
import type { CodenameKey, OpponentKarte, Variant } from '@/domain/types';
import { Card, Collapsible, EmptyState, Screen, SectionLabel, TypeBadge } from '@/components/ui';
import { Ring } from '@/components/charts';

const PRIVACY = '🔒 本人のみ・共有なし';
const PROVISIONAL_NOTE = '※タイプは暫定。対戦が増えるほど精度↑';

/** 改行区切りテキスト ↔ 配列 */
const toLines = (xs: string[]) => xs.join('\n');
const fromLines = (s: string) => s.split('\n').map((x) => x.trim()).filter((x) => x !== '');

/* ---- 新規作成・編集フォーム ---- */
function OpponentForm({ initial, onSave, onCancel }: {
  initial?: OpponentKarte;
  onSave: (o: OpponentKarte) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [affiliation, setAffiliation] = useState(initial?.affiliation ?? '');
  const [codename, setCodename] = useState<CodenameKey | ''>(initial?.provisionalCodename ?? '');
  const [variant, setVariant] = useState<Variant | ''>(initial?.provisionalVariant ?? '');
  const [judgedPt, setJudgedPt] = useState(String(initial?.judgedPt ?? 0));
  const [serveTendency, setServeTendency] = useState(toLines(initial?.serveTendency ?? []));
  const [receiveHoles, setReceiveHoles] = useState(toLines(initial?.receiveHoles ?? []));
  const [clutchHabits, setClutchHabits] = useState(toLines(initial?.clutchHabits ?? []));

  const canSave = name.trim() !== '';

  const save = () => {
    const pt = Math.max(0, Math.round(Number(judgedPt)) || 0);
    onSave({
      id: initial?.id ?? uid(),
      name: name.trim(),
      affiliation: affiliation.trim() || undefined,
      provisionalCodename: codename === '' ? undefined : codename,
      provisionalVariant: variant === '' ? undefined : variant,
      judgedPt: pt,
      serveTendency: fromLines(serveTendency),
      receiveHoles: fromLines(receiveHoles),
      clutchHabits: fromLines(clutchHabits),
      notes: initial?.notes ?? [],
    });
  };

  return (
    <Card>
      <SectionLabel>{initial ? '相手カルテを編集' : '相手カルテを新規作成'}</SectionLabel>
      <div className="stack">
        <label>名前*
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 山田 太郎" />
        </label>
        <label>所属
          <input value={affiliation} onChange={(e) => setAffiliation(e.target.value)} placeholder="例: ○○大学" />
        </label>
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ flex: 2, minWidth: 140 }}>暫定タイプ
            <select value={codename} onChange={(e) => setCodename(e.target.value as CodenameKey | '')}>
              <option value="">未判定</option>
              {CODENAME_KEYS.map((k) => (
                <option key={k} value={k}>{k}({CODENAMES[k].style})</option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 110 }}>α/Ω
            <select value={variant} onChange={(e) => setVariant(e.target.value as Variant | '')}>
              <option value="">未判定</option>
              <option value="alpha">α(先行型)</option>
              <option value="omega">Ω(後半型)</option>
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 110 }}>判定根拠[pt]
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={judgedPt}
              onChange={(e) => setJudgedPt(e.target.value)}
            />
          </label>
        </div>
        <label>サーブ傾向(1行に1項目)
          <textarea rows={3} value={serveTendency} onChange={(e) => setServeTendency(e.target.value)} placeholder={'例: 巻き込みサーブ多用(フォア前)\n例: 9点以降はロング増'} />
        </label>
        <label>レシーブの穴(1行に1項目)
          <textarea rows={3} value={receiveHoles} onChange={(e) => setReceiveHoles(e.target.value)} placeholder="例: バック奥へのロングで浮きやすい" />
        </label>
        <label>勝負どころの癖(1行に1項目)
          <textarea rows={3} value={clutchHabits} onChange={(e) => setClutchHabits(e.target.value)} placeholder="例: 9-9以降は得意サーブ一本に固定する" />
        </label>
        {!canSave && (
          <p className="small muted">名前が未入力です。相手の名前を入力すると保存できます。</p>
        )}
        <div className="row">
          <button className="btn btn-primary" disabled={!canSave} onClick={save}>カルテを保存</button>
          <button className="btn btn-ghost" onClick={onCancel}>やめる</button>
        </div>
      </div>
    </Card>
  );
}

/* ---- 詳細(/opponents/:id) ---- */
function OpponentDetail({ id }: { id: string }) {
  const opponents = useAppStore((s) => s.opponents);
  const matches = useAppStore((s) => s.matches);
  const upsertOpponent = useAppStore((s) => s.upsertOpponent);
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteTournament, setNoteTournament] = useState('');

  const opp = opponents.find((o) => o.id === id);
  const linked = useMemo(
    () => matches.filter((m) => m.opponentId === id),
    [matches, id],
  );

  if (!opp) {
    return (
      <Screen title="相手カルテ">
        <EmptyState
          title="この相手のカルテが見つかりません"
          hint="削除されたか、URLが古い可能性があります。一覧から選び直してください"
          action={<Link className="btn" to="/opponents">一覧へ戻る</Link>}
        />
      </Screen>
    );
  }

  const wins = linked.filter((m) => m.mySets > m.oppSets).length;
  const losses = linked.filter((m) => m.mySets < m.oppSets).length;
  const draws = linked.filter((m) => m.mySets === m.oppSets).length;

  const addNote = () => {
    const t = noteText.trim();
    if (!t) return;
    upsertOpponent({
      ...opp,
      notes: [...opp.notes, { date: todayStr(), tournament: noteTournament.trim() || undefined, text: t }],
    });
    setNoteText('');
    setNoteTournament('');
  };

  const section = (label: string, items: string[], color: string) =>
    items.length === 0 ? null : (
      <div>
        <p className="small" style={{ marginBottom: 4 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} />
          <span className="muted">{label}</span>
        </p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {items.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>
    );

  return (
    <Screen
      title={`相手カルテ: ${opp.name}`}
      right={<Link className="btn btn-ghost" to="/opponents">一覧へ戻る</Link>}
    >
      {editing ? (
        <OpponentForm
          initial={opp}
          onSave={(o) => { upsertOpponent(o); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <Card accent>
            <SectionLabel>暫定タイプ</SectionLabel>
            <div className="spread" style={{ alignItems: 'flex-start', gap: 12 }}>
              <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                {opp.provisionalCodename ? (
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <TypeBadge codename={opp.provisionalCodename} variant={opp.provisionalVariant} />
                    <span className="small" style={{ padding: '1px 9px', borderRadius: 'var(--radius-pill)', fontWeight: 700, border: '1px solid var(--warn)', color: 'var(--warn)' }}>暫定</span>
                  </div>
                ) : (
                  <p className="muted small">タイプ未判定 — 対戦データ不足</p>
                )}
                {opp.affiliation && (
                  <p className="small"><span className="muted">所属: </span>{opp.affiliation}</p>
                )}
                {linked.length > 0 ? (
                  <p className="small">
                    <span className="muted">対戦 </span><span className="mono">{linked.length}</span>試合 ・{' '}
                    <span className="mono" style={{ color: 'var(--pos)', fontWeight: 700 }}>{wins}勝</span>
                    <span className="mono" style={{ color: 'var(--neg)', fontWeight: 700 }}>{losses}敗</span>
                    {draws > 0 && <span className="mono muted">{draws}分</span>}
                  </p>
                ) : (
                  <p className="small muted">対戦記録なし</p>
                )}
              </div>
              <Ring value={Math.min(1, opp.judgedPt / 50)} center={String(opp.judgedPt)} sub="判定pt" color="var(--accent)" size={84} />
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>{PROVISIONAL_NOTE}</p>
          </Card>

          <Collapsible title="3項目分析" openLabel="対策メモを見る(サーブ傾向・レシーブの穴・勝負どころ)" closeLabel="とじる">
          <Card>
            <SectionLabel>3項目分析</SectionLabel>
            <div className="stack">
              {[
                section('サーブ傾向', opp.serveTendency, 'var(--accent)'),
                section('レシーブの穴', opp.receiveHoles, 'var(--neg)'),
                section('勝負どころの癖', opp.clutchHabits, 'var(--warn)'),
              ].filter(Boolean).map((node, i) => (
                <div key={i}>{i > 0 && <hr className="divider" style={{ margin: '10px 0' }} />}{node}</div>
              ))}
              {opp.serveTendency.length === 0 && opp.receiveHoles.length === 0 && opp.clutchHabits.length === 0 && (
                <p className="small muted">まだ記入なし。「カルテを編集」で追加できます。</p>
              )}
            </div>
          </Card>
          </Collapsible>

          <Collapsible title="対戦メモ" openLabel={`対戦メモを見る・追加(${opp.notes.length}件)`} closeLabel="とじる">
          <Card>
            <SectionLabel>対戦メモ</SectionLabel>
            {opp.notes.length === 0 ? (
              <p className="muted small">メモはまだありません。対戦のたびに気づきを残しましょう。</p>
            ) : (
              <div className="stack">
                {[...opp.notes]
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((n, i) => (
                    <div key={`${n.date}-${i}`}>
                      <p className="small muted">
                        <span className="mono">{n.date}</span>
                        {n.tournament ? ` ・ ${n.tournament}` : ''}
                      </p>
                      <p>{n.text}</p>
                    </div>
                  ))}
              </div>
            )}
            <div className="stack" style={{ marginTop: 12 }}>
              <label>大会名(任意)
                <input value={noteTournament} onChange={(e) => setNoteTournament(e.target.value)} placeholder="例: 県選手権" />
              </label>
              <textarea
                rows={2}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="例: ロングサーブを混ぜたらレシーブが浮いた"
              />
              <button className="btn" disabled={noteText.trim() === ''} onClick={addNote}>メモを追加</button>
            </div>
          </Card>
          </Collapsible>

          <button className="btn" onClick={() => setEditing(true)}>カルテを編集</button>
        </>
      )}

      <p className="small muted" style={{ textAlign: 'center' }}>{PRIVACY}</p>
    </Screen>
  );
}

/* ---- 一覧(/opponents) ---- */
function OpponentList() {
  const opponents = useAppStore((s) => s.opponents);
  const matches = useAppStore((s) => s.matches);
  const upsertOpponent = useAppStore((s) => s.upsertOpponent);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const countOf = (id: string) => matches.filter((m) => m.opponentId === id).length;
  const recordOf = (id: string) => {
    const ms = matches.filter((m) => m.opponentId === id);
    return { w: ms.filter((m) => m.mySets > m.oppSets).length, l: ms.filter((m) => m.mySets < m.oppSets).length };
  };
  const sorted = useMemo(
    () => [...opponents].sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    [opponents],
  );

  return (
    <Screen
      title="相手カルテ"
      right={<Link className="btn btn-ghost" to="/karte">自分カルテへ</Link>}
    >
      <p className="small muted">{PROVISIONAL_NOTE}</p>

      {creating ? (
        <OpponentForm
          onSave={(o) => { upsertOpponent(o); setCreating(false); navigate(`/opponents/${o.id}`); }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => setCreating(true)}>
          相手カルテを新規作成
        </button>
      )}

      {sorted.length === 0 && !creating ? (
        <EmptyState
          title="相手カルテはまだありません"
          hint="試合後モードの「相手カルテを作成」か、上のボタンから追加できます"
        />
      ) : (
        sorted.map((o) => (
          <Link key={o.id} to={`/opponents/${o.id}`} style={{ color: 'inherit' }}>
            <Card>
              <div className="spread" style={{ flexWrap: 'wrap' }}>
                <div>
                  <p><b>{o.name}</b>{o.affiliation && <span className="small muted"> ・ {o.affiliation}</span>}</p>
                  <div className="row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
                    {o.provisionalCodename ? (
                      <>
                        <TypeBadge codename={o.provisionalCodename} variant={o.provisionalVariant} />
                        <span className="small muted mono">暫定[{o.judgedPt}pt]</span>
                      </>
                    ) : (
                      <span className="small muted">タイプ未判定</span>
                    )}
                  </div>
                </div>
                {(() => {
                  const n = countOf(o.id); const r = recordOf(o.id);
                  return (
                    <span className="small" style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span className="muted">対戦 </span><span className="mono">{n}</span>試合
                      {n > 0 && (
                        <><br />
                          <span className="mono" style={{ color: 'var(--pos)', fontWeight: 700 }}>{r.w}勝</span>
                          <span className="mono" style={{ color: 'var(--neg)', fontWeight: 700 }}>{r.l}敗</span>
                        </>
                      )}
                    </span>
                  );
                })()}
              </div>
            </Card>
          </Link>
        ))
      )}

      <p className="small muted" style={{ textAlign: 'center' }}>{PRIVACY}</p>
    </Screen>
  );
}

export default function OpponentsScreen() {
  const { id } = useParams<{ id: string }>();
  return id ? <OpponentDetail id={id} /> : <OpponentList />;
}
