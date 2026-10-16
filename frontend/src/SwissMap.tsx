/* Carte de la Suisse romande (SVG, hors ligne) : cantons du réseau, lacs, villes et leur nombre d'avocats. */
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import { api, CANTON_COULEURS } from './api'

type Props = {
  onCanton?: (code: string) => void
  onVille?: (nom: string) => void
  cantonsActifs?: string[]
  villeSurvol?: string | null
  cantonSurvol?: string | null
  className?: string
}

export function SwissMap({ onCanton, onVille, cantonsActifs = [], villeSurvol, cantonSurvol, className }: Props) {
  const { data } = useQuery({ queryKey: ['carte'], queryFn: api.carte, staleTime: Infinity })
  const [tip, setTip] = useState<{ x: number; y: number; texte: string } | null>(null)
  if (!data) return <div className={clsx('animate-pulse rounded-xl bg-surface-3', className)} style={{ aspectRatio: '940/603' }} />

  const maxN = Math.max(1, ...data.villes.map((v) => v.n))
  return (
    <div className={clsx('relative', className)}>
      <svg viewBox={`0 0 ${data.w} ${data.h}`} className="h-auto w-full select-none" role="img" aria-label="Carte du réseau">
        {Object.entries(data.cantons).map(([code, d]) => {
          const reseau = code in data.noms_cantons
          const actif = cantonsActifs.includes(code) || cantonSurvol === code
          return (
            <path
              key={code}
              d={d}
              onClick={reseau && onCanton ? () => onCanton(code) : undefined}
              onMouseMove={reseau ? (e) => setTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, texte: data.noms_cantons[code] }) : undefined}
              onMouseLeave={() => setTip(null)}
              style={{
                fill: reseau ? CANTON_COULEURS[code] : 'var(--map-land)',
                fillOpacity: reseau ? (actif ? 0.5 : 0.17) : 1,
                stroke: actif ? CANTON_COULEURS[code] : 'var(--map-stroke)',
                strokeWidth: actif ? 2.4 : 1.2,
                cursor: reseau && onCanton ? 'pointer' : 'default',
                transition: 'fill-opacity .2s',
              }}
            />
          )
        })}
        {data.lacs.map((d, i) => (
          <path key={i} d={d} style={{ fill: 'var(--map-lake)', stroke: 'none', pointerEvents: 'none' }} />
        ))}
        {data.villes.filter((v) => v.n > 0).map((v) => {
          const r = 4 + 9 * Math.sqrt(v.n / maxN)
          const hot = villeSurvol === v.cle
          return (
            <g
              key={v.cle}
              onClick={onVille ? () => onVille(v.nom) : undefined}
              onMouseMove={(e) => setTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, texte: `${v.nom} · ${v.n} avocat${v.n > 1 ? 's' : ''}` })}
              onMouseLeave={() => setTip(null)}
              style={{ cursor: onVille ? 'pointer' : 'default' }}
            >
              <circle cx={v.x} cy={v.y} r={r + (hot ? 4 : 0)} style={{ fill: hot ? 'var(--brand)' : 'var(--surface)', stroke: 'var(--brand)', strokeWidth: 2, transition: 'r .15s' }} />
              {v.n > 1 && (
                <text x={v.x} y={v.y + 4} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: hot ? '#fff' : 'var(--brand)', pointerEvents: 'none' }}>
                  {v.n}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {tip && (
        <div className="pointer-events-none absolute z-10 rounded-lg bg-ink px-2 py-1 text-xs font-semibold text-bg shadow" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          {tip.texte}
        </div>
      )}
    </div>
  )
}
