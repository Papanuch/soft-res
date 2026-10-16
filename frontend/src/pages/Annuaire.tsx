import { keepPreviousData, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { BadgeCheck, Download, Heart, Plus, RotateCcw, Search, SearchX, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, CANTONS, court, FILTRES_VIDES, SPECS, type Avocat, type Filtres } from '../api'
import { LawyerCard } from '../components/LawyerCard'
import { NouvelAvocat } from '../components/NouvelAvocat'
import { useApp } from '../store'
import { SwissMap } from '../SwissMap'
import { Vide } from '../ui'

const TRIS: [string, string][] = [
  ['pertinence', 'Pertinence'], ['nom', 'Nom A→Z'], ['tarif-asc', 'Tarif croissant'], ['tarif-desc', 'Tarif décroissant'],
  ['ville', 'Ville A→Z'], ['canton', 'Canton'], ['rotation', 'À qui le tour ?'],
]

function useDebounce<T>(v: T, ms: number) {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

export function Annuaire() {
  const app = useApp()
  const f = app.filtres
  const set = (patch: Partial<Filtres>) => app.setFiltres((x) => ({ ...x, ...patch }))
  const fd = useDebounce(f, 150)
  const res = useQuery({ queryKey: ['annuaire', fd], queryFn: () => api.annuaire(fd), placeholderData: keepPreviousData })
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats })
  const qDebounce = useDebounce(f.q, 350)
  const nl = useQuery({ queryKey: ['nl', qDebounce], queryFn: () => api.interpreter(qDebounce), enabled: qDebounce.trim().split(/\s+/).length >= 2 })
  const [survol, setSurvol] = useState<Avocat | null>(null)
  const [ajout, setAjout] = useState(false)
  const [lieu, setLieu] = useState(f.pres_de)
  useEffect(() => setLieu(f.pres_de), [f.pres_de])
  const lieux = useQuery({ queryKey: ['lieux', lieu], queryFn: () => api.lieux(lieu), enabled: lieu.length >= 2 && lieu !== f.pres_de })

  const bornes = stats.data?.tarif_bornes ?? [180, 350]
  const toggle = (k: 'cantons' | 'specs', v: string) => set({ [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] })
  const actifs = JSON.stringify({ ...f, tri: '' }) !== JSON.stringify({ ...FILTRES_VIDES, tri: '' })
  const liste = res.data?.avocats ?? []

  return (
    <div className="grid min-h-full grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)_420px]">
      {/* Filtres */}
      <aside className="space-y-5 border-r border-line bg-surface-2/60 p-5">
        <div className="flex items-center">
          <h3 className="eyebrow flex-1">Filtres</h3>
          {actifs && (
            <button className="btn btn-ghost btn-sm" onClick={() => app.setFiltres({ ...FILTRES_VIDES, tri: f.tri })}>
              <RotateCcw size={13} /> Réinitialiser
            </button>
          )}
        </div>
        <div>
          <span className="label">Spécialités</span>
          <div className="flex flex-wrap gap-1.5">
            {SPECS.map((s) => (
              <button key={s} className={clsx('chip', f.specs.includes(s) && 'chip-on')} onClick={() => toggle('specs', s)}>
                {court(s)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Cantons</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(CANTONS).map(([c, n]) => (
              <button key={c} className={clsx('chip', f.cantons.includes(c) && 'chip-on')} onClick={() => toggle('cantons', c)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label flex">
            <span className="flex-1">Tarif horaire max.</span>
            <b className="text-ink">{f.tarif_max ? `CHF ${f.tarif_max}.–` : 'Tous'}</b>
          </span>
          <input
            type="range"
            className="w-full accent-[var(--brand)]"
            min={bornes[0]}
            max={bornes[1]}
            step={10}
            value={f.tarif_max ?? bornes[1]}
            onChange={(e) => set({ tarif_max: +e.target.value >= bornes[1] ? null : +e.target.value })}
          />
        </div>
        <div className="relative">
          <span className="label">Près de</span>
          <input
            className="input"
            placeholder="NPA ou ville"
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && set({ pres_de: lieu })}
            onBlur={() => setTimeout(() => lieu !== f.pres_de && set({ pres_de: lieu }), 150)}
          />
          {lieux.data && lieux.data.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-card">
              {lieux.data.map((l) => (
                <li key={l.valeur + l.libelle}>
                  <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-3" onMouseDown={() => set({ pres_de: l.valeur })}>
                    {l.libelle}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {f.pres_de && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-muted">Rayon</span>
              <input type="range" min={5} max={100} step={5} value={f.rayon} className="flex-1 accent-[var(--brand)]" onChange={(e) => set({ rayon: +e.target.value })} />
              <b className="w-12 text-right">{f.rayon} km</b>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.fsa} onChange={(e) => set({ fsa: e.target.checked })} />
            <BadgeCheck size={15} className="text-info" /> Spécialistes FSA uniquement
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.favoris} onChange={(e) => set({ favoris: e.target.checked })} />
            <Heart size={15} className="text-brand" /> Mes favoris uniquement
          </label>
        </div>
        <div className="space-y-2 border-t border-line pt-4">
          <button className="btn w-full" onClick={() => setAjout(true)}><Plus size={15} /> Ajouter un avocat</button>
          <a className="btn w-full" href="/api/export.csv"><Download size={15} /> Exporter en CSV</a>
        </div>
      </aside>

      {/* Résultats */}
      <section className="min-w-0 p-6">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-3 text-muted" />
          <input
            id="recherche"
            className="input !rounded-2xl !py-2.5 !pl-10 !text-[15px]"
            placeholder="Nom, ville, domaine… ou une phrase : « bail Lausanne 20 km max 280 FSA »"
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && nl.data && app.setFiltres({ ...nl.data.filters, tri: f.tri })}
          />
          {f.q && (
            <button className="absolute right-3 top-2.5 text-muted hover:text-ink" onClick={() => set({ q: '' })} aria-label="Effacer">
              <X size={18} />
            </button>
          )}
        </div>
        {nl.data && f.q === qDebounce && (
          <button
            className="mt-2 flex w-full items-center gap-2 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-left text-sm text-brand"
            onClick={() => app.setFiltres({ ...nl.data!.filters, tri: f.tri })}
          >
            <Sparkles size={15} /> Interpréter : <b>{nl.data.resume}</b> <span className="ml-auto text-xs opacity-70">Entrée</span>
          </button>
        )}

        <div className="mt-4 mb-3 flex items-center gap-3">
          <p className="flex-1 text-sm text-muted">
            <b className="text-ink">{liste.length}</b> avocat{liste.length > 1 ? 's' : ''}
            {res.data && liste.length !== res.data.total && ` sur ${res.data.total}`}
            {res.data?.pres_de && ` · autour de ${res.data.pres_de.label}`}
          </p>
          <select className="input !w-auto !py-1.5" value={f.tri} onChange={(e) => set({ tri: e.target.value })} aria-label="Tri">
            {TRIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {f.tri === 'rotation' && (
          <p className="mb-3 rounded-xl bg-info-soft px-3 py-2 text-sm text-info">
            Rotation : les avocats jamais mandatés d’abord, puis ceux dont le dernier mandat est le plus ancien.
          </p>
        )}
        {liste.length === 0 && res.isSuccess ? (
          <Vide icon={<SearchX size={30} />} titre="Aucun avocat ne correspond" texte="Élargissez le rayon, le tarif ou retirez un filtre." />
        ) : (
          <div className="grid gap-3 2xl:grid-cols-2">
            {liste.map((a) => <LawyerCard key={a.id} a={a} onHover={setSurvol} selected={app.ficheId === a.id} />)}
          </div>
        )}
      </section>

      {/* Carte toujours visible sur grand écran */}
      <aside className="hidden border-l border-line p-5 xl:block">
        <div className="sticky top-5">
          <h3 className="eyebrow mb-3">Carte du réseau</h3>
          <div className="card p-3">
            <SwissMap
              cantonsActifs={f.cantons}
              cantonSurvol={survol?.canton}
              villeSurvol={survol?.ville_cle}
              onCanton={(c) => toggle('cantons', c)}
              onVille={(v) => set({ pres_de: v, rayon: f.pres_de ? f.rayon : 10 })}
            />
          </div>
          <p className="mt-2 text-xs text-muted">Cliquer un canton pour filtrer, une ville pour chercher autour.</p>
        </div>
      </aside>

      <NouvelAvocat open={ajout} onClose={() => setAjout(false)} />
    </div>
  )
}
