import type { BrandKit, Design, DesignDoc, DesignSummary, UploadItem, User } from './types';

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
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

  listDesigns: (view: 'all' | 'starred' | 'trash', q = '') =>
    request<DesignSummary[]>(`/api/designs?view=${view}&q=${encodeURIComponent(q)}`),
  createDesign: (title: string, doc: DesignDoc) => request<Design>('/api/designs', json('POST', { title, doc })),
  getDesign: (id: string) => request<Design>(`/api/designs/${id}`),
  updateDesign: (
    id: string,
    patch: Partial<{ title: string; doc: DesignDoc; thumbnail: string; starred: boolean; trashed: boolean }>,
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

  listUploads: () => request<UploadItem[]>('/api/uploads'),
  upload: (file: File, width?: number, height?: number) => {
    const form = new FormData();
    form.append('file', file);
    if (width) form.append('width', String(width));
    if (height) form.append('height', String(height));
    return request<UploadItem>('/api/uploads', { method: 'POST', body: form });
  },
  deleteUpload: (id: string) => request<{ ok: true }>(`/api/uploads/${id}`, json('DELETE')),

  getBrandKit: () => request<BrandKit>('/api/brand-kit'),
  saveBrandKit: (kit: BrandKit) => request<BrandKit>('/api/brand-kit', json('PUT', kit)),
};
