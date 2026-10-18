import type { CSSProperties } from 'react'

type Props = {
  className?: string
  title?: string
  decorative?: boolean
  style?: CSSProperties
}

export default function BrandLogo({ className = '', title = 'Lughati Vokasi', decorative = false, style }: Props) {
  const label = decorative ? undefined : title
  return (
    <svg
      className={`brand-logo ${className}`.trim()}
      viewBox="0 0 120 120"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={label}
      style={style}
    >
      <g className="brand-logo-secondary" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 43 9 53v35l15 10" />
        <path d="M101 43 111 53v35L96 98" />
      </g>

      <g className="brand-logo-primary">
        <g fill="currentColor" transform="translate(60 29)">
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x="-2" y="-27" width="4" height="17" rx="1" transform={`rotate(${i * 30})`} />
          ))}
          <circle r="19" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle r="14" opacity=".12" />
        </g>

        <text
          x="60"
          y="34"
          textAnchor="middle"
          direction="rtl"
          unicodeBidi="bidi-override"
          fontFamily="var(--ar-font)"
          fontSize="15"
          fontWeight="700"
          fill="currentColor"
        >مُحَمَّد</text>

        <path
          d="M21 49c13-7 26-9 39 3 13-12 26-10 39-3v29c-14-5-26-4-39 6-13-10-25-11-39-6Z"
          fill="currentColor"
          opacity=".2"
        />
        <path
          d="M21 49c13-7 26-9 39 3 13-12 26-10 39-3M21 58c13-6 26-7 39 4 13-11 26-10 39-4M60 52v32"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19 68c11 1 21 5 30 11 4 3 8 5 11 5s7-2 11-5c9-6 19-10 30-11l-5 30c-11 4-23 8-36 15-13-7-25-11-36-15Z"
          fill="currentColor"
        />
        <path
          d="M29 84c8 3 18 7 31 14 13-7 23-11 31-14"
          fill="none"
          stroke="var(--brand-logo-cut, rgba(255,255,255,.8))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="3 5"
          opacity=".8"
        />
        <path
          d="M75 69v19c0 4 3 7 7 7s7-3 7-7V69"
          fill="var(--brand-logo-highlight, currentColor)"
          opacity=".55"
        />
        <circle cx="82" cy="86" r="2.5" fill="var(--brand-logo-cut, #fff)" />
      </g>
    </svg>
  )
}
