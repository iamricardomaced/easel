// Wordmark: an easel-leg mark and the name set in Space Grotesk.
export function Logo({ size = 24, inverted = false }: { size?: number; inverted?: boolean }) {
  const ink = inverted ? '#ffffff' : '#16181d';
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: size, color: ink }}>
      <svg width={size * 1.05} height={size * 1.05} viewBox="0 0 32 32" aria-hidden>
        <rect x="6" y="3" width="20" height="15" rx="2.5" fill="#ff5c39" />
        <path d="M11 18 7 29M21 18l4 11M16 18v8" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      easel
    </span>
  );
}
