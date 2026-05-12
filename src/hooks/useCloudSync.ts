import { useState, useCallback, useRef } from 'react';
import type { CloudSyncState } from '../types';
import { CLOUD_KEYS_TO_SYNC, CLOUD_GIST_FILENAME } from '../lib/constants';

const DEBOUNCE_MS = 2000;

export function useCloudSync() {
  const [syncState, setSyncState] = useState<CloudSyncState>(() => ({
    token: localStorage.getItem('cloud_github_token'),
    gistId: localStorage.getItem('cloud_gist_id'),
    status: localStorage.getItem('cloud_github_token') ? 'idle' : 'not-configured',
    lastSync: parseInt(localStorage.getItem('cloud_last_sync') || '0') || null,
  }));

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRef  = useRef(false);

  const isConfigured = useCallback(() => !!syncState.token, [syncState.token]);

  const collectData = useCallback(() => {
    const data: Record<string, unknown> = {
      _version: 1,
      _savedAt: new Date().toISOString(),
    };
    CLOUD_KEYS_TO_SYNC.forEach(key => {
      const v = localStorage.getItem(key);
      if (v != null) data[key] = v;
    });
    return data;
  }, []);

  const applyData = useCallback((data: Record<string, string>) => {
    let applied = 0;
    CLOUD_KEYS_TO_SYNC.forEach(key => {
      if (data[key] != null) {
        localStorage.setItem(key, data[key]);
        applied++;
      }
    });
    return applied > 0;
  }, []);

  const push = useCallback(async (silent = false): Promise<boolean> => {
    const token = localStorage.getItem('cloud_github_token');
    const gistId = localStorage.getItem('cloud_gist_id');
    if (!token) return false;
    if (syncingRef.current) return false;
    syncingRef.current = true;

    if (!silent) setSyncState(s => ({ ...s, status: 'saving' }));

    try {
      const payload = JSON.stringify(collectData(), null, 2);
      const body = {
        description: 'Império Digital · Backup automático',
        public: false,
        files: { [CLOUD_GIST_FILENAME]: { content: payload } },
      };

      const url = gistId
        ? `https://api.github.com/gists/${gistId}`
        : 'https://api.github.com/gists';
      const method = gistId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`GitHub API ${res.status}: ${errText}`);
      }

      const gist = await res.json() as { id: string };
      if (!gistId) {
        localStorage.setItem('cloud_gist_id', gist.id);
      }

      const now = Date.now();
      localStorage.setItem('cloud_last_sync', String(now));
      syncingRef.current = false;
      setSyncState(s => ({
        ...s,
        gistId: gist.id,
        status: 'ok',
        lastSync: now,
      }));
      return true;
    } catch (err) {
      syncingRef.current = false;
      setSyncState(s => ({ ...s, status: 'error' }));
      console.error('Erro ao salvar na nuvem:', err);
      return false;
    }
  }, [collectData]);

  const pull = useCallback(async (silent = false): Promise<boolean> => {
    const token = localStorage.getItem('cloud_github_token');
    const gistId = localStorage.getItem('cloud_gist_id');
    if (!token || !gistId) return false;
    if (syncingRef.current) return false;
    syncingRef.current = true;

    if (!silent) setSyncState(s => ({ ...s, status: 'saving' }));

    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!res.ok) {
        if (res.status === 404 && silent) {
          localStorage.removeItem('cloud_gist_id');
          syncingRef.current = false;
          setSyncState(s => ({ ...s, gistId: null, status: 'idle' }));
          return false;
        }
        throw new Error(`GitHub API ${res.status}`);
      }

      const gist = await res.json() as { files: Record<string, { content: string }> };
      const file = gist.files[CLOUD_GIST_FILENAME];
      if (!file) throw new Error('Arquivo de dados não encontrado no Gist');

      const data = JSON.parse(file.content) as Record<string, string> & { _savedAt?: string };
      const remotoTs = data._savedAt ? new Date(data._savedAt).getTime() : 0;
      const localTs  = parseInt(localStorage.getItem('cloud_last_sync') || '0');

      if (remotoTs > localTs) {
        applyData(data);
        const now = Date.now();
        localStorage.setItem('cloud_last_sync', String(now));
        syncingRef.current = false;
        setSyncState(s => ({ ...s, status: 'ok', lastSync: now }));
        // Reload to pick up new data
        window.location.reload();
        return true;
      }

      syncingRef.current = false;
      setSyncState(s => ({ ...s, status: 'ok' }));
      return true;
    } catch (err) {
      syncingRef.current = false;
      setSyncState(s => ({ ...s, status: 'error' }));
      console.error('Erro ao carregar da nuvem:', err);
      return false;
    }
  }, [applyData]);

  const scheduleSync = useCallback(() => {
    const token = localStorage.getItem('cloud_github_token');
    if (!token) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      push(true);
    }, DEBOUNCE_MS);
  }, [push]);

  const connect = useCallback((token: string, gistId: string | null) => {
    localStorage.setItem('cloud_github_token', token);
    if (gistId) {
      localStorage.setItem('cloud_gist_id', gistId);
    } else {
      localStorage.removeItem('cloud_gist_id');
    }
    setSyncState(s => ({ ...s, token, gistId, status: 'idle' }));
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem('cloud_github_token');
    localStorage.removeItem('cloud_gist_id');
    localStorage.removeItem('cloud_last_sync');
    setSyncState({ token: null, gistId: null, status: 'not-configured', lastSync: null });
  }, []);

  const timeAgo = useCallback((ts: number | null): string => {
    if (!ts) return 'nunca';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    return `${Math.floor(diff / 86400000)}d atrás`;
  }, []);

  return { syncState, isConfigured, push, pull, scheduleSync, connect, disconnect, timeAgo };
}
