/* État de navigation partagé : page courante, filtres de l'annuaire, fenêtres ouvertes. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { FILTRES_VIDES, type Filtres } from './api'

export const PAGES = ['accueil', 'annuaire', 'carte', 'assistant', 'mandats', 'conflits', 'donnees'] as const
export type Page = (typeof PAGES)[number]

export type DossierCourrier = { ref?: string; assure?: string; adverse?: string; objet?: string }

type Ctx = {
  page: Page
  aller: (p: Page) => void
  filtres: Filtres
  setFiltres: (f: Filtres | ((f: Filtres) => Filtres)) => void
  ouvrirAnnuaire: (patch: Partial<Filtres>) => void
  ficheId: number | null
  ouvrirFiche: (id: number | null) => void
  courrier: { lawyerId: number; dossier: DossierCourrier } | null
  ouvrirCourrier: (lawyerId: number, dossier?: DossierCourrier) => void
  fermerCourrier: () => void
  palette: boolean
  setPalette: (v: boolean) => void
  deverrouillage: boolean
  setDeverrouillage: (v: boolean) => void
}

const AppCtx = createContext<Ctx | null>(null)

const pageDuHash = (): Page => {
  const h = location.hash.replace(/^#\/?/, '') as Page
  return PAGES.includes(h) ? h : 'accueil'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>(pageDuHash)
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIDES)
  const [ficheId, setFicheId] = useState<number | null>(null)
  const [courrier, setCourrier] = useState<Ctx['courrier']>(null)
  const [palette, setPalette] = useState(false)
  const [deverrouillage, setDeverrouillage] = useState(false)

  useEffect(() => {
    const f = () => { setPage(pageDuHash()); setFicheId(null); setCourrier(null) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  const aller = useCallback((p: Page) => {
    location.hash = '/' + p
    setPage(p)
    setFicheId(null)
    setCourrier(null)
  }, [])

  const ouvrirAnnuaire = useCallback(
    (patch: Partial<Filtres>) => {
      setFiltres({ ...FILTRES_VIDES, ...patch })
      aller('annuaire')
    },
    [aller],
  )

  const value = useMemo<Ctx>(
    () => ({
      page, aller, filtres, setFiltres, ouvrirAnnuaire,
      ficheId, ouvrirFiche: setFicheId,
      courrier,
      ouvrirCourrier: (lawyerId, dossier = {}) => setCourrier({ lawyerId, dossier }),
      fermerCourrier: () => setCourrier(null),
      palette, setPalette, deverrouillage, setDeverrouillage,
    }),
    [page, aller, filtres, ouvrirAnnuaire, ficheId, courrier, palette, deverrouillage],
  )
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp hors AppProvider')
  return c
}
