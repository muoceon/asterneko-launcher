export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="12,20 2,4 22,14" className="fill-primary" />
      <polygon points="52,20 62,4 42,14" className="fill-primary" />
      <rect x="10" y="14" width="44" height="36" rx="12" className="fill-primary" />
      <circle cx="25" cy="32" r="4" className="fill-primary-foreground" />
      <circle cx="39" cy="32" r="4" className="fill-primary-foreground" />
      <polygon points="32,38 27,44 37,44" className="fill-primary-foreground" />
      <line x1="4" y1="46" x2="16" y2="46" className="stroke-primary-foreground" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="52" x2="14" y2="50" className="stroke-primary-foreground" strokeWidth="2" strokeLinecap="round" />
      <line x1="48" y1="46" x2="60" y2="46" className="stroke-primary-foreground" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="50" x2="60" y2="52" className="stroke-primary-foreground" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}