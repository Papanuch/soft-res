import { useQuery } from '@tanstack/react-query'
import { api, CANTON_COULEURS } from '../api'
import { useApp } from '../store'
import { SwissMap } from '../SwissMap'

export function CartePage() {
  const app = useApp()
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats })
  const s = stats.data
  return (
    <div className="mx-auto grid max-w-[1400px] gap-5 p-7 lg:grid-cols-[1fr_320px]">
      <div className="card p-4">
        <SwissMap
          onCanton={(c) => app.ouvrirAnnuaire({ cantons: [c] })}
          onVille={(v) => app.ouvrirAnnuaire({ pres_de: v, rayon: 10 })}
        />
        <p className="mt-2 px-1 text-xs text-muted">
          Chaque cercle est une ville du réseau, sa taille suit le nombre d’avocats. Cliquer ouvre l’annuaire filtré.
        </p>
      </div>
      <div className="space-y-3">
        {s && Object.entries(s.par_canton).sort((a, b) => b[1].n - a[1].n).map(([c, x]) => (
          <button
            key={c}
            onClick={() => app.ouvrirAnnuaire({ cantons: [c] })}
            className="card block w-full p-4 text-left transition hover:border-brand/50"
          >
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: CANTON_COULEURS[c] }} />
              <b className="flex-1">{x.nom}</b>
              <span className="text-sm font-bold">{x.n}</span>
            </div>
            <div className="mt-1.5 grid grid-cols-3 text-xs text-muted">
              <span>{x.villes} ville{x.villes > 1 ? 's' : ''}</span>
              <span>{x.fsa} FSA</span>
              <span>CHF {x.tarif_min}–{x.tarif_max}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
