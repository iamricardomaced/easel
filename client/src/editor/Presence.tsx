import { useEditor } from '../store/editor';
import { useLive } from '../lib/live';
import type { DesignElement } from '../types';

// Avatars of the other people who have this design open.
export function Avatars() {
  const people = useLive((s) => s.people);
  if (!people.length) return null;
  // One avatar per person even if they have several tabs open.
  const unique = [...new Map(people.map((p) => [p.id, p])).values()];
  return (
    <div className="mr-1 flex -space-x-2" data-testid="avatars">
      {unique.slice(0, 5).map((p) => (
        <span
          key={p.id}
          title={`${p.name} is here${p.cursor ? ` (page ${p.cursor.page + 1})` : ''}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-xs font-bold text-white"
          style={{ background: p.color }}
        >
          {p.name[0]?.toUpperCase()}
        </span>
      ))}
      {unique.length > 5 && <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-gray-600 text-xs">+{unique.length - 5}</span>}
    </div>
  );
}

// Outlines of what collaborators have selected on this page, with their name.
export function RemoteSelections({ index, zoom }: { index: number; zoom: number }) {
  const people = useLive((s) => s.people);
  const elements = useEditor((s) => s.doc.pages[index]?.elements);
  if (!elements) return null;
  return (
    <>
      {people.flatMap((p) =>
        p.cursor && p.cursor.page === index
          ? p.cursor.selected
              .map((id) => elements.find((e) => e.id === id))
              .filter((e): e is DesignElement => !!e)
              .map((e, i) => (
                <div
                  key={`${p.clientId}-${e.id}`}
                  className="pointer-events-none absolute"
                  style={{
                    left: e.x * zoom,
                    top: e.y * zoom,
                    width: e.w * zoom,
                    height: e.h * zoom,
                    transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined,
                    outline: `2px solid ${p.color}`,
                  }}
                  data-testid="remote-selection"
                >
                  {i === 0 && (
                    <span className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: p.color }}>
                      {p.name}
                    </span>
                  )}
                </div>
              ))
          : [],
      )}
    </>
  );
}
