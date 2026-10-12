import type { BrandKit, Comment, Design, DesignDoc, DesignSummary, Folder, Member, Role, UploadItem, User, VersionSummary } from './types';

// Identifies this browser tab, so the server doesn't echo our own saves back to us.
export const CLIENT_ID = Math.random().toString(36).slice(2, 12);

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Client-Id': CLIENT_ID };
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { credentials: 'include', ...init, headers: { ...headers, ...(init.headers as object) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  me: () => request<User>('/api/auth/me'),
  login: (email: string, password: string) => request<User>('/api/auth/login', json('POST', { email, password })),
  signup: (email: string, name: string, password: string) =>
    request<User>('/api/auth/signup', json('POST', { email, name, password })),
  logout: () => request<{ ok: true }>('/api/auth/logout', json('POST')),

  listDesigns: (view: 'all' | 'starred' | 'trash' | 'shared', q = '', folder?: string) =>
    request<DesignSummary[]>(`/api/designs?view=${view}&q=${encodeURIComponent(q)}${folder ? `&folder=${folder}` : ''}`),
  createDesign: (title: string, doc: DesignDoc) => request<Design>('/api/designs', json('POST', { title, doc })),
  getDesign: (id: string) => request<Design & { role: Role; ownerName: string }>(`/api/designs/${id}`),
  listMembers: (id: string) => request<Member[]>(`/api/designs/${id}/members`),
  addMember: (id: string, email: string, role: Exclude<Role, 'owner'>) => request<Member>(`/api/designs/${id}/members`, json('POST', { email, role })),
  removeMember: (id: string, uid: string) => request<{ ok: true }>(`/api/designs/${id}/members/${uid}`, json('DELETE')),
  sendCursor: (id: string, page: number, selected: string[]) =>
    request<{ ok: true }>(`/api/designs/${id}/cursor`, json('POST', { client: CLIENT_ID, page, selected })),
  updateDesign: (
    id: string,
    patch: Partial<{ title: string; doc: DesignDoc; thumbnail: string; starred: boolean; trashed: boolean; folderId: string | null }>,
  ) => request<DesignSummary>(`/api/designs/${id}`, json('PATCH', patch)),
  duplicateDesign: (id: string) => request<DesignSummary>(`/api/designs/${id}/duplicate`, json('POST')),
  deleteDesign: (id: string) => request<{ ok: true }>(`/api/designs/${id}`, json('DELETE')),
  share: (id: string, mode: 'view' | 'template' | null) =>
    request<{ shareToken: string | null; shareMode: 'view' | 'template' | null }>(
      `/api/designs/${id}/share`,
      json('POST', { mode }),
    ),
  getShared: (token: string) => request<Design & { ownerName: string }>(`/api/shared/${token}`),
  copyShared: (token: string) => request<{ id: string }>(`/api/shared/${token}/copy`, json('POST')),

  listUploads: (kind?: UploadItem['kind']) => request<UploadItem[]>(`/api/uploads${kind ? `?kind=${kind}` : ''}`),
  upload: (file: File, meta: { width?: number; height?: number; duration?: number; poster?: string } = {}) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(meta)) if (v) form.append(k, String(v));
    form.append('file', file);
    return request<UploadItem>('/api/uploads', { method: 'POST', body: form });
  },
  deleteUpload: (id: string) => request<{ ok: true }>(`/api/uploads/${id}`, json('DELETE')),

  listVersions: (id: string) => request<VersionSummary[]>(`/api/designs/${id}/versions`),
  getVersion: (id: string, vid: string) => request<VersionSummary & { doc: DesignDoc }>(`/api/designs/${id}/versions/${vid}`),
  saveVersion: (id: string, name: string) => request<{ id: string }>(`/api/designs/${id}/versions`, json('POST', { name })),
  restoreVersion: (id: string, vid: string) => request<Design>(`/api/designs/${id}/versions/${vid}/restore`, json('POST')),

  listComments: (id: string) => request<Comment[]>(`/api/designs/${id}/comments`),
  addComment: (id: string, c: { text: string; pageId?: string; elementId?: string | null; parentId?: string }) =>
    request<Comment>(`/api/designs/${id}/comments`, json('POST', c)),
  updateComment: (cid: string, patch: { resolved?: boolean; text?: string }) => request<Comment>(`/api/comments/${cid}`, json('PATCH', patch)),
  deleteComment: (cid: string) => request<{ ok: true }>(`/api/comments/${cid}`, json('DELETE')),

  listFolders: () => request<Folder[]>('/api/folders'),
  createFolder: (name: string) => request<Folder>('/api/folders', json('POST', { name })),
  renameFolder: (fid: string, name: string) => request<{ ok: true }>(`/api/folders/${fid}`, json('PATCH', { name })),
  deleteFolder: (fid: string) => request<{ ok: true }>(`/api/folders/${fid}`, json('DELETE')),

  getBrandKit: () => request<BrandKit>('/api/brand-kit'),
  saveBrandKit: (kit: BrandKit) => request<BrandKit>('/api/brand-kit', json('PUT', kit)),
};
