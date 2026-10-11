import { useMemo, useState, type DragEvent } from 'react';
import { icons } from 'lucide-react';
import { useEditor } from '../store/editor';
import { makeIcon } from '../lib/factory';

const NAMES = Object.keys(icons);
const FEATURED = [
  'Heart', 'Star', 'Sparkles', 'Sun', 'Moon', 'Cloud', 'Leaf', 'Flower2', 'Coffee', 'Camera', 'Music', 'Gift',
  'Rocket', 'Zap', 'Flame', 'Crown', 'FaceSlightlySmiling', 'ThumbsUp', 'MapPin', 'Phone', 'Mail', 'Globe', 'ShoppingBag', 'Check',
].filter((n) => n in icons);

export default function IconSearch() {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return FEATURED;
    return NAMES.filter((n) => n.toLowerCase().includes(needle)).slice(0, 120);
  }, [q]);
  return (
    <>
      <input
        className="mb-3 w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm outline-none focus:border-brand"
        placeholder={`Search ${NAMES.length} icons`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="grid grid-cols-6 gap-1">
        {results.map((name) => {
          const Icon = icons[name as keyof typeof icons];
          return (
            <button
              key={name}
              title={name}
              draggable
              onDragStart={(e: DragEvent) => e.dataTransfer.setData('application/x-design-element', JSON.stringify(makeIcon(name)))}
              onClick={() => useEditor.getState().addElement(makeIcon(name))}
              className="flex h-11 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100"
            >
              <Icon size={22} />
            </button>
          );
        })}
      </div>
      {!results.length && <p className="text-xs text-gray-500">No icons match “{q}”.</p>}
    </>
  );
}
