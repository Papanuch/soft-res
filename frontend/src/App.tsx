/* Coque de l'application : barre latérale, barre du haut, page courante, fenêtres globales. */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  BookUser, Briefcase, Database, Home, Lock, LockOpen, Map as MapIcon, Moon, Search, ShieldCheck, Sparkles, Sun,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { api } from './api'
import { CourrierDialog } from './components/Courrier'
import { Fiche } from './components/Fiche'
import { Palette } from './components/Palette'
import { Deverrouillage } from './components/Deverrouillage'
import { Accueil } from './pages/Accueil'
import { Annuaire } from './pages/Annuaire'
import { Assistant } from './pages/Assistant'
import { CartePage } from './pages/Carte'
import { Conflits } from './pages/Conflits'
import { Donnees } from './pages/Donnees'
import { Mandats } from './pages/Mandats'
import { useApp, type Page } from './store'

const NAV: { page: Page; label: string; icon: typeof Home; touche: string }[] = [
  { page: 'accueil', label: 'Accueil', icon: Home, touche: 'H' },
  { page: 'annuaire', label: 'Annuaire', icon: BookUser, touche: 'A' },
  { page: 'carte', label: 'Carte', icon: MapIcon, touche: 'C' },
  { page: 'assistant', label: 'Assistant', icon: Sparkles, touche: 'G' },
  { page: 'mandats', label: 'Mandats', icon: Briefcase, touche: 'M' },
  { page: 'conflits', label: 'Conflits', icon: ShieldCheck, touche: 'K' },
  { page: 'donnees', label: 'Données', icon: Database, touche: 'D' },
]

const TITRES: Record<Page, [string, string]> = {
  accueil: ['Accueil', 'Le réseau en un coup d’œil'],
  annuaire: ['Annuaire', 'Rechercher, filtrer, comparer'],
  carte: ['Carte', 'Le réseau sur le territoire'],
  assistant: ['Assistant', 'Trouver le bon avocat pour un dossier'],
  mandats: ['Mandats', 'Suivi des dossiers confiés'],
  conflits: ['Conflits d’intérêts', 'Contrôle sur l’historique des mandats'],
  donnees: ['Données', 'Sauvegardes, import, réglages'],
}

function useTheme() {
  const [theme, setTheme] = useState<string | null>(() => {
    try { return localStorage.getItem('softres-theme') } catch { return null }
  })
  const sombre = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  const basculer = () => {
    const t = sombre ? 'light' : 'dark'
    document.documentElement.dataset.theme = t
    try { localStorage.setItem('softres-theme', t) } catch { /* stockage indisponible */ }
    setTheme(t)
  }
  return { sombre, basculer }
}

