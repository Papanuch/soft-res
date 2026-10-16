/* Courrier d'attribution de mandat : modèle maison mis à jour en direct, ou rédaction par Claude. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Copy, Printer, Save, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import { useApp } from '../store'
import { Modal } from '../ui'

export function CourrierDialog() {
  const app = useApp()
  const c = app.courrier
  const qc = useQueryClient()
  const etat = useQuery({ queryKey: ['etat'], queryFn: api.etat })
  const reglages = useQuery({ queryKey: ['reglages'], queryFn: api.reglages })
  const avocat = useQuery({ queryKey: ['avocat', c?.lawyerId], queryFn: () => api.avocat(c!.lawyerId), enabled: !!c })
  const [d, setD] = useState({ ref: '', assure: '', adverse: '', objet: '', signature: '' })
  const [texte, setTexte] = useState('')
  const [info, setInfo] = useState<{ conflits: string[]; avertissement: string; moteur: string }>({ conflits: [], avertissement: '', moteur: 'modele' })

  const signature = reglages.data?.signature ?? ''
  const enregistrer = useMutation({
    mutationFn: () => api.creerMandat({ lawyer_id: c!.lawyerId, ref: d.ref, assure: d.assure, adverse: d.adverse, note: d.objet }),
    onSuccess: () => { toast.success('Mandat enregistré'); qc.invalidateQueries() },
  })
  useEffect(() => {
    if (c) setD({ ref: '', assure: '', adverse: '', objet: '', ...c.dossier, signature })
    enregistrer.reset()
    // Réinitialisé seulement à l'ouverture du courrier, pas quand la signature change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c])
  useEffect(() => {
    if (signature) setD((x) => (x.signature ? x : { ...x, signature }))
  }, [signature])

  // Modèle standard recalculé à chaque frappe (sans IA).
  useEffect(() => {
    if (!c) return
    const t = setTimeout(() => {
      api.courrier(c.lawyerId, d, false).then((r) => { setTexte(r.texte); setInfo(r) })
    }, 200)
    return () => clearTimeout(t)
  }, [c, d])

  const ia = useMutation({
    mutationFn: () => api.courrier(c!.lawyerId, d, true),
    onSuccess: (r) => {
      setTexte(r.texte)
      setInfo(r)
      if (r.avertissement) toast.warning(r.avertissement)
      else toast.success('Courrier rédigé par Claude')
    },
  })


  const champ = (k: keyof typeof d, label: string) => (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input"
        value={d[k]}
        onChange={(e) => setD({ ...d, [k]: e.target.value })}
        onBlur={k === 'signature' ? () => api.reglage('signature', d.signature).then(() => qc.invalidateQueries({ queryKey: ['reglages'] })) : undefined}
      />
    </label>
  )

  return (
    <Modal
      open={!!c}
      onClose={app.fermerCourrier}
      wide
      title={<>Courrier de mandat <span className="font-normal text-muted">· {avocat.data?.avocat.nom}</span></>}
      footer={
        <>
          <button className="btn" onClick={() => navigator.clipboard.writeText(texte).then(() => toast('Courrier copié, prêt à coller dans Word ou Outlook'))}>
            <Copy size={15} /> Copier
          </button>
          <button className="btn" onClick={() => window.print()}><Printer size={15} /> Imprimer</button>
          <span className="flex-1" />
          <button className="btn" disabled={(!d.ref && !d.assure) || !enregistrer.isIdle} onClick={() => enregistrer.mutate()}>
            <Save size={15} /> {enregistrer.isSuccess ? 'Mandat enregistré ✓' : 'Enregistrer comme mandat'}
          </button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          {champ('ref', 'Référence du dossier')}
          {champ('assure', 'Assuré·e')}
          {champ('adverse', 'Partie adverse')}
          <label className="block">
            <span className="label">Objet du litige</span>
            <textarea className="input min-h-24" value={d.objet} onChange={(e) => setD({ ...d, objet: e.target.value })} />
          </label>
          {champ('signature', 'Signature')}
          <button
            className="btn w-full"
            disabled={!etat.data?.ia || ia.isPending}
            onClick={() => ia.mutate()}
            title={etat.data?.ia ? 'Adapte le paragraphe sur l’affaire à l’objet du litige' : 'Ajoutez une clé Anthropic dans le fichier .env'}
          >
            <Sparkles size={15} className="text-brand" /> {ia.isPending ? 'Rédaction…' : 'Rédiger avec Claude'}
          </button>
        </div>
        <div>
          {info.conflits.length > 0 && (
            <div className="mb-3 flex gap-2 rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm text-warn">
              <AlertTriangle size={18} className="shrink-0" />
              <div>
                <b>Conflit d’intérêts possible</b>
                {info.conflits.map((x) => <p key={x}>{x}</p>)}
              </div>
            </div>
          )}
          <div className="print-zone">
            <pre className="whitespace-pre-wrap rounded-xl border border-line bg-surface-2 p-6 font-serif text-[13.5px] leading-relaxed text-ink">{texte}</pre>
          </div>
          {info.moteur === 'ia' && <p className="mt-2 text-xs text-muted">Rédigé par Claude : relire avant envoi. Modifier un champ revient au modèle standard.</p>}
        </div>
      </div>
    </Modal>
  )
}
