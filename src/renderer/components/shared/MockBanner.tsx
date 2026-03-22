import React from 'react'

interface Props {
  mockKeys: string[]
}

const KEY_LABELS: Record<string, string> = {
  lastfm_key: 'Last.fm',
  musicbrainz_email: 'MusicBrainz',
  discogs_token: 'Discogs',
  youtube_api_key: 'YouTube',
  spotify_client_id: 'Spotify',
  anthropic_key: 'Claude',
  gemini_key: 'Gemini',
  listenbrainz_token: 'ListenBrainz',
}

export default function MockBanner({ mockKeys }: Props) {
  const labels = mockKeys.map((k) => KEY_LABELS[k] ?? k).filter(Boolean)

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 text-xs font-medium shrink-0"
      style={{
        background: 'rgba(251,191,36,0.1)',
        borderBottom: '1px solid rgba(251,191,36,0.3)',
        color: '#fbbf24',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>
        Mock mode active
        {labels.length > 0 && (
          <>
            {' — '}
            {labels.join(', ')} {labels.length === 1 ? 'key is' : 'keys are'} missing.
          </>
        )}
        {' '}
        <span style={{ opacity: 0.75 }}>Add API keys in Settings to use real data.</span>
      </span>
    </div>
  )
}
