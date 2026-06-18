/* ============================================================
   アプリ状態ストア (zustand + IndexedDB 永続化)
   カルテ更新ごとにスナップショットを保存 — Git管理の代替として
   任意時点へロールバック可能 (CLAUDE.md「記憶とバックアップ」)
   ============================================================ */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { del, get as idbGet, set as idbSet } from 'idb-keyval';
import type {
  Approval, DiagnosisAnswers, KarteSnapshot, Match, MissingMatch,
  OpponentKarte, PracticeLogEntry, SelfKarte, SessionLog, Settings,
} from '@/domain/types';
import type { PracticeFocus, PracticeFocusEntry } from '@/domain/coach/drills';
import { provisionalType } from '@/domain/typeEngine';
import { applyApproval, runPostApprovalPipeline } from '@/domain/pipeline';
import { buildDemoData } from '@/domain/demo';

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyKarte = (): SelfKarte => ({
  tendencies: [], loops: [], memos: [], practiceLog: [],
  assignments: [], missingMatches: [], typeHistory: [],
});

const defaultSettings = (): Settings => ({
  playerName: '',
  onboarded: false,
  tourSeen: false,
  simpleMode: true,
  skin: 'A',
  operationStartDate: null,
});

const MAX_SNAPSHOTS = 30;

export interface AppState {
  hydrated: boolean;
  settings: Settings;
  diagnosis: DiagnosisAnswers | null;
  matches: Match[];
  opponents: OpponentKarte[];
  karte: SelfKarte;
  approvals: Approval[];
  sessions: SessionLog[];
  snapshots: KarteSnapshot[];
  /** 練習フォーカス選択の履歴(裏DB) */
  practiceFocusLog: PracticeFocusEntry[];

  setSettings: (p: Partial<Settings>) => void;
  completeDiagnosis: (answers: DiagnosisAnswers) => void;
  addMatch: (m: Match) => void;
  updateMatchMeta: (id: string, patch: Pick<Match, 'tournament' | 'kind' | 'note'>) => void;
  approveMatch: (id: string) => void;
  rejectMatch: (id: string, reason?: MissingMatch['reason']) => void;
  deleteMatch: (id: string) => void;
  resolveApproval: (id: string, accept: boolean) => void;
  updateKarte: (reason: string, mutate: (k: SelfKarte) => void) => void;
  rollbackTo: (snapshotId: string) => void;
  upsertOpponent: (o: OpponentKarte) => void;
  addPracticeLog: (e: PracticeLogEntry) => void;
  appendSession: (s: Omit<SessionLog, 'id'>) => void;
  recordPracticeFocus: (focus: PracticeFocus) => void;
  loadDemo: () => void;
  resetAll: () => void;
}

const idbStorage = {
  getItem: async (name: string) => ((await idbGet(name)) as string | undefined) ?? null,
  setItem: async (name: string, value: string) => { await idbSet(name, value); },
  removeItem: async (name: string) => { await del(name); },
};

