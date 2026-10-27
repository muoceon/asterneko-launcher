import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ModeToggle } from '@/components/features/theme/ThemeToggleIcon'
import { LanguageIcon } from '@/components/features/languages/LanguageIcon'
import Sidebar from '@/components/layout/Sidebar'
import StatusBar from '@/components/layout/StatusBar'
import { TaskManagerPopup } from '@/components/download/TaskManagerPopup'
import { TaskManagerProvider } from '@/contexts/TaskManagerContext'

import { Minus, Square, X } from 'lucide-react'

function TitleBar() {
  const win = getCurrentWindow()

  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <span className="font-semibold text-[15px] tracking-tight">Asterneko Launcher</span>
      </div>
      <div className="titlebar-controls">
        <ModeToggle />
        <LanguageIcon />
        <div className="w-px h-5 bg-border mx-1.5" />
        <button type="button" className="titlebar-btn" onClick={() => void win.minimize()} aria-label="Minimize">
          <Minus className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <button type="button" className="titlebar-btn" onClick={() => void win.toggleMaximize()} aria-label="Maximize">
          <Square className="h-3 w-3" strokeWidth={2} />
        </button>
        <button type="button" className="titlebar-btn titlebar-close" onClick={() => void win.close()} aria-label="Close">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

export default function Layout() {
  const [managerOpen, setManagerOpen] = useState(false)

  return (
    <TaskManagerProvider>
      <TitleBar />
      <div className="flex h-screen w-screen flex-col pt-(--nav-height)">
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
        <StatusBar onOpenManager={() => setManagerOpen(true)} />
      </div>
      <TaskManagerPopup open={managerOpen} onOpenChange={setManagerOpen} />
    </TaskManagerProvider>
  )
}