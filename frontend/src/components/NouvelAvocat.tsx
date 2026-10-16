import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import { useApp } from '../store'
import { Modal } from '../ui'
import { FormAvocat, type ChampsAvocat } from './Fiche'

const VIDE: ChampsAvocat = { nom: '', canton: 'VD', ville: '', tarif: '', domaine: '', tel: '', email: '' }

export function NouvelAvocat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp()
  const qc = useQueryClient()
  const [f, setF] = useState(VIDE)
  const creer = useMutation({
    mutationFn: () => api.creerAvocat(f),
    onSuccess: (a) => {
      toast.success(`${a.nom} ajouté au réseau`)
      setF(VIDE)
      onClose()
      qc.invalidateQueries()
      app.ouvrirFiche(a.id)
    },
    onError: (e) => toast.error(String(e instanceof Error ? e.message : e)),
  })
  return (
    <Modal open={open} onClose={onClose} title="Ajouter un avocat">
      <div className="-mx-6 -mb-8">
        <FormAvocat f={f} setF={setF} onAnnuler={onClose} onValider={() => creer.mutate()} titre="" />
      </div>
    </Modal>
  )
}