function snapshotOf(karte: SelfKarte, reason: string): KarteSnapshot {
  return {
    id: uid(),
    takenAt: new Date().toISOString(),
    reason,
    karte: structuredClone(karte),
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      settings: defaultSettings(),
      diagnosis: null,
      matches: [],
      opponents: [],
      karte: emptyKarte(),
      approvals: [],
      sessions: [],
      snapshots: [],
      practiceFocusLog: [],

      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

      completeDiagnosis: (answers) => {
        const s = get();
        const t = provisionalType(answers);
        const karte = structuredClone(s.karte);
        karte.typeHistory.push({
          date: todayStr().slice(0, 7),
          codename: t.codename,
          variant: t.variant,
          stage: 'provisional',
        });
        set({
          diagnosis: answers,
          karte,
          settings: {
            ...s.settings,
            operationStartDate: s.settings.operationStartDate ?? todayStr(),
          },
        });
      },

      addMatch: (m) => set((s) => ({ matches: [...s.matches, m] })),

      // 試合のメタ情報(大会名・種別・メモ)だけを更新する。
      // ラリーデータ・承認状態には触れないのでスナップショットもパイプラインも不要。
      updateMatchMeta: (id, patch) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === id
              ? {
                  ...m,
                  tournament: patch.tournament?.trim() || undefined,
                  kind: patch.kind,
                  note: patch.note?.trim() || undefined,
                }
              : m,
          ),
        })),

      approveMatch: (id) => {
        const s = get();
        const today = todayStr();
        const matches = s.matches.map((m) =>
          m.id === id ? { ...m, approved: true, approvedAt: today } : m,
        );
        const approved = matches.filter((m) => m.approved);
        const snapshot = snapshotOf(s.karte, `試合承認: ${matches.find((m) => m.id === id)?.opponentName ?? id}`);
        const { karte, newApprovals } = runPostApprovalPipeline(
          s.karte, approved, s.diagnosis, s.settings, today, s.approvals,
        );
        set({
          matches,
          karte,
          approvals: [...s.approvals, ...newApprovals],
          snapshots: [snapshot, ...s.snapshots].slice(0, MAX_SNAPSHOTS),
        });
      },

      rejectMatch: (id, reason = '未承認') => {
        const s = get();
        const m = s.matches.find((x) => x.id === id);
        if (!m) return;
        const karte = structuredClone(s.karte);
        karte.missingMatches.push({ id: uid(), date: m.date, opponentName: m.opponentName, reason });
        set({ matches: s.matches.filter((x) => x.id !== id), karte });
      },

      deleteMatch: (id) => set((s) => ({ matches: s.matches.filter((x) => x.id !== id) })),

      resolveApproval: (id, accept) => {
        const s = get();
        const approval = s.approvals.find((a) => a.id === id);
        if (!approval || approval.status !== 'pending') return;
        const approvals = s.approvals.map((a) =>
          a.id === id ? { ...a, status: (accept ? 'approved' : 'rejected') as Approval['status'] } : a,
        );
        if (!accept) {
          set({ approvals });
          return;
        }
        const snapshot = snapshotOf(s.karte, `承認適用: ${approval.kind}`);
        const karte = applyApproval(s.karte, approval, todayStr());
        set({
          approvals,
          karte,
          snapshots: [snapshot, ...s.snapshots].slice(0, MAX_SNAPSHOTS),
        });
      },

      updateKarte: (reason, mutate) => {
        const s = get();
        const snapshot = snapshotOf(s.karte, reason);
        const karte = structuredClone(s.karte);
        mutate(karte);
        set({ karte, snapshots: [snapshot, ...s.snapshots].slice(0, MAX_SNAPSHOTS) });
      },

      rollbackTo: (snapshotId) => {
        const s = get();
        const snap = s.snapshots.find((x) => x.id === snapshotId);
        if (!snap) return;
        const current = snapshotOf(s.karte, 'ロールバック前の状態');
        set({
          karte: structuredClone(snap.karte),
          snapshots: [current, ...s.snapshots].slice(0, MAX_SNAPSHOTS),
        });
      },

      upsertOpponent: (o) => {
        const s = get();
        const idx = s.opponents.findIndex((x) => x.id === o.id);
        const opponents = idx >= 0
          ? s.opponents.map((x) => (x.id === o.id ? o : x))
          : [...s.opponents, o];
        set({ opponents });
      },

      addPracticeLog: (e) => {
        const s = get();
        const karte = structuredClone(s.karte);
        karte.practiceLog.push(e);
        set({ karte });
      },

      appendSession: (log) =>
        set((s) => ({ sessions: [...s.sessions, { ...log, id: uid() }].slice(-100) })),

      recordPracticeFocus: (focus) =>
        set((s) => ({
          practiceFocusLog: [
            { id: uid(), date: todayStr(), focus },
            ...s.practiceFocusLog,
          ].slice(0, 100),
        })),

      loadDemo: () => {
        const demo = buildDemoData(todayStr());
        set({
          settings: demo.settings,
          diagnosis: demo.diagnosis,
          matches: demo.matches,
          opponents: demo.opponents,
          karte: demo.karte,
          approvals: demo.approvals,
          sessions: demo.sessions,
          snapshots: [],
          practiceFocusLog: [],
        });
      },

      resetAll: () =>
        set({
          settings: defaultSettings(),
          diagnosis: null,
          matches: [],
          opponents: [],
          karte: emptyKarte(),
          approvals: [],
          sessions: [],
          snapshots: [],
          practiceFocusLog: [],
        }),
    }),
    {
      name: 'codename-coach-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => {
        const { hydrated, ...rest } = s as AppState & Record<string, unknown>;
        return rest;
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
        // 永続化が空(初回起動)でも描画を開始できるようにする
        useAppStore.setState({ hydrated: true });
      },
    },
  ),
);

/* ---- 派生セレクタ ---- */
export const selectApproved = (s: AppState) => s.matches.filter((m) => m.approved);
export const selectPendingMatches = (s: AppState) => s.matches.filter((m) => !m.approved);
export const selectPendingApprovals = (s: AppState) => s.approvals.filter((a) => a.status === 'pending');
