import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Design } from '../types';
import { StaticPage } from '../editor/ElementView';
import { Present } from '../editor/Present';
import { useAuth } from '../store/auth';
import { toast } from '../lib/toast';

export function SharedPage() {
  const { token } = useParams();
  const [design, setDesign] = useState<(Design & { ownerName: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [width, setWidth] = useState(window.innerWidth);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    api.getShared(token!).then((d) => {
      setDesign(d);
      document.title = `${d.title} – Canvas`;
    }).catch((e) => setError(e.message));
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [token]);

  if (error) return <div className="flex h-screen items-center justify-center text-gray-600">{error}</div>;
  if (!design) return <div className="flex h-screen items-center justify-center text-gray-400">Loading…</div>;

  const { doc } = design;
  const k = Math.min(1, (Math.min(width, 1100) - 32) / doc.width);

  const useTemplate = async () => {
    if (!user) return navigate('/login', { state: { from: `/s/${token}` } });
    const { id } = await api.copyShared(token!);
    toast('Copied to your designs');
    navigate(`/design/${id}`);
  };

  return (
    <div className="min-h-screen bg-[#ebecf0]">
      <header className="flex items-center gap-3 bg-white px-4 py-3 shadow-sm">
        <Link to="/" className="bg-gradient-to-r from-[#00c4cc] to-[#7d2ae8] bg-clip-text text-2xl text-transparent" style={{ fontFamily: 'Pacifico' }}>
          Canvas
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{design.title}</div>
          <div className="text-xs text-gray-500">by {design.ownerName}</div>
        </div>
        <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setPresenting(true)}>
          Present
        </button>
        {design.shareMode === 'template' && (
          <button className="rounded-lg bg-[#8b3dff] px-3 py-1.5 text-sm font-semibold text-white" onClick={useTemplate}>
            Use template
          </button>
        )}
      </header>
      <div className="flex flex-col items-center gap-6 px-4 py-8">
        {doc.pages.map((p) => (
          <div key={p.id} className="overflow-hidden shadow-md" style={{ width: doc.width * k, height: doc.height * k }}>
            <div style={{ transform: `scale(${k})`, transformOrigin: 'top left' }}>
              <StaticPage page={p} width={doc.width} height={doc.height} />
            </div>
          </div>
        ))}
      </div>
      {presenting && <Present doc={doc} onClose={() => setPresenting(false)} />}
    </div>
  );
}
