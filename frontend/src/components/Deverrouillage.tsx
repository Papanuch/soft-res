import { useQueryClient } from '@tanstack/react-query'
import { LockOpen } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import { useApp } from '../store'
import { Modal } from '../ui'

export function Deverrouillage() {
  const app = useApp()
  const qc = useQueryClient()
  const [phrase, setPhrase] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  const valider = async () => {
    setEnCours(true)
    setErreur('')
    try {
      const r = await api.deverrouiller(phrase)
      toast.success(`${r.noms} noms réels affichés`)
      setPhrase('')
      app.setDeverrouillage(false)
      qc.invalidateQueries()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modal
      open={app.deverrouillage}
      onClose={() => app.setDeverrouillage(false)}
      title="Afficher les noms réels"
      footer={
        <>
          <span className="flex-1" />
          <button className="btn" onClick={() => app.setDeverrouillage(false)}>Annuler</button>
          <button className="btn btn-primary" disabled={!phrase || enCours} onClick={valider}>
            <LockOpen size={15} /> {enCours ? 'Vérification…' : 'Déverrouiller'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-2">
        Les noms réels sont chiffrés dans l’application et ne sont déchiffrés qu’en mémoire. Ils se masquent
        automatiquement après une période d’inactivité, et ne sont jamais envoyés à l’assistant IA.
      </p>
      <label className="block">
        <span className="label">Phrase de passe</span>
        <input
          className="input"
          type="password"
          autoFocus
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && phrase && valider()}
        />
      </label>
      {erreur && <p className="mt-2 text-sm font-semibold text-brand">{erreur}</p>}
    </Modal>
  )
}
