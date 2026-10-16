/* Assistant : demande libre (Claude) ou critères guidés (règles locales), même présentation des résultats. */
import { useMutation, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { AlertTriangle, FileText, Lightbulb, ListChecks, Phone, Sparkles, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api, CANTONS, court, SPECS, type Criteres, type ResultatAssistant } from '../api'
import { useApp } from '../store'
import { Avatar, Vide } from '../ui'

const BUDGETS: [number | null, string, string][] = [
  [250, 'Économique', '≤ CHF 250.—'], [280, 'Modéré', '≤ CHF 280.—'], [300, 'Standard', '≤ CHF 300.—'], [null, 'Sans limite', 'tous tarifs'],
]
const EXEMPLES = [
  'Licenciement avec effet immédiat à Yverdon, l’assuré conteste, budget serré',
  'Défaut de construction sur une villa à Sion, entreprise générale en face, spécialiste FSA',
  'Retrait de permis après un excès de vitesse à Genève',
]

export function Assistant() {
  const app = useApp()
  const etat = useQuery({ queryKey: ['etat'], queryFn: api.etat })
  const [mode, setMode] = useState<'libre' | 'guide'>('libre')
  const [demande, setDemande] = useState('')
  const [c, setC] = useState<Criteres>({ spec: null, lieu: '', canton: null, budget: null, fsa: false, assure: '', adverse: '' })
  const [res, setRes] = useState<ResultatAssistant | null>(null)

  const ia = useMutation({
    mutationFn: (d: string) => api.assistantIA(d),
    onSuccess: (r) => { setRes(r); if (r.avertissement) toast.warning(r.avertissement) },
    onError: (e) => toast.error(String(e instanceof Error ? e.message : e)),
  })
  const regles = useMutation({ mutationFn: api.assistantRegles, onSuccess: setRes })

  // Demande lancée depuis l'accueil.
  useEffect(() => {
    const d = sessionStorage.getItem('softres-demande')
    if (d) {
      sessionStorage.removeItem('softres-demande')
      setDemande(d)
      ia.mutate(d)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enCours = ia.isPending || regles.isPending
  return (
    <div className="mx-auto max-w-[1180px] space-y-5 p-7">
      <div className="card p-6">
        <div className="mb-4 flex gap-1 rounded-xl bg-surface-3 p-1 text-sm font-semibold">
          {([['libre', 'Décrire le dossier', Sparkles], ['guide', 'Critères guidés', ListChecks]] as const).map(([m, l, Icon]) => (
            <button key={m} onClick={() => setMode(m)} className={clsx('flex flex-1 items-center justify-center gap-2 rounded-lg py-2', mode === m ? 'bg-surface shadow-card' : 'text-muted')}>
              <Icon size={15} /> {l}
            </button>
          ))}
        </div>

        {mode === 'libre' ? (
          <>
            <textarea
              className="input min-h-28 !text-[15px]"
              placeholder="Décrivez le dossier comme à un collègue : matière, lieu, enjeu, budget, parties…"
              value={demande}
              onChange={(e) => setDemande(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && demande.trim() && ia.mutate(demande)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {EXEMPLES.map((x) => (
                <button key={x} className="chip !font-normal" onClick={() => setDemande(x)}>{x}</button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <p className="flex-1 text-xs text-muted">
                {etat.data?.ia
                  ? `Claude (${etat.data.modele}) lit la demande et l’annuaire anonymisé. Les contrôles de conflit restent faits sur votre PC.`
                  : 'IA inactive (pas de clé dans .env) : la demande est interprétée par les règles locales.'}
              </p>
              <button className="btn btn-primary" disabled={demande.trim().length < 5 || enCours} onClick={() => ia.mutate(demande)}>
                <Wand2 size={16} /> {ia.isPending ? 'Analyse…' : 'Trouver le bon avocat'}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-5">
            <Choix titre="Domaine du litige">
              {SPECS.map((s) => (
                <button key={s} className={clsx('chip !px-3 !py-1.5', c.spec === s && 'chip-on')} onClick={() => setC({ ...c, spec: s })}>{court(s)}</button>
              ))}
            </Choix>
            <div className="grid gap-4 md:grid-cols-2">
              <Choix titre="Canton">
                {Object.entries(CANTONS).map(([k, n]) => (
                  <button key={k} className={clsx('chip', c.canton === k && 'chip-on')} onClick={() => setC({ ...c, canton: c.canton === k ? null : k, lieu: '' })}>{n}</button>
                ))}
              </Choix>
              <label className="block">
                <span className="label">… ou NPA / ville (classement par distance)</span>
                <input className="input" placeholder="1003, Morges…" value={c.lieu} onChange={(e) => setC({ ...c, lieu: e.target.value, canton: null })} />
              </label>
            </div>
            <Choix titre="Budget horaire">
              {BUDGETS.map(([v, l, s]) => (
                <button key={l} className={clsx('chip !px-3 !py-1.5', c.budget === v && 'chip-on')} onClick={() => setC({ ...c, budget: v })}>
                  {l} <span className="opacity-60">{s}</span>
                </button>
              ))}
            </Choix>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={c.fsa} onChange={(e) => setC({ ...c, fsa: e.target.checked })} />
                Privilégier les spécialistes FSA
              </label>
              <input className="input" placeholder="Assuré·e (contrôle de conflit)" value={c.assure} onChange={(e) => setC({ ...c, assure: e.target.value })} />
              <input className="input" placeholder="Partie adverse (contrôle de conflit)" value={c.adverse} onChange={(e) => setC({ ...c, adverse: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <button className="btn btn-primary" disabled={!c.spec || enCours} onClick={() => regles.mutate(c)}>
                <ListChecks size={16} /> Voir les recommandations
              </button>
            </div>
          </div>
        )}
      </div>

      {enCours && (
        <div className="card grid place-items-center gap-3 p-10 text-muted">
          <Sparkles className="animate-pulse text-brand" />
          {ia.isPending ? 'Claude analyse le dossier et l’annuaire…' : 'Calcul des recommandations…'}
        </div>
      )}
      {res && !enCours && <Resultats r={res} onAvocat={app.ouvrirFiche} />}
    </div>
  )
}

function Choix({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="label">{titre}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Resultats({ r, onAvocat }: { r: ResultatAssistant; onAvocat: (id: number) => void }) {
  const app = useApp()
  const max = Math.max(1, ...r.classement.map((x) => x.score))
  const dossier = { assure: r.criteres.assure, adverse: r.criteres.adverse }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold">Recommandations</h3>
        <span className={clsx('tag', r.moteur === 'ia' ? 'bg-brand-soft text-brand' : '')}>
          {r.moteur === 'ia' ? <><Sparkles size={11} /> Claude</> : 'Règles locales'}
        </span>
        <span className="text-sm text-muted">{r.resume}</span>
      </div>
      {r.conseil && (
        <div className="flex gap-2 rounded-xl bg-info-soft p-3 text-sm text-info">
          <Lightbulb size={17} className="shrink-0" /> {r.conseil}
        </div>
      )}
      {r.classement.length === 0 ? (
        <Vide icon={<Sparkles />} titre="Aucune correspondance suffisante" texte="Élargissez le budget ou la zone." />
      ) : (
        r.classement.map((x, i) => (
          <article key={x.avocat.id} className={clsx('card flex items-start gap-4 p-4', i === 0 && 'border-brand/50 ring-2 ring-brand/15')}>
            <span className={clsx('grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold', i === 0 ? 'bg-brand text-white' : 'bg-surface-3')}>{i + 1}</span>
            <Avatar a={x.avocat} size={44} />
            <div className="min-w-0 flex-1">
              <button className="text-left text-[15px] font-bold hover:text-brand" onClick={() => onAvocat(x.avocat.id)}>{x.avocat.nom}</button>
              <p className="text-xs text-muted">{x.avocat.ville} · {x.avocat.canton_nom} · {x.avocat.domaine}</p>
              {x.argument && <p className="mt-1.5 text-sm text-ink-2">{x.argument}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {x.raisons.map((t) => <span key={t} className={clsx('tag', t.startsWith('⚠') && 'bg-warn-soft text-warn')}>{t}</span>)}
              </div>
              {x.conflit.map((t) => (
                <p key={t} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-warn"><AlertTriangle size={13} /> {t}</p>
              ))}
            </div>
            <div className="w-24 shrink-0 text-right">
              {x.score > 0 && (
                <>
                  <b className="text-xl">{x.score}</b> <small className="text-muted">pts</small>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(x.score / max) * 100}%` }} />
                  </div>
                </>
              )}
              <div className="mt-3 flex justify-end gap-1">
                <button className="btn btn-sm" onClick={() => app.ouvrirCourrier(x.avocat.id, dossier)} title="Courrier de mandat"><FileText size={14} /></button>
                {x.avocat.tel && <a className="btn btn-sm" href={`tel:${x.avocat.tel.replace(/\s/g, '')}`} title="Appeler"><Phone size={14} /></a>}
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  )
}
