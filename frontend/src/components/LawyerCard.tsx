import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { BadgeCheck, FileText, Heart, MapPin, Phone, StickyNote } from 'lucide-react'
import { toast } from 'sonner'
import { api, court, type Avocat } from '../api'
import { useApp } from '../store'
import { Avatar, tarifTxt } from '../ui'

export function useFavori() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) => api.favori(id, on),
    onSuccess: (_, v) => {
      toast(v.on ? 'Ajouté aux favoris' : 'Retiré des favoris')
      qc.invalidateQueries()
    },
  })
}

export function LawyerCard({ a, selected, onHover }: { a: Avocat; selected?: boolean; onHover?: (a: Avocat | null) => void }) {
  const app = useApp()
  const fav = useFavori()
  return (
    <article
      tabIndex={0}
      onClick={() => app.ouvrirFiche(a.id)}
      onKeyDown={(e) => e.key === 'Enter' && app.ouvrirFiche(a.id)}
      onMouseEnter={() => onHover?.(a)}
      onMouseLeave={() => onHover?.(null)}
      className={clsx(
        'group card flex cursor-pointer items-start gap-3.5 p-4 transition hover:-translate-y-px hover:border-brand/50',
        selected && 'border-brand ring-2 ring-brand/20',
      )}
    >
      <Avatar a={a} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h4 className="min-w-0 flex-1 truncate text-[14.5px] font-bold">{a.nom}</h4>
          {a.fsa && (
            <span className="tag shrink-0 bg-info-soft text-info" title="Spécialiste FSA">
              <BadgeCheck size={12} /> FSA
            </span>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          <MapPin size={12} /> {a.ville} · {a.canton_nom}
          {a.distance != null && <b className="ml-1 text-ink-2">· {a.distance.toFixed(0)} km</b>}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {(a.specs.length ? a.specs : a.domaines).slice(0, 4).map((s) => (
            <span key={s} className="tag">{court(s)}</span>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-3 text-xs text-muted">
          <b className="text-ink">{tarifTxt(a.tarif)}</b>
          {a.mandats > 0 && (
            <span>
              {a.mandats} mandat{a.mandats > 1 ? 's' : ''}
              {a.evaluation ? ` · ★ ${a.evaluation}` : ''}
            </span>
          )}
          {a.note && <StickyNote size={13} className="text-warn" aria-label="Note" />}
        </div>
      </div>
      <div className="flex flex-col gap-1 opacity-70 transition group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <button
          className={clsx('btn btn-ghost btn-sm', a.favori && 'text-brand')}
          title={a.favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={() => fav.mutate({ id: a.id, on: !a.favori })}
        >
          <Heart size={15} className={a.favori ? 'fill-current' : ''} />
        </button>
        <button className="btn btn-ghost btn-sm" title="Courrier de mandat" onClick={() => app.ouvrirCourrier(a.id)}>
          <FileText size={15} />
        </button>
        {a.tel && (
          <a className="btn btn-ghost btn-sm" title={`Appeler ${a.tel}`} href={`tel:${a.tel.replace(/\s/g, '')}`}>
            <Phone size={15} />
          </a>
        )}
      </div>
    </article>
  )
}
