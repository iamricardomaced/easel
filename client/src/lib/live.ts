import { useEffect } from 'react';
import { create } from 'zustand';
import { api, CLIENT_ID } from '../api';
import { useEditor } from '../store/editor';
import { useComments } from '../editor/CollabPanels';
import type { Collaborator, DesignDoc, Role } from '../types';
import { mergeDocs } from './merge';
import { toast } from './toast';

// Real-time collaboration: everyone with the design open receives each saved change
// over Server-Sent Events, sees who else is here and what they have selected.

export const sync: { base: DesignDoc | null; pending: boolean; remoteTitle: string | null } = { base: null, pending: false, remoteTitle: null };

interface LiveState {
  people: Collaborator[];
  connected: boolean;
  role: Role;
}
export const useLive = create<LiveState>(() => ({ people: [], connected: false, role: 'owner' }));

function applyRemote(remote: DesignDoc) {
  const s = useEditor.getState();
  const doc = sync.pending && sync.base ? mergeDocs(sync.base, s.doc, remote) : remote;
  sync.base = remote;
  const pageIndex = Math.min(s.pageIndex, doc.pages.length - 1);
  const ids = new Set(doc.pages[pageIndex].elements.map((e) => e.id));
  useEditor.setState({
    doc,
    pageIndex,
    selectedIds: s.selectedIds.filter((id) => ids.has(id)),
    editingId: s.editingId && ids.has(s.editingId) ? s.editingId : null,
  });
}

export function useLiveSync(designId: string | null, loaded: boolean) {
  useEffect(() => {
    if (!designId || !loaded) return;
    sync.base = structuredClone(useEditor.getState().doc);
    sync.pending = false;
    const es = new EventSource(`/api/designs/${designId}/events?client=${CLIENT_ID}`, { withCredentials: true });
    es.onopen = () => useLive.setState({ connected: true });
    es.onerror = () => useLive.setState({ connected: false });
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'doc') {
        applyRemote(msg.doc);
        if (msg.title !== useEditor.getState().title) {
          sync.remoteTitle = msg.title;
          useEditor.getState().setTitle(msg.title);
        }
      } else if (msg.type === 'presence') {
        const people = (msg.people as Collaborator[]).filter((p) => p.clientId !== CLIENT_ID);
        const before = new Set(useLive.getState().people.map((p) => p.clientId));
        for (const p of people) if (!before.has(p.clientId) && useLive.getState().connected) toast(`${p.name} joined`);
        useLive.setState({ people });
      } else if (msg.type === 'comments') useComments.getState().load(designId);
    };
    // Tell the others what we are looking at.
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.selectedIds === prev.selectedIds && s.pageIndex === prev.pageIndex) return;
      clearTimeout(t);
      t = setTimeout(() => api.sendCursor(designId, s.pageIndex, s.selectedIds).catch(() => {}), 250);
    });
    return () => {
      es.close();
      unsub();
      clearTimeout(t);
      useLive.setState({ people: [], connected: false });
    };
  }, [designId, loaded]);
}
