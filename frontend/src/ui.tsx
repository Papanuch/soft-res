/* Petits composants partagés. */
import clsx from 'clsx'
import { Star, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { CANTON_COULEURS, type Avocat } from './api'

export function initiales(nom: string) {
  const w = nom
    .replace(/\(.*?\)/g, '')
    .replace(/^(Me|M\.|Mme|Etude|Étude|L'Etude|L'Étude)\s+/i, '')
    .split(/[\s&/\-–]+/)
    .filter((x) => x && /^[A-Za-zÀ-ÿ]/.test(x))
  return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? '')).toUpperCase() || '⚖'
}

export function Avatar({ a, size = 40 }: { a: Pick<Avocat, 'nom' | 'canton'>; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-xl font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36, background: CANTON_COULEURS[a.canton] ?? '#666' }}
    >
      {initiales(a.nom)}
    </span>
  )
}

export const tarifTxt = (t: string) => `CHF ${t.replace('-', '–')}.–/h`

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

export function Etoiles({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span className="inline-flex" role={onChange ? 'radiogroup' : undefined} aria-label={`Évaluation ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(value === i ? 0 : i)}
          className={clsx('p-0.5', onChange ? 'cursor-pointer' : 'cursor-default')}
          aria-label={`${i} étoile${i > 1 ? 's' : ''}`}
        >
          <Star size={size} className={i <= value ? 'fill-amber-400 text-amber-400' : 'text-line'} />
        </button>
      ))}
    </span>
  )
}

/* Fenêtre modale native (<dialog>) : focus, Échap et fond gérés par le navigateur. */
export function Modal({
  open, onClose, title, children, wide = false, footer,
}: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={clsx(
        'm-auto max-h-[88vh] w-[calc(100%-32px)] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-[2px]',
        wide ? 'max-w-5xl' : 'max-w-xl',
      )}
    >
      {open && (
        <div className="flex max-h-[88vh] flex-col">
          <header className="flex items-center gap-3 border-b border-line px-5 py-4">
            <h2 className="flex-1 text-base font-bold">{title}</h2>
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
              <X size={16} />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

export function Vide({ icon, titre, texte }: { icon: ReactNode; titre: string; texte?: string }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-14 text-center text-muted">
      <span className="text-muted">{icon}</span>
      <b className="text-ink">{titre}</b>
      {texte && <p className="max-w-sm text-sm">{texte}</p>}
    </div>
  )
}

export function Section({ titre, icon, action, children, className }: {
  titre: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={clsx('card p-5', className)}>
      <div className="mb-4 flex items-center gap-2">
        {icon && <span className="text-brand">{icon}</span>}
        <h3 className="flex-1 text-[15px] font-bold">{titre}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Barre({ value, max, color }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${max ? Math.round((value / max) * 100) : 0}%`, background: color ?? 'var(--brand)' }}
      />
    </div>
  )
}
