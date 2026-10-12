import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Copy, MessageSquare, Play } from 'lucide-react';
import { useEditor } from '../store/editor';
import { useUi } from '../store/ui';
import type { Role } from '../types';
import { StaticPage, openLink } from './ElementView';
import { CommentsPanel } from './CollabPanels';
import { Present } from './Present';
import { Logo } from '../components/Logo';
import { api } from '../api';
import { toast } from '../lib/toast';
import { Avatars } from './Presence';

// What people invited with "Can view" or "Can comment" see: the pages, live updates,
// Present, and (for commenters) the comments panel.
export function ReadOnlyDesign({ role, ownerName }: { role: Role; ownerName: string }) {
  const doc = useEditor((s) => s.doc);
  const title = useEditor((s) => s.title);
  const designId = useEditor((s) => s.designId)!;
  const panel = useUi((s) => s.panel);
  const [presenting, setPresenting] = useState(false);
  const navigate = useNavigate();
  const k = Math.min(1, 860 / doc.width);
  const showComments = role === 'comment' && panel === 'comments';
  return (
    <div className="flex h-screen flex-col bg-paper">
      <header className="flex h-14 shrink-0 items-center gap-3 bg-ink px-3 text-white">
        <Link to="/" className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-white/10">
          <ChevronLeft size={16} />
          <Logo size={18} inverted />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="text-[11px] text-white/60">
            by {ownerName} · you can {role === 'comment' ? 'view and comment' : 'view'}
          </div>
        </div>
        <div className="flex-1" />
        <Avatars />
        {role === 'comment' && (
          <button className={`rounded-md p-1.5 hover:bg-white/15 ${showComments ? 'bg-white/15' : ''}`} title="Comments" onClick={() => useUi.getState().setPanel(showComments ? null : 'comments')}>
            <MessageSquare size={18} />
          </button>
        )}
        <button
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-white/15"
          onClick={async () => {
            const d = await api.duplicateDesign(designId);
            toast('Copy added to your designs');
            navigate(`/design/${d.id}`);
          }}
        >
          <Copy size={16} /> Make a copy
        </button>
        <button className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold hover:bg-brand-strong" onClick={() => setPresenting(true)}>
          <Play size={16} /> Present
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <main className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-6 px-4 py-8">
            {doc.pages
              .filter((p) => !p.hidden)
              .map((p) => (
                <div
                  key={p.id}
                  data-readonly-page={doc.pages.indexOf(p)}
                  className="overflow-hidden bg-white shadow-md"
                  style={{ width: doc.width * k, height: doc.height * k }}
                  onClick={() => useEditor.setState({ pageIndex: doc.pages.indexOf(p) })}
                >
                  <div style={{ transform: `scale(${k})`, transformOrigin: 'top left' }}>
                    <StaticPage
                      page={p}
                      width={doc.width}
                      height={doc.height}
                      onLink={(l) => openLink(l, (i) => document.querySelector(`[data-readonly-page="${i}"]`)?.scrollIntoView({ behavior: 'smooth' }))}
                    />
                  </div>
                </div>
              ))}
          </div>
        </main>
        {showComments && (
          <aside className="w-[340px] shrink-0 overflow-y-auto border-l bg-white p-4">
            <CommentsPanel />
          </aside>
        )}
      </div>
      {presenting && <Present doc={doc} onClose={() => setPresenting(false)} />}
    </div>
  );
}
