import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, KeyRound, Lock, Sparkles, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import { useApp } from '../store'

export function Donnees() {
  const app = useApp()
  const qc = useQueryClient()
  const etat = useQuery({ queryKey: ['etat'], queryFn: api.etat })
  const reglages = useQuery({ queryKey: ['reglages'], queryFn: api.reglages })
  const [signature, setSignature] = useState('')
  useEffect(() => setSignature(reglages.data?.signature ?? ''), [reglages.data])
  const [remplacer, setRemplacer] = useState(false)
  const fichier = useRef<HTMLInputElement>(null)

  const restaurer = useMutation({
    mutationFn: async (f: File) => api.restaurer(JSON.parse(await f.text()), remplacer),
    onSuccess: (r) => { toast.success(`Importé : ${r.avocats} avocats, ${r.mandats} mandats`); qc.invalidateQueries() },
    onError: (e) => toast.error(e instanceof SyntaxError ? 'Fichier JSON illisible' : String(e instanceof Error ? e.message : e)),
  })
  const sig = useMutation({ mutationFn: () => api.reglage('signature', signature), onSuccess: () => toast.success('Signature enregistrée') })
  const e = etat.data

  return (
    <div className="mx-auto grid max-w-[1100px] gap-5 p-7 md:grid-cols-2">
      <Bloc titre="Sauvegarde" icon={<Download size={17} />}>
        <p className="text-sm text-muted">Un fichier JSON avec avocats ajoutés ou modifiés, favoris, notes, mandats et réglages.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn btn-primary" href="/api/sauvegarde" download><Download size={15} /> Télécharger la sauvegarde</a>
          <a className="btn" href="/api/export.csv"><FileSpreadsheet size={15} /> Annuaire en CSV</a>
        </div>
      </Bloc>

      <Bloc titre="Restaurer / importer" icon={<Upload size={17} />}>
        <p className="text-sm text-muted">Accepte une sauvegarde Soft - Res ou l’export de l’ancien Soft Réseau (Orion).</p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={remplacer} onChange={(x) => setRemplacer(x.target.checked)} />
          Remplacer les données actuelles (sinon fusion)
        </label>
        <input ref={fichier} type="file" accept=".json,application/json" className="hidden" onChange={(x) => {
          const f = x.target.files?.[0]
          if (f) restaurer.mutate(f)
          x.target.value = ''
        }} />
        <button className="btn mt-3" disabled={restaurer.isPending} onClick={() => fichier.current?.click()}><Upload size={15} /> Choisir un fichier…</button>
      </Bloc>

      <Bloc titre="Assistant Claude" icon={<Sparkles size={17} />}>
        {e?.ia ? (
          <p className="text-sm">Actif, modèle <b>{e.modele}</b>. Seul l’annuaire anonymisé et votre demande sont envoyés.</p>
        ) : (
          <p className="text-sm">Inactif. Collez votre clé dans le fichier <code>.env</code> à la racine du projet (<code>ANTHROPIC_API_KEY=sk-ant-…</code>) puis relancez.</p>
        )}
      </Bloc>

      <Bloc titre="Noms réels" icon={<KeyRound size={17} />}>
        {!e?.noms_reels.disponible ? (
          <p className="text-sm text-muted">Aucun bloc chiffré disponible.</p>
        ) : e.noms_reels.deverrouille ? (
          <>
            <p className="text-sm">Déverrouillés pour cette session (reverrouillage auto après {e.verrouillage_minutes} min d’inactivité). Jamais envoyés à l’IA.</p>
            <button className="btn mt-3" onClick={() => api.verrouiller().then(() => qc.invalidateQueries())}><Lock size={15} /> Verrouiller</button>
          </>
        ) : (
          <>
            <p className="text-sm">Chiffrés (AES-256). Saisissez la phrase secrète pour les afficher.</p>
            <button className="btn mt-3" onClick={() => app.setDeverrouillage(true)}><KeyRound size={15} /> Déverrouiller</button>
          </>
        )}
      </Bloc>

      <Bloc titre="Signature des courriers" icon={<span className="text-base">✍</span>}>
        <textarea className="input min-h-24" value={signature} onChange={(x) => setSignature(x.target.value)} placeholder={'Zsolt Molnar\nAvocat'} />
        <button className="btn mt-3" onClick={() => sig.mutate()}>Enregistrer</button>
      </Bloc>

      <Bloc titre="Emplacement des données" icon={<span className="text-base">📁</span>}>
        <p className="break-all font-mono text-xs">{e?.demo ? 'Serveur de démonstration (données temporaires)' : e?.dossier_donnees}</p>
        <p className="mt-2 text-xs text-muted">Version {e?.version}. Base SQLite locale, rien ne quitte ce PC sauf les requêtes à Claude.</p>
      </Bloc>
    </div>
  )
}

function Bloc({ titre, icon, children }: { titre: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h3 className="mb-2 flex items-center gap-2 font-bold">{icon} {titre}</h3>
      {children}
    </section>
  )
}
