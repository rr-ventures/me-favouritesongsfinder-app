import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './renderer/components/shared/Sidebar'
import MockBanner from './renderer/components/shared/MockBanner'
import PlayerBar from './renderer/components/player/PlayerBar'
import DiscoverPage from './renderer/pages/DiscoverPage'
import PipelinePage from './renderer/pages/PipelinePage'
import LibraryPage from './renderer/pages/LibraryPage'
import SettingsPage from './renderer/pages/SettingsPage'
import WizardPage from './renderer/pages/WizardPage'

const PLAYERBAR_HEIGHT = 80
const SIDEBAR_WIDTH = 260

export default function App() {
  const [anyMockActive, setAnyMockActive] = useState(false)
  const [mockKeys, setMockKeys] = useState<string[]>([])
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null) // null = not yet determined

  useEffect(() => {
    // Check mock status
    window.electron.ipc
      .invoke('settings:getMockStatus')
      .then((status) => {
        const s = status as { anyMockActive: boolean; mockKeys: string[] }
        setAnyMockActive(s.anyMockActive)
        setMockKeys(s.mockKeys)
      })
      .catch(() => {
        setAnyMockActive(true)
        setMockKeys([])
      })

    // Check first-run (no seeds set)
    window.electron.ipc.invoke('db:getSeeds').then((seeds) => {
      setIsFirstRun((seeds as unknown[]).length === 0)
    }).catch(() => {
      setIsFirstRun(false)
    })
  }, [])

  // Don't render routes until we know first-run state (avoids flash)
  if (isFirstRun === null) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {anyMockActive && <MockBanner mockKeys={mockKeys} />}

      <Routes>
        {/* Wizard — full screen, no sidebar/playerbar */}
        <Route path="/wizard" element={<WizardPage />} />

        {/* Main app shell */}
        <Route
          path="/*"
          element={
            <>
              <div
                className="flex flex-1 overflow-hidden"
                style={{ paddingBottom: PLAYERBAR_HEIGHT }}
              >
                {/* Sidebar */}
                <Sidebar />

                {/* Main content */}
                <main className="flex-1 overflow-hidden">
                  <Routes>
                    <Route
                      path="/"
                      element={isFirstRun
                        ? <Navigate to="/wizard" replace />
                        : <Navigate to="/discover" replace />
                      }
                    />
                    <Route path="/discover" element={<DiscoverPage />} />
                    <Route path="/library" element={<LibraryPage />} />
                    <Route path="/pipeline" element={<PipelinePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/discover" replace />} />
                  </Routes>
                </main>
              </div>

              {/* React PlayerBar */}
              <div
                className="fixed bottom-0 right-0 z-50"
                style={{ height: PLAYERBAR_HEIGHT, left: SIDEBAR_WIDTH }}
              >
                <PlayerBar />
              </div>
            </>
          }
        />
      </Routes>
    </div>
  )
}
