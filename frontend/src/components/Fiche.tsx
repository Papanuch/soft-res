/* Fiche avocat : panneau latéral avec coordonnées, note, historique des mandats et édition. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { BadgeCheck, FileText, Heart, Mail, MapPin, Pencil, Phone, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api, CANTONS, court, type Avocat, type Mandat } from '../api'
import { useApp } from '../store'
import { Avatar, Etoiles, fmtDate, tarifTxt } from '../ui'
import { useFavori } from './LawyerCard'

export function Fiche() {
  const app = useApp()
  const id = app.ficheId
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['avocat', id], queryFn: () => api.avocat(id!), enabled: id != null })
  const [edition, setEdition] = useState(false)

  useEffect(() => {
    setEdition(false)
    if (id != null) api.vu(id).then(() => qc.invalidateQueries({ queryKey: ['recents'] }))
  }, [id, qc])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('dialog[open]') && app.ouvrirFiche(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [app])

  if (id == null) return null
  const a = q.data?.avocat
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/25" onClick={() => app.ouvrirFiche(null)} />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-[520px] max-w-full flex-col border-l border-line bg-surface shadow-2xl" aria-label="Fiche avocat">
        <div className="flex items-center justify-end gap-1 px-4 pt-3">
          <button className="btn btn-ghost btn-sm" onClick={() => app.ouvrirFiche(null)} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        {!a ? (
          <div className="p-6 text-muted">Chargement…</div>
        ) : edition ? (
          <Edition a={a} onFin={() => setEdition(false)} />
        ) : (
          <Detail a={a} mandats={q.data!.mandats} onEditer={() => setEdition(true)} />
        )}
      </aside>
    </>
  )
}

function Detail({ a, mandats, onEditer }: { a: Avocat; mandats: Mandat[]; onEditer: () => void }) {
  const app = useApp()
  const qc = useQueryClient()
  const fav = useFavori()
  const [note, setNote] = useState(a.note)
  useEffect(() => setNote(a.note), [a.id, a.note])

  const saveNote = useMutation({
    mutationFn: (t: string) => api.note(a.id, t),
    onSuccess: () => { toast('Note enregistrée'); qc.invalidateQueries() },
  })
  const retirer = useMutation({
    mutationFn: () => api.retirerAvocat(a.id),
    onSuccess: () => { toast('Avocat retiré du réseau'); app.ouvrirFiche(null); qc.invalidateQueries() },
  })

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-8">
      <div className="flex items-start gap-4">
        <Avatar a={a} size={60} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold leading-tight">{a.nom}</h2>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin size={14} /> {a.ville} · {a.canton_nom}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {a.fsa && <span className="tag bg-info-soft text-info"><BadgeCheck size={12} /> Spécialiste FSA</span>}
            {a.ajoute && <span className="tag">Ajouté manuellement</span>}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Kpi label="Tarif horaire" value={tarifTxt(a.tarif)} />
        <Kpi label="Mandats" value={`${a.mandats}${a.en_cours ? ` (${a.en_cours} en cours)` : ''}`} />
        <Kpi label="Évaluation" value={a.evaluation ? `★ ${a.evaluation} / 5` : '—'} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => app.ouvrirCourrier(a.id)}>
          <FileText size={16} /> Courrier de mandat
        </button>
        <button className={clsx('btn', a.favori && 'text-brand')} onClick={() => fav.mutate({ id: a.id, on: !a.favori })}>
          <Heart size={16} className={a.favori ? 'fill-current' : ''} /> {a.favori ? 'Favori' : 'Ajouter aux favoris'}
        </button>
        <button className="btn" onClick={onEditer}><Pencil size={15} /> Modifier</button>
      </div>

      <div className="mt-6 space-y-2 text-sm">
        {a.tel && (
          <a href={`tel:${a.tel.replace(/\s/g, '')}`} className="flex items-center gap-2 text-ink hover:text-brand">
            <Phone size={15} className="text-muted" /> {a.tel}
          </a>
        )}
        {a.email && (
          <a href={`mailto:${a.email}`} className="flex items-center gap-2 text-ink hover:text-brand">
            <Mail size={15} className="text-muted" /> {a.email}
          </a>
        )}
      </div>

      <h3 className="eyebrow mt-6 mb-2">Domaines</h3>
      <div className="flex flex-wrap gap-1.5">
        {a.domaines.map((d) => <span key={d} className="chip">{d}</span>)}
      </div>
      {a.specs.length > 0 && (
        <p className="mt-2 text-xs text-muted">Classé dans : {a.specs.map(court).join(', ')}</p>
      )}

      <h3 className="eyebrow mt-6 mb-2">Note personnelle</h3>
      <textarea
        className="input min-h-20"
        value={note}
        placeholder="Disponibilité, qualité du travail, interlocuteur…"
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== a.note && saveNote.mutate(note)}
      />

      <Historique a={a} mandats={mandats} />

      <button
        className="btn btn-ghost btn-sm mt-8 text-muted hover:text-brand"
        onClick={() => confirm(`Retirer « ${a.nom} » du réseau ? Son historique de mandats reste consultable.`) && retirer.mutate()}
      >
        <Trash2 size={14} /> Retirer du réseau
      </button>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  )
}

function Historique({ a, mandats }: { a: Avocat; mandats: Mandat[] }) {
  const qc = useQueryClient()
  const [ajout, setAjout] = useState(false)
  const [m, setM] = useState({ ref: '', assure: '', adverse: '', note: '' })
  const creer = useMutation({
    mutationFn: () => api.creerMandat({ lawyer_id: a.id, ...m }),
    onSuccess: () => { toast('Mandat enregistré'); setAjout(false); setM({ ref: '', assure: '', adverse: '', note: '' }); qc.invalidateQueries() },
    onError: (e) => toast.error(String(e)),
  })
  const maj = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<Mandat> }) => api.modifierMandat(id, patch),
    onSuccess: () => qc.invalidateQueries(),
  })
  return (
    <>
      <div className="mt-6 mb-2 flex items-center">
        <h3 className="eyebrow flex-1">Mandats confiés</h3>
        <button className="btn btn-sm" onClick={() => setAjout(!ajout)}><Plus size={14} /> Ajouter</button>
      </div>
      {ajout && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-3">
          <input className="input" placeholder="Référence" value={m.ref} onChange={(e) => setM({ ...m, ref: e.target.value })} />
          <input className="input" placeholder="Assuré·e" value={m.assure} onChange={(e) => setM({ ...m, assure: e.target.value })} />
          <input className="input" placeholder="Partie adverse" value={m.adverse} onChange={(e) => setM({ ...m, adverse: e.target.value })} />
          <input className="input" placeholder="Objet" value={m.note} onChange={(e) => setM({ ...m, note: e.target.value })} />
          <div className="col-span-2 flex justify-end gap-2">
            <button className="btn btn-sm" onClick={() => setAjout(false)}>Annuler</button>
            <button className="btn btn-primary btn-sm" disabled={!m.ref && !m.assure} onClick={() => creer.mutate()}>Enregistrer</button>
          </div>
        </div>
      )}
      {mandats.length === 0 ? (
        <p className="text-sm text-muted">Aucun mandat enregistré pour cet avocat.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {mandats.map((x) => (
            <li key={x.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <b>{x.ref || 'Sans référence'}</b> <span className="text-muted">· {fmtDate(x.date)}</span>
                <div className="truncate text-xs text-muted">
                  {x.assure}{x.adverse && ` c/ ${x.adverse}`}{x.matiere && ` · ${court(x.matiere)}`}
                </div>
              </div>
              <Etoiles value={x.evaluation} size={13} onChange={(v) => maj.mutate({ id: x.id, patch: { evaluation: v } })} />
              <button
                className={clsx('tag cursor-pointer', x.statut === 'clos' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}
                onClick={() => maj.mutate({ id: x.id, patch: { statut: x.statut === 'clos' ? 'en cours' : 'clos' } })}
                title="Changer le statut"
              >
                {x.statut}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Edition({ a, onFin }: { a: Avocat; onFin: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ nom: a.nom, canton: a.canton, ville: a.ville, tarif: a.tarif, domaine: a.domaine, tel: a.tel, email: a.email })
  const save = useMutation({
    mutationFn: () => api.modifierAvocat(a.id, f),
    onSuccess: () => { toast('Fiche mise à jour'); qc.invalidateQueries(); onFin() },
    onError: (e) => toast.error(String(e)),
  })
  return <FormAvocat f={f} setF={setF} onAnnuler={onFin} onValider={() => save.mutate()} titre="Modifier la fiche" />
}

export type ChampsAvocat = { nom: string; canton: string; ville: string; tarif: string; domaine: string; tel: string; email: string }

export function FormAvocat({ f, setF, onAnnuler, onValider, titre }: {
  f: ChampsAvocat; setF: (f: ChampsAvocat) => void; onAnnuler: () => void; onValider: () => void; titre: string
}) {
  const champ = (k: keyof ChampsAvocat, label: string, ph = '') => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" value={f[k]} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  )
  return (
    <div className="flex-1 overflow-y-auto px-6 pb-8">
      {titre && <h2 className="mb-4 text-lg font-bold">{titre}</h2>}
      <div className="grid gap-3">
        {champ('nom', 'Étude / avocat', 'Me Prénom Nom')}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Canton</span>
            <select className="input" value={f.canton} onChange={(e) => setF({ ...f, canton: e.target.value })}>
              {Object.entries(CANTONS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
          {champ('ville', 'Ville', 'Lausanne')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {champ('tarif', 'Tarif horaire (CHF)', '280 ou 250-300')}
          {champ('tel', 'Téléphone')}
        </div>
        {champ('email', 'Email')}
        <label className="block">
          <span className="label">Domaines</span>
          <textarea className="input min-h-16" value={f.domaine} placeholder="FSA Travail / Bail / Construction" onChange={(e) => setF({ ...f, domaine: e.target.value })} />
          <small className="mt-1 block text-xs text-muted">Mots reconnus : travail, assurance, RC, construction, immobilier, bail, pénal, LCR, contrat, généraliste, FSA.</small>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn" onClick={onAnnuler}>Annuler</button>
        <button className="btn btn-primary" disabled={!f.nom || !f.ville || !f.tarif} onClick={onValider}>Enregistrer</button>
      </div>
    </div>
  )
}
