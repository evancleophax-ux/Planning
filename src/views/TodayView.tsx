// Vue « Aujourd'hui » : la frise de la journée et les tâches sans heure.

import { useRef, useState } from 'react'
import { KIND_LABELS, type Entry } from '../types'
import { useItemsBetween, useSeries } from '../db/hooks'
import { moveEntry, toggleDone } from '../db/actions'
import { entriesForDate } from '../lib/entries'
import { addDays, countdown, formatLong, todayISO } from '../lib/dates'
import { useApp } from '../app/context'
import { Check, Chevron, Dot } from '../components/ui'
import { Timeline, dragState } from './Timeline'

export function TodayView({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const app = useApp()
  const items = useItemsBetween(date, date)
  const series = useSeries()
  const entries = entriesForDate(items, series, date)
  const untimed = entries.filter((e) => !e.start)
  const timed = entries.filter((e) => e.start)
  const today = todayISO()
  const [dir, setDir] = useState<'left' | 'right' | ''>('')

  const go = (n: number) => {
    setDir(n > 0 ? 'left' : 'right')
    setDate(addDays(date, n))
  }

  // Balayage horizontal = jour précédent / suivant.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current
    touch.current = null
    if (!t || dragState.active) return
    const dx = e.changedTouches[0].clientX - t.x
    const dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) go(dx < 0 ? 1 : -1)
  }

  const open = (entry: Entry) => app.openEditor({ mode: 'edit', entry })
  const rel = countdown(date, today)

  return (
    <div className="view" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="view-header">
        <div>
          <h1>{formatLong(date)}</h1>
          <p className="muted">{rel.charAt(0).toUpperCase() + rel.slice(1)}</p>
        </div>
        <div className="nav-buttons">
          {date !== today && (
            <button type="button" className="btn-text" onClick={() => { setDir(date < today ? 'left' : 'right'); setDate(today) }}>
              Aujourd'hui
            </button>
          )}
          <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Jour précédent"><Chevron dir="left" /></button>
          <button type="button" className="icon-btn" onClick={() => go(1)} aria-label="Jour suivant"><Chevron dir="right" /></button>
        </div>
      </header>

      <div key={date} className={'today-grid slide-' + dir}>
        <section className="today-timeline" aria-label="Frise de la journée">
          <Timeline
            entries={timed}
            isToday={date === today}
            onOpen={open}
            onToggle={toggleDone}
            onMove={(e, start, end) => moveEntry(e, { start, end })}
          />
        </section>

        <section className="today-tasks">
          <h3 className="section-title">Sans heure</h3>
          {untimed.length === 0 && <p className="muted empty">Rien à cocher. Ajoute une tâche en haut.</p>}
          <ul className="list">
            {untimed.map((e) => {
              const subject = app.subjectById(e.subjectId)
              return (
                <li key={e.id} className={'list-row tappable' + (e.done ? ' done' : '')} onClick={() => open(e)}>
                  <Check checked={e.done} onChange={() => toggleDone(e)} label="Fait" />
                  <div className="row-text">
                    <span className="row-title">{e.title}</span>
                    {(e.kind !== 'task' || subject) && (
                      <span className="row-sub">
                        <Dot subject={subject} />
                        {[e.kind !== 'task' ? KIND_LABELS[e.kind] : '', subject?.name].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {timed.length > 0 && <p className="hint">Astuce : appui long sur un bloc de la frise pour le déplacer.</p>}
        </section>
      </div>
    </div>
  )
}
