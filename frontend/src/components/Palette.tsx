/* Palette de commandes (Ctrl K) : avocats, pages et actions. */
import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { BookUser, Briefcase, Database, Home, Map as MapIcon, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { api, FILTRES_VIDES } from '../api'
import { useApp, type Page } from '../store'
import { Avatar } from '../ui'

const PAGES: [Page, string, typeof Home][] = [
  ['accueil', 'Accueil', Home], ['annuaire', 'Annuaire', BookUser], ['carte', 'Carte', MapIcon],
  ['assistant', 'Assistant : trouver le bon avocat', Sparkles], ['mandats', 'Mandats', Briefcase],
  ['conflits', 'Contrôle de conflit d’intérêts', ShieldCheck], ['donnees', 'Données et sauvegardes', Database],
]

export function Palette() {
  const app = useApp()
  const tous = useQuery({ queryKey: ['annuaire', FILTRES_VIDES], queryFn: () => api.annuaire(FILTRES_VIDES), enabled: app.palette })
  const fermer = () => app.setPalette(false)
  const item = 'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-brand-soft aria-selected:text-brand'

  return (
    <Command.Dialog
      open={app.palette}
      onOpenChange={app.setPalette}
      label="Palette de commandes"
      overlayClassName="fixed inset-0 z-50 bg-black/40"
      contentClassName="fixed left-1/2 top-[14vh] z-50 w-[620px] max-w-[calc(100%-32px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-2xl"
    >
      <Command.Input placeholder="Nom d’avocat, ville, page, action…" className="w-full border-b border-line bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-muted" />
      <Command.List className="max-h-[56vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">Aucun résultat</Command.Empty>
        <Command.Group heading="Pages" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
          {PAGES.map(([p, label, Icon]) => (
            <Command.Item key={p} value={'page ' + label} onSelect={() => { app.aller(p); fermer() }} className={item}>
              <Icon size={16} /> {label}
            </Command.Item>
          ))}
          <Command.Item value="action rotation à qui le tour" onSelect={() => { app.ouvrirAnnuaire({ tri: 'rotation' }); fermer() }} className={item}>
            <RotateCcw size={16} /> À qui le tour ? (rotation des mandats)
          </Command.Item>
        </Command.Group>
        <Command.Group heading="Avocats" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
          {tous.data?.avocats.map((a) => (
            <Command.Item
              key={a.id}
              value={`${a.nom} ${a.ville} ${a.canton_nom} ${a.domaine} #${a.id}`}
              onSelect={() => { app.ouvrirFiche(a.id); fermer() }}
              className={item}
            >
              <Avatar a={a} size={28} />
              <span className="flex-1 truncate">{a.nom}</span>
              <span className="text-xs text-muted">{a.ville}</span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}
