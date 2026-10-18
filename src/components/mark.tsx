export function Mark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="4" y="5" width="5" height="22" fill="currentColor" />
      <rect x="13.5" y="10" width="5" height="17" fill="#51e076" />
      <rect x="23" y="15" width="5" height="12" fill="currentColor" />
    </svg>
  )
}
