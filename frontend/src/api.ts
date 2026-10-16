/* Client de l'API locale (moteur Python). Les types reflètent les modèles Pydantic. */

export type Avocat = {
  id: number
  nom: string
  canton: string
  canton_nom: string
  ville: string
  ville_cle: string | null
  tarif: string
  tarif_min: number
  domaine: string
  domaines: string[]
  specs: string[]
  fsa: boolean
  tel: string
  email: string
  lat: number | null
  lon: number | null
  favori: boolean
  note: string
  mandats: number
  en_cours: number
  dernier_mandat: string | null
  evaluation: number | null
  distance: number | null
  ajoute: boolean
}

export type Filtres = {
  q: string
  cantons: string[]
  specs: string[]
  tarif_max: number | null
  fsa: boolean
  favoris: boolean
  pres_de: string
  rayon: number
  tri: string
}

export const FILTRES_VIDES: Filtres = {
  q: '', cantons: [], specs: [], tarif_max: null, fsa: false, favoris: false, pres_de: '', rayon: 30, tri: 'pertinence',
}

export type Mandat = {
  id: number
  lawyer_id: number
  avocat: string
  ref: string
  date: string
  assure: string
  adverse: string
  matiere: string
  note: string
  statut: string
  evaluation: number
}

export type Stats = {
  avocats: number
  cantons: number
  villes: number
  fsa: number
  tarif_moyen: number
  tarif_bornes: [number, number]
  par_canton: Record<string, { nom: string; n: number; fsa: number; villes: number; tarif_min: number; tarif_max: number; tarif_median: number }>
  par_specialite: Record<string, number>
  par_ville: { cle: string; nom: string; n: number }[]
}

export type Etat = {
  version: string
  ia: boolean
  modele: string
  noms_reels: { disponible: boolean; deverrouille: boolean }
  dossier_donnees: string
  verrouillage_minutes: number
}

export type Carte = {
  w: number
  h: number
  cantons: Record<string, string>
  lacs: string[]
  villes: { cle: string; nom: string; x: number; y: number; n: number }[]
  noms_cantons: Record<string, string>
}

export type Criteres = {
  spec: string | null
  lieu: string
  canton: string | null
  budget: number | null
  fsa: boolean
  assure: string
  adverse: string
}

export type Classe = { avocat: Avocat; score: number; raisons: string[]; conflit: string[]; argument: string }

export type ResultatAssistant = {
  criteres: Criteres
  resume: string
  classement: Classe[]
  conseil: string
  moteur: 'ia' | 'regles'
  avertissement: string
}

export type ConflitHit = {
  mandat_id: number
  lawyer_id: number
  avocat: string
  ref: string
  date: string
  assure: string
  adverse: string
  role: string
  score: number
}

export const SPECS = [
  'Droit du travail', 'Assurances & RC', 'Construction / Immobilier', 'Bail', 'Pénal / LCR', 'Contrats', 'Généraliste',
]
export const CANTONS: Record<string, string> = {
  VD: 'Vaud', GE: 'Genève', NE: 'Neuchâtel', VS: 'Valais', JU: 'Jura', FR: 'Fribourg', BE: 'Berne',
}
export const CANTON_COULEURS: Record<string, string> = {
  VD: '#C41E3A', GE: '#2F5FA8', NE: '#0E8C8C', VS: '#D9701C', JU: '#7A4BC2', FR: '#3E4E63', BE: '#2F9E5C',
}
export const court = (spec: string) => spec.split(' /')[0]

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch('/api' + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) {
    let msg = `Erreur ${r.status}`
    try {
      const j = await r.json()
      msg = typeof j.detail === 'string' ? j.detail : msg
    } catch { /* corps non JSON */ }
    throw new ApiError(r.status, msg)
  }
  return r.status === 204 ? (undefined as T) : r.json()
}

export const api = {
  etat: () => call<Etat>('GET', '/etat'),
  stats: () => call<Stats>('GET', '/stats'),
  carte: () => call<Carte>('GET', '/carte'),
  lieux: (q: string) => call<{ valeur: string; libelle: string }[]>('GET', '/lieux?q=' + encodeURIComponent(q)),
  annuaire: (f: Filtres) =>
    call<{ avocats: Avocat[]; total: number; pres_de: { label: string } | null }>('POST', '/annuaire', f),
  interpreter: (texte: string) =>
    call<{ filters: Filtres; resume: string } | null>('POST', '/annuaire/interpreter', { texte }),
  avocat: (id: number) => call<{ avocat: Avocat; mandats: Mandat[] }>('GET', `/avocats/${id}`),
  creerAvocat: (a: Partial<Avocat>) => call<Avocat>('POST', '/avocats', a),
  modifierAvocat: (id: number, a: Partial<Avocat>) => call<Avocat>('PATCH', `/avocats/${id}`, a),
  retirerAvocat: (id: number) => call<void>('DELETE', `/avocats/${id}`),
  favori: (id: number, on: boolean) => call<{ on: boolean }>('PUT', `/avocats/${id}/favori`, { on }),
  note: (id: number, texte: string) => call<{ texte: string }>('PUT', `/avocats/${id}/note`, { texte }),
  vu: (id: number) => call<void>('POST', `/avocats/${id}/vu`),
  recents: () => call<Avocat[]>('GET', '/recents'),
  mandats: (lawyerId?: number) => call<Mandat[]>('GET', '/mandats' + (lawyerId != null ? `?lawyer_id=${lawyerId}` : '')),
  creerMandat: (m: Partial<Mandat>) => call<Mandat>('POST', '/mandats', m),
  modifierMandat: (id: number, m: Partial<Mandat>) => call<Mandat>('PATCH', `/mandats/${id}`, m),
  supprimerMandat: (id: number) => call<void>('DELETE', `/mandats/${id}`),
  conflits: (nom: string) => call<ConflitHit[]>('GET', '/conflits?nom=' + encodeURIComponent(nom)),
  conflitsAvocat: (lawyer_id: number, assure: string, adverse: string) =>
    call<string[]>('POST', '/conflits/avocat', { lawyer_id, assure, adverse }),
  assistantRegles: (c: Criteres) => call<ResultatAssistant>('POST', '/assistant/regles', c),
  assistantIA: (demande: string) => call<ResultatAssistant>('POST', '/assistant/ia', { demande }),
  courrier: (lawyer_id: number, dossier: Record<string, string>, ia: boolean) =>
    call<{ texte: string; moteur: string; avertissement: string; conflits: string[] }>('POST', '/courrier', {
      lawyer_id, dossier, ia,
    }),
  reglages: () => call<Record<string, string>>('GET', '/reglages'),
  reglage: (key: string, texte: string) => call<unknown>('PUT', `/reglages/${key}`, { texte }),
  deverrouiller: (phrase: string) => call<{ noms: number }>('POST', '/noms/deverrouiller', { phrase }),
  verrouiller: () => call<void>('POST', '/noms/verrouiller'),
  restaurer: (data: unknown, remplacer: boolean) =>
    call<{ avocats: number; mandats: number }>('POST', '/sauvegarde', { data, remplacer }),
}
