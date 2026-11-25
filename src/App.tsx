import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Item } from './types'
import { useSettings, useSubjects } from './db/hooks'
import { todayISO } from './lib/dates'
import { AppContext, type AppApi, type EditorTarget } from './app/context'
import { QuickAdd } from './components/QuickAdd'
import { ItemSheet } from './components/ItemSheet'
import { RevisionSheet } from './components/RevisionSheet'
import { TodayView } from './views/TodayView'
import { WeekView } from './views/WeekView'
import { ExamsView } from './views/ExamsView'
import { SettingsView } from './views/SettingsView'

type Tab = 'today' | 'week' | 'exams' | 'settings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'week', label: 'Semaine' },
  { id: 'exams', label: 'Contrôles' },
  { id: 'settings', label: 'Paramètres' },
]

export default function App() {
  const subjects = useSubjects()
  const settings = useSettings()
  const [tab, setTab] = useState<Tab>('today')
  const [date, setDate] = useState(todayISO)
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [revisionExam, setRevisionExam] = useState<Item | null>(null)
  const [toast, setToast] = useState<{ text: string; date?: string; key: number } | null>(null)
  const toastTimer = useRef(0)

  // Au retour sur l'appli le lendemain, revenir sur la bonne journée.
  const lastToday = useRef(todayISO())
  useEffect(() => {
    const onVisible = () => {
      const t = todayISO()
      if (document.visibilityState === 'visible' && t !== lastToday.current) {
        if (date === lastToday.current) setDate(t)
        lastToday.current = t
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [date])

  const goToDay = useCallback((d: string) => {
    setDate(d)
    setTab('today')
  }, [])

  const api = useMemo<AppApi>(() => ({
    subjects,
    settings,
    subjectById: (id) => (id ? subjects.find((s) => s.id === id) : undefined),
    openEditor: setEditor,
    openRevisions: setRevisionExam,
    goToDay,
    toast: (text, d) => {
      clearTimeout(toastTimer.current)
      setToast({ text, date: d, key: Date.now() })
      toastTimer.current = window.setTimeout(() => setToast(null), 2600)
    },
  }), [subjects, settings, goToDay])

  return (
    <AppContext.Provider value={api}>
      <div className="app">
        <QuickAdd />
        <main className="content">
          {tab === 'today' && <TodayView date={date} setDate={setDate} />}
          {tab === 'week' && <WeekView initialDate={date} onOpenDay={goToDay} />}
          {tab === 'exams' && <ExamsView />}
          {tab === 'settings' && <SettingsView />}
        </main>

        {toast && (
          <button
            key={toast.key}
            type="button"
            className="toast"
            onClick={() => { if (toast.date) goToDay(toast.date); setToast(null) }}
          >
            {toast.text}{toast.date && <span className="toast-link">Voir</span>}
          </button>
        )}

        <nav className="tabbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'active' : ''}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => { if (t.id === 'today' && tab === 'today') setDate(todayISO()); setTab(t.id) }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {editor && <ItemSheet key={editor.mode === 'edit' ? editor.entry.id : 'new'} target={editor} onClose={() => setEditor(null)} />}
        {revisionExam && <RevisionSheet exam={revisionExam} onClose={() => setRevisionExam(null)} />}
      </div>
    </AppContext.Provider>
  )
}
