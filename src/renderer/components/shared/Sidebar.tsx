import React, { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

interface Playlist {
  id: number
  name: string
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3L2 12h3v9h6v-6h2v6h6v-9h3L12 3z" />
    </svg>
  )
}

function HomeOutlineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12L12 3l9 9" />
      <path d="M5 10v9h5v-5h4v5h5v-9" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

function SearchOutlineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="6" />
      <line x1="20" y1="20" x2="15.5" y2="15.5" />
    </svg>
  )
}

function LibraryFilledIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="4" height="18" rx="1" />
      <rect x="9" y="7" width="4" height="14" rx="1" />
      <path d="M15 5l4 1v13l-4-1V5z" />
    </svg>
  )
}

function LibraryOutlineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="4" height="18" rx="1" />
      <rect x="9" y="7" width="4" height="14" rx="1" />
      <path d="M15 5l4 1v13l-4-1V5z" />
    </svg>
  )
}

function PipelineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
    </svg>
  )
}

function HeartFilledIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#e5534b">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function MusicNoteIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

interface NavItemDef {
  path: string
  label: string
  icon: React.ReactNode
  activeIcon: React.ReactNode
}

const mainNavItems: NavItemDef[] = [
  { path: '/discover',  label: 'Discover',  icon: <HomeOutlineIcon />,   activeIcon: <HomeIcon /> },
  { path: '/library',   label: 'Library',   icon: <LibraryOutlineIcon />, activeIcon: <LibraryFilledIcon /> },
  { path: '/pipeline',  label: 'Pipeline',  icon: <PipelineIcon />,       activeIcon: <PipelineIcon /> },
  { path: '/settings',  label: 'Settings',  icon: <SettingsIcon />,       activeIcon: <SettingsIcon /> },
]

export default function Sidebar() {
  const location = useLocation()
  const [playlists, setPlaylists] = useState<Playlist[]>([])

  useEffect(() => {
    window.electron.ipc.invoke('db:getPlaylists').then((data) => {
      setPlaylists(data as Playlist[])
    }).catch(() => {})
  }, [location.pathname])

  return (
    <aside
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c6af7 0%, #9b8bf9 100%)' }}
          >
            <MusicNoteIcon size={18} />
          </div>
          <div>
            <div className="font-bold text-white text-sm tracking-tight leading-none">MixingSongFinder</div>
            <div className="text-2xs font-medium mt-0.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>MUSIC DISCOVERY</div>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="px-2 space-y-0.5">
        {mainNavItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path === '/discover' && location.pathname === '/')
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="group flex items-center gap-4 px-4 py-2.5 rounded-md text-sm font-medium transition-colors relative"
              style={({ isActive: routerActive }) => ({
                background: (routerActive || isActive) ? 'var(--bg-hover)' : 'transparent',
                color: (routerActive || isActive) ? 'var(--text-primary)' : 'var(--text-secondary)',
              })}
            >
              {({ isActive: routerActive }) => {
                const active = routerActive || isActive
                return (
                  <>
                    {active && (
                      <span
                        className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full"
                        style={{ background: 'var(--accent)' }}
                      />
                    )}
                    <span className="transition-colors" style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {active ? item.activeIcon : item.icon}
                    </span>
                    <span className={active ? 'font-semibold' : 'font-medium group-hover:text-white transition-colors'}>
                      {item.label}
                    </span>
                  </>
                )
              }}
            </NavLink>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-4" style={{ height: 1, background: 'var(--border)' }} />

      {/* Your Library */}
      <div className="flex-1 overflow-y-auto px-2 min-h-0">
        <div className="flex items-center justify-between px-4 py-1 mb-1">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            Your Library
          </span>
          <button
            onClick={() => {
              const name = window.prompt('Playlist name:')
              if (name?.trim()) {
                window.electron.ipc.invoke('db:createPlaylist', name.trim()).then(() => {
                  window.electron.ipc.invoke('db:getPlaylists').then((data) => {
                    setPlaylists(data as Playlist[])
                  })
                })
              }
            }}
            className="w-6 h-6 flex items-center justify-center rounded-full transition-colors hover:bg-bg-hover"
            style={{ color: 'var(--text-muted)' }}
            title="New playlist"
          >
            <PlusIcon />
          </button>
        </div>

        <div className="space-y-0.5">
          {/* Liked Songs — always first */}
          <NavLink
            to="/library"
            className="flex items-center gap-3 px-4 py-2 rounded-md text-sm transition-colors hover:bg-bg-hover group"
            style={{ color: 'var(--text-secondary)' }}
          >
            <div
              className="w-8 h-8 rounded flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #450af5, #c4efd9)' }}
            >
              <HeartFilledIcon size={14} />
            </div>
            <span className="truncate font-medium group-hover:text-white transition-colors">Liked Songs</span>
          </NavLink>

          {/* User-created playlists */}
          {playlists.filter((p) => p.id !== 1).map((pl) => (
            <NavLink
              key={pl.id}
              to="/library"
              className="flex items-center gap-3 px-4 py-2 rounded-md text-sm transition-colors hover:bg-bg-hover group"
              style={{ color: 'var(--text-secondary)' }}
            >
              <div
                className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                style={{ background: 'var(--bg-elevated)' }}
              >
                <MusicNoteIcon />
              </div>
              <span className="truncate group-hover:text-white transition-colors">{pl.name}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Version */}
      <div className="px-6 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-2xs font-medium" style={{ color: 'var(--text-muted)' }}>v1.0.0</span>
      </div>
    </aside>
  )
}