export function App() {
  const app = useApp()
  const qc = useQueryClient()
  const { sombre, basculer } = useTheme()
  const etat = useQuery({ queryKey: ['etat'], queryFn: api.etat, refetchInterval: 60_000 })
  const noms = etat.data?.noms_reels

  // Raccourcis : Ctrl K (palette), lettres de navigation hors champs de saisie.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        app.setPalette(!app.palette)
        return
      }
      const t = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || document.querySelector('dialog[open]')) return
      const n = NAV.find((x) => x.touche.toLowerCase() === e.key.toLowerCase())
      if (n) app.aller(n.page)
      if (e.key === '/') { e.preventDefault(); app.aller('annuaire'); setTimeout(() => document.getElementById('recherche')?.focus(), 50) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [app])

  const basculerNoms = async () => {
    if (!noms?.disponible) return
    if (noms.deverrouille) {
      await api.verrouiller()
      toast('Noms anonymisés')
      qc.invalidateQueries()
    } else app.setDeverrouillage(true)
  }

  const [titre, sousTitre] = TITRES[app.page]
  return (
    <div className="flex h-full">
      <aside className="flex w-[232px] shrink-0 flex-col bg-side px-3 py-4 text-side-ink">
        <div className="mb-6 flex items-center gap-3 px-2">
          <span className="grid size-10 place-items-center rounded-xl bg-brand text-lg font-black text-white shadow-lg shadow-brand/30">S</span>
          <div className="leading-tight">
            <b className="block text-[15px]">Soft - Res</b>
            <small className="text-[11px] text-side-muted">Réseau d’avocats Orion</small>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5" aria-label="Sections">
          {NAV.map(({ page, label, icon: Icon, touche }) => (
            <button
              key={page}
              onClick={() => app.aller(page)}
              aria-current={app.page === page ? 'page' : undefined}
              className={clsx(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-semibold transition',
                app.page === page ? 'bg-white/10 text-white' : 'text-side-muted hover:bg-white/5 hover:text-side-ink',
              )}
            >
              <Icon size={18} className={app.page === page ? 'text-brand' : ''} />
              <span className="flex-1">{label}</span>
              <kbd className="rounded border border-white/10 px-1.5 text-[10px] text-side-muted opacity-0 transition group-hover:opacity-100">{touche}</kbd>
            </button>
          ))}
        </nav>
        <div className="flex-1" />
        {noms?.disponible && (
          <button
            onClick={basculerNoms}
            className={clsx(
              'mb-3 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
              noms.deverrouille ? 'border-brand/50 bg-brand/15' : 'border-white/10 hover:bg-white/5',
            )}
          >
            {noms.deverrouille ? <LockOpen size={18} className="text-brand" /> : <Lock size={18} className="text-side-muted" />}
            <span className="leading-tight">
              <b className="block text-[13px]">{noms.deverrouille ? 'Noms réels' : 'Noms anonymisés'}</b>
              <small className="text-[11px] text-side-muted">{noms.deverrouille ? 'Cliquer pour masquer' : 'Cliquer pour déverrouiller'}</small>
            </span>
          </button>
        )}
        <div className="flex items-center gap-1 px-1">
          <button className="rounded-lg p-2 text-side-muted hover:bg-white/5 hover:text-white" onClick={basculer} title="Thème clair / sombre">
            {sombre ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <span className="flex-1" />
          <span className={clsx('flex items-center gap-1.5 text-[11px]', etat.data?.ia ? 'text-emerald-400' : 'text-side-muted')}>
            <span className={clsx('size-2 rounded-full', etat.data?.ia ? 'bg-emerald-400' : 'bg-side-muted')} />
            {etat.data?.ia ? 'IA active' : 'IA inactive'}
          </span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {etat.data?.demo && (
          <div className="bg-info-soft px-7 py-1.5 text-center text-xs text-info">
            Version de démonstration : les modifications ne sont pas conservées{etat.data.ia ? '' : ' et l’assistant Claude est désactivé'}.
          </div>
        )}
        <header className="flex items-center gap-4 border-b border-line bg-bg/80 px-7 py-3.5 backdrop-blur">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight">{titre}</h1>
            <p className="text-xs text-muted">{sousTitre}</p>
          </div>
          <button
            onClick={() => app.setPalette(true)}
            className="flex w-80 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm text-muted transition hover:border-brand"
          >
            <Search size={16} />
            <span className="flex-1">Rechercher un avocat, une action…</span>
            <kbd className="rounded border border-line px-1.5 text-[10px]">Ctrl K</kbd>
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          {app.page === 'accueil' && <Accueil />}
          {app.page === 'annuaire' && <Annuaire />}
          {app.page === 'carte' && <CartePage />}
          {app.page === 'assistant' && <Assistant />}
          {app.page === 'mandats' && <Mandats />}
          {app.page === 'conflits' && <Conflits />}
          {app.page === 'donnees' && <Donnees />}
        </main>
      </div>

      <Fiche />
      <CourrierDialog />
      <Palette />
      <Deverrouillage />
      <Toaster position="bottom-right" richColors theme={sombre ? 'dark' : 'light'} />
    </div>
  )
}
