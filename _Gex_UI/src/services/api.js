/**
 * _Gex OS — API Service (Gene Edition)
 * All backend communication flows through here.
 * Includes workspace auto-load and Gene CLI actions.
 */

export const API_BASE = 'http://localhost:8000/api';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  const resp = await fetch(url, config);

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(body.detail || `HTTP ${resp.status}`);
  }

  return resp.json();
}

// ── Workspace (Gene integration) ──

export async function getWorkspace() {
  return request('/workspace');
}

// ── Repo ──

export async function loadRepo(path) {
  return request('/repo/load', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

export async function getFileTree() {
  return request('/repo/tree');
}

export async function readFile(path) {
  return request(`/repo/file?path=${encodeURIComponent(path)}`);
}

export async function saveFile(path, content) {
  return request('/repo/save', {
    method: 'POST',
    body: JSON.stringify({ path, content }),
  });
}

// ── Run ──

export async function runFile(repoPath, filePath, focus = null) {
  return request('/run/file', {
    method: 'POST',
    body: JSON.stringify({ repo_path: repoPath, file_path: filePath, focus }),
  });
}

export async function applyPatches(payload) {
  // payload: { file_path, accepted_hunks: [0, 1], hunks: [...] }
  return request('/run/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function runRepo(repoPath, focus = null, mode = 'sequential') {
  return request('/run/repo', {
    method: 'POST',
    body: JSON.stringify({ repo_path: repoPath, focus, mode }),
  });
}

export async function getRunStatus(runId) {
  return request(`/run/${runId}/status`);
}

export async function getRunDiffs(runId) {
  return request(`/run/${runId}/diffs`);
}

// ── Settings ──

export async function getSettings() {
  return request('/settings');
}

export async function updateSettings(settings) {
  return request('/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

export async function listModels(apiKey = null) {
  const query = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : '';
  return request(`/settings/models${query}`);
}

// ── Gene CLI Actions ──

export async function geneCLI(action, cwd = null) {
  return request('/gene/cli', {
    method: 'POST',
    body: JSON.stringify({ action, cwd }),
  });
}

// ── WebSocket ──

export function connectRunStream(runId, onMessage) {
  const ws = new WebSocket(`ws://localhost:8000/api/run/ws/${runId}/stream`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };

  ws.onerror = (err) => {
    console.error('[WS] Error:', err);
  };

  return ws;
}
