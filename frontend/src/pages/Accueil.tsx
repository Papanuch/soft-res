import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BadgeCheck, Briefcase, Building2, Clock, Heart, MapPin, PieChart, Sparkles, Users } from 'lucide-react'
import { useState } from 'react'
import { api, CANTON_COULEURS, court, FILTRES_VIDES } from '../api'
import { useApp } from '../store'
import { Avatar, Barre, fmtDate, Section, tarifTxt } from '../ui'

export function Accueil() {
  const app = useApp()
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats })
  const recents = useQuery({ queryKey: ['recents'], queryFn: api.recents })
  const favoris = useQuery({
    queryKey: ['annuaire', { ...FILTRES_VIDES, favoris: true }],
    queryFn: () => api.annuaire({ ...FILTRES_VIDES, favoris: true }),
  })
  const mandats = useQuery({ queryKey: ['mandats'], queryFn: () => api.mandats() })
  const [demande, setDemande] = useState('')
  const s = stats.data
  const date = new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const heure = new Date().getHours()

  const lancer = () => {
    sessionStorage.setItem('softres-demande', demande)
    app.aller('assistant')
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 p-7">
      <section className="relative overflow-hidden rounded-3xl bg-side p-8 text-side-ink shadow-card">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="eyebrow !text-side-muted">{date}</p>
            <h2 className="mt-2 text-4xl font-bold tracking-tight">{heure < 18 ? 'Bonjour' : 'Bonsoir'}</h2>
            <p className="mt-2 max-w-lg text-side-muted">Décrivez le dossier, l’assistant propose les avocats les plus adaptés du réseau.</p>
            <div className="mt-5 flex gap-2 rounded-2xl bg-white/8 p-1.5 ring-1 ring-white/10 focus-within:ring-brand">
              <Sparkles size={18} className="ml-2 mt-2.5 shrink-0 text-brand" />
              <input
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[15px] text-white outline-none placeholder:text-side-muted"
                placeholder="Ex. licenciement abusif à Morges, budget serré, spécialiste FSA"
                value={demande}
                onChange={(e) => setDemande(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && demande.trim() && lancer()}
              />
              <button className="btn btn-primary" disabled={!demande.trim()} onClick={lancer}>
                Trouver <ArrowRight size={15} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Tuile icon={<Users size={18} />} n={s?.avocats} label="avocats partenaires" onClick={() => app.ouvrirAnnuaire({})} />
            <Tuile icon={<MapPin size={18} />} n={s?.cantons} label="cantons" onClick={() => app.aller('carte')} />
            <Tuile icon={<Building2 size={18} />} n={s?.villes} label="villes" onClick={() => app.aller('carte')} />
            <Tuile icon={<BadgeCheck size={18} />} n={s?.fsa} label="spécialistes FSA" onClick={() => app.ouvrirAnnuaire({ fsa: true })} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Section titre="Spécialités" icon={<PieChart size={17} />}>
          <ul className="space-y-2.5">
            {s && Object.entries(s.par_specialite).sort((a, b) => b[1] - a[1]).map(([spec, n]) => (
              <li key={spec}>
                <button className="flex w-full items-center gap-3 text-left text-sm hover:text-brand" onClick={() => app.ouvrirAnnuaire({ specs: [spec] })}>
                  <span className="w-36 truncate">{court(spec)}</span>
                  <Barre value={n} max={s.avocats} />
                  <b className="w-7 text-right">{n}</b>
                </button>
              </li>
            ))}
          </ul>
        </Section>
        <Section titre="Cantons" icon={<MapPin size={17} />} action={<span className="text-xs text-muted">tarif médian</span>}>
          <ul className="space-y-2.5">
            {s && Object.entries(s.par_canton).sort((a, b) => b[1].n - a[1].n).map(([c, x]) => (
              <li key={c}>
                <button className="flex w-full items-center gap-3 text-left text-sm hover:text-brand" onClick={() => app.ouvrirAnnuaire({ cantons: [c] })}>
                  <span className="w-24">{x.nom}</span>
                  <Barre value={x.n} max={Math.max(...Object.values(s.par_canton).map((v) => v.n))} color={CANTON_COULEURS[c]} />
                  <b className="w-7 text-right">{x.n}</b>
                  <span className="w-16 text-right text-xs text-muted">CHF {x.tarif_median}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
        <Section titre="Principales villes" icon={<Building2 size={17} />}>
          <ul className="space-y-1">
            {s?.par_ville.slice(0, 7).map((v) => (
              <li key={v.cle}>
                <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2" onClick={() => app.ouvrirAnnuaire({ pres_de: v.nom, rayon: 10 })}>
                  <MapPin size={14} className="text-muted" />
                  <span className="flex-1">{v.nom}</span>
                  <span className="text-xs text-muted">{v.n} avocat{v.n > 1 ? 's' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Section titre="Favoris" icon={<Heart size={17} />}>
          <ListeAvocats liste={favoris.data?.avocats ?? []} vide="Cliquez sur le cœur d’une fiche pour la retrouver ici." />
        </Section>
        <Section titre="Consultés récemment" icon={<Clock size={17} />}>
          <ListeAvocats liste={recents.data ?? []} vide="Les fiches ouvertes apparaîtront ici." />
        </Section>
        <Section
          titre="Mandats en cours"
          icon={<Briefcase size={17} />}
          action={<button className="btn btn-ghost btn-sm" onClick={() => app.aller('mandats')}>Tout voir</button>}
        >
          {(() => {
            const enCours = (mandats.data ?? []).filter((m) => m.statut !== 'clos').slice(0, 6)
            if (!enCours.length) return <p className="text-sm text-muted">Aucun mandat en cours. Depuis une fiche ou un courrier : « Enregistrer comme mandat ».</p>
            return (
              <ul className="space-y-1">
                {enCours.map((m) => (
                  <li key={m.id}>
                    <button className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2" onClick={() => app.ouvrirFiche(m.lawyer_id)}>
                      <b>{m.ref || m.assure || 'Mandat'}</b> <span className="text-muted">· {fmtDate(m.date)}</span>
                      <div className="truncate text-xs text-muted">{m.avocat}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )
          })()}
        </Section>
      </div>
    </div>
  )
}

function Tuile({ icon, n, label, onClick }: { icon: React.ReactNode; n?: number; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl bg-white/6 p-4 text-left ring-1 ring-white/10 transition hover:bg-white/10">
      <span className="text-brand">{icon}</span>
      <div className="mt-2 text-3xl font-bold">{n ?? '—'}</div>
      <div className="text-xs text-side-muted">{label}</div>
    </button>
  )
}

function ListeAvocats({ liste, vide }: { liste: { id: number; nom: string; canton: string; ville: string; tarif: string }[]; vide: string }) {
  const app = useApp()
  if (!liste.length) return <p className="text-sm text-muted">{vide}</p>
  return (
    <ul className="space-y-1">
      {liste.slice(0, 6).map((a) => (
        <li key={a.id}>
          <button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2" onClick={() => app.ouvrirFiche(a.id)}>
            <Avatar a={a} size={30} />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm">{a.nom}</b>
              <small className="text-xs text-muted">{a.ville} · {tarifTxt(a.tarif)}</small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
