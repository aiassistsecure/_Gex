/**
 * _Gex OS — Global State (Zustand)
 */
import { create } from 'zustand';

const useGexStore = create((set, get) => ({
  // ── Repo state ──
  repo: null,           // { path, name, file_count, tree }
  activeFile: null,     // absolute path
  activeFileContent: '',

  // ── Editor ──
  editorMode: 'edit',   // 'edit' | 'diff'

  // ── Run state ──
  runId: null,
  runState: 'idle',     // idle | running | completed | failed
  progress: 0,
  currentRunFile: null,
  totalFiles: 0,
  processedFiles: 0,

  // ── Results ──
  lastResult: null,     // FileResult from backend
  diffs: {},            // { filepath: FileDiff }
  fileStatuses: {},     // { filepath: 'patched' | 'error' | 'pending' }

  // ── Logs ──
  logs: [],

  // ── Settings UI ──
  showSettings: false,

  // ── Actions ──
  setRepo: (repo) => set({ repo, activeFile: null, activeFileContent: '', diffs: {}, fileStatuses: {}, logs: [] }),
  
  setActiveFile: (path, content) => set({ activeFile: path, activeFileContent: content }),
  
  setEditorMode: (mode) => set({ editorMode: mode }),
  
  setShowSettings: (show) => set({ showSettings: show }),

  setRunState: (state) => set({ runState: state }),
  
  setProgress: (progress) => set({ progress }),

  setLastResult: (result) => {
    const state = get();
    const newDiffs = { ...state.diffs };
    const newStatuses = { ...state.fileStatuses };
    
    if (result.diff) {
      newDiffs[result.file] = result.diff;
    }
    newStatuses[result.file] = result.status;

    set({
      lastResult: result,
      results: [result], // Keep as array for multi-view
      diffs: newDiffs,
      fileStatuses: newStatuses,
      editorMode: result.status === 'patched' ? 'diff' : state.editorMode,
    });
  },

  setResults: (results) => {
    const state = get();
    const newDiffs = { ...state.diffs };
    const newStatuses = { ...state.fileStatuses };
    
    results.forEach(r => {
      if (r.diff) newDiffs[r.file] = r.diff;
      newStatuses[r.file] = r.status;
    });

    set({
      results,
      lastResult: results.find(r => r.status === 'patched') || results[0],
      diffs: newDiffs,
      fileStatuses: newStatuses,
      editorMode: results.some(r => r.status === 'patched') ? 'diff' : state.editorMode,
    });
  },

  addLog: (message, level = 'info') => set((state) => ({
    logs: [...state.logs, { message, level, time: new Date().toISOString() }],
  })),

  clearLogs: () => set({ logs: [] }),

  startRun: (runId, totalFiles) => set({
    runId,
    runState: 'running',
    progress: 0,
    totalFiles,
    processedFiles: 0,
    currentRunFile: null,
  }),

  updateRunProgress: (file, processed, total) => set({
    currentRunFile: file,
    processedFiles: processed,
    totalFiles: total,
    progress: total > 0 ? processed / total : 0,
  }),

  completeRun: () => set({
    runState: 'completed',
    progress: 1,
    currentRunFile: null,
  }),

  failRun: (error) => set({
    runState: 'failed',
    currentRunFile: null,
  }),

  resetRun: () => set({
    runId: null,
    runState: 'idle',
    progress: 0,
    currentRunFile: null,
    totalFiles: 0,
    processedFiles: 0,
  }),
}));

export default useGexStore;
