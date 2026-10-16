import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { useApp } from '../store'
import { fmtDate, Vide } from '../ui'

export function Conflits() {
  const app = useApp()
  const [nom, setNom] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQ(nom.trim()), 300)
    return () => clearTimeout(t)
  }, [nom])
  const hits = useQuery({ queryKey: ['conflits', q], queryFn: () => api.conflits(q), enabled: q.length >= 2 })

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 p-7">
      <div className="card p-6">
        <h2 className="text-lg font-bold">Contrôle de conflit d’intérêts</h2>
        <p className="mt-1 text-sm text-muted">
          Cherche un nom (personne ou société) dans tous les mandats, comme assuré·e ou partie adverse. La recherche tolère
          les fautes de frappe et ignore les formes juridiques (SA, Sàrl…) et les titres.
        </p>
        <input autoFocus className="input mt-4 !py-2.5 !text-[15px]" placeholder="Nom à contrôler, ex. Dupont Construction SA" value={nom} onChange={(e) => setNom(e.target.value)} />
      </div>
      {q.length < 2 ? (
        <Vide icon={<ShieldQuestion size={30} />} titre="Saisissez un nom" />
      ) : hits.data && hits.data.length === 0 ? (
        <div className="card flex items-center gap-3 p-5 text-ok"><ShieldCheck /> Aucun mandat ne mentionne « {q} ».</div>
      ) : hits.data ? (
        <div className="card overflow-x-auto">
          <div className="flex items-center gap-2 border-b border-line p-4 font-semibold text-warn">
            <ShieldAlert size={18} /> {hits.data.length} correspondance{hits.data.length > 1 ? 's' : ''}
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>{['Similarité', 'Rôle', 'Avocat', 'Assuré·e', 'Partie adverse', 'Réf.', 'Date'].map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {hits.data.map((h) => (
                <tr key={`${h.mandat_id}-${h.role}`} className="border-t border-line hover:bg-surface-2">
                  <td className="px-3 py-2 font-bold">{Math.round(h.score)} %</td>
                  <td className="px-3 py-2"><span className="tag">{h.role}</span></td>
                  <td className="px-3 py-2"><button className="font-semibold hover:text-brand" onClick={() => app.ouvrirFiche(h.lawyer_id)}>{h.avocat}</button></td>
                  <td className="px-3 py-2">{h.assure}</td>
                  <td className="px-3 py-2">{h.adverse}</td>
                  <td className="px-3 py-2 font-mono text-xs">{h.ref || '—'}</td>
                  <td className="px-3 py-2">{fmtDate(h.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
