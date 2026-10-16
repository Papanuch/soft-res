import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Briefcase, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, type Mandat } from '../api'
import { useApp } from '../store'
import { Etoiles, fmtDate, Vide } from '../ui'

export function Mandats() {
  const app = useApp()
  const qc = useQueryClient()
  const mandats = useQuery({ queryKey: ['mandats'], queryFn: () => api.mandats() })
  const [q, setQ] = useState('')
  const [statut, setStatut] = useState<'tous' | 'en cours' | 'clos'>('tous')
  const maj = useMutation({
    mutationFn: ({ id, m }: { id: number; m: Partial<Mandat> }) => api.modifierMandat(id, m),
    onSuccess: () => qc.invalidateQueries(),
  })
  const suppr = useMutation({
    mutationFn: api.supprimerMandat,
    onSuccess: () => { toast.success('Mandat supprimé'); qc.invalidateQueries() },
  })

  const t = q.trim().toLowerCase()
  const liste = (mandats.data ?? []).filter(
    (m) => (statut === 'tous' || m.statut === statut) &&
      (!t || [m.ref, m.avocat, m.assure, m.adverse, m.matiere].some((x) => x.toLowerCase().includes(t))),
  )
  const n = (s: string) => (mandats.data ?? []).filter((m) => m.statut === s).length

  return (
    <div className="mx-auto max-w-[1300px] p-7">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-muted" />
          <input className="input !pl-9" placeholder="Référence, avocat, assuré, partie adverse…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {([['tous', `Tous (${mandats.data?.length ?? 0})`], ['en cours', `En cours (${n('en cours')})`], ['clos', `Clos (${n('clos')})`]] as const).map(([v, l]) => (
            <button key={v} className={clsx('chip !px-3 !py-1.5', statut === v && 'chip-on')} onClick={() => setStatut(v)}>{l}</button>
          ))}
        </div>
      </div>
      {liste.length === 0 && mandats.isSuccess ? (
        <Vide icon={<Briefcase size={30} />} titre="Aucun mandat" texte="Ajoutez un mandat depuis la fiche d’un avocat ou depuis un courrier." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>{['Date', 'Réf.', 'Avocat', 'Assuré·e', 'Partie adverse', 'Matière', 'Statut', 'Évaluation', ''].map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {liste.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="whitespace-nowrap px-3 py-2">{fmtDate(m.date)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.ref || '—'}</td>
                  <td className="px-3 py-2"><button className="font-semibold hover:text-brand" onClick={() => app.ouvrirFiche(m.lawyer_id)}>{m.avocat}</button></td>
                  <td className="px-3 py-2">{m.assure}</td>
                  <td className="px-3 py-2">{m.adverse}</td>
                  <td className="px-3 py-2 text-muted">{m.matiere}</td>
                  <td className="px-3 py-2">
                    <button
                      className={clsx('tag', m.statut === 'en cours' ? 'bg-info-soft text-info' : '')}
                      title="Changer le statut"
                      onClick={() => maj.mutate({ id: m.id, m: { statut: m.statut === 'en cours' ? 'clos' : 'en cours' } })}
                    >{m.statut}</button>
                  </td>
                  <td className="px-3 py-2"><Etoiles value={m.evaluation} size={14} onChange={(v) => maj.mutate({ id: m.id, m: { evaluation: v } })} /></td>
                  <td className="px-3 py-2 text-right">
                    <button className="btn btn-ghost btn-sm" aria-label="Supprimer" onClick={() => confirm(`Supprimer le mandat ${m.ref || m.assure} ?`) && suppr.mutate(m.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
