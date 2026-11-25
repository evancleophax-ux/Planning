// Vue « Semaine » : les priorités en haut, puis un résumé des 7 jours.

import { useState } from 'react'
import type { Priority } from '../types'
import { useItemsBetween, usePriorities, useSeries } from '../db/hooks'
import { addPriority, carryOverPriorities, deletePriority, reorderPriorities, updatePriority } from '../db/actions'
import { entriesForRange } from '../lib/entries'
import { addDays, formatDayMonth, formatTime, startOfWeek, todayISO, WEEKDAY_SHORT, weekday, fromISO } from '../lib/dates'
import { useApp } from '../app/context'
import { Check, Chevron, Dot } from '../components/ui'

const MAX_PRIORITIES = 5

export function WeekView({ initialDate, onOpenDay }: { initialDate: string; onOpenDay: (d: string) => void }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(initialDate))
  const weekEnd = addDays(weekStart, 6)
  const today = todayISO()
  const thisWeek = startOfWeek(today)

  const title = weekStart === thisWeek ? 'Cette semaine'
    : weekStart === addDays(thisWeek, 7) ? 'Semaine prochaine'
    : weekStart === addDays(thisWeek, -7) ? 'Semaine dernière'
    : `Semaine du ${formatDayMonth(weekStart)}`

  return (
    <div className="view">
      <header className="view-header">
        <div>
          <h1>{title}</h1>
          <p className="muted">Du {formatDayMonth(weekStart)} au {formatDayMonth(weekEnd)}</p>
        </div>
        <div className="nav-buttons">
          {weekStart !== thisWeek && <button type="button" className="btn-text" onClick={() => setWeekStart(thisWeek)}>Cette semaine</button>}
          <button type="button" className="icon-btn" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semaine précédente"><Chevron dir="left" /></button>
          <button type="button" className="icon-btn" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semaine suivante"><Chevron dir="right" /></button>
        </div>
      </header>
      <div key={weekStart} className="fade-in">
        <Priorities weekStart={weekStart} />
        <Days weekStart={weekStart} onOpenDay={onOpenDay} />
      </div>
    </div>
  )
}

function Priorities({ weekStart }: { weekStart: string }) {
  const list = usePriorities(weekStart)
  const previous = usePriorities(addDays(weekStart, -7))
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const leftover = previous.filter((p) => !p.done).length

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await addPriority(weekStart, text.trim())
    setText('')
  }

  function move(i: number, d: number) {
    const next = [...list]
    const [p] = next.splice(i, 1)
    next.splice(i + d, 0, p)
    reorderPriorities(next)
  }

  return (
    <section className="block-section">
      <div className="section-head">
        <h3 className="section-title">Priorités</h3>
        {list.length > 0 && (
          <button type="button" className="btn-text" onClick={() => setEditing(!editing)}>{editing ? 'OK' : 'Modifier'}</button>
        )}
      </div>
      <ol className="list priorities">
        {list.map((p: Priority, i) => (
          <li key={p.id} className={'list-row' + (p.done ? ' done' : '')}>
            <Check checked={p.done} onChange={() => updatePriority(p.id, { done: !p.done })} label="Fait" />
            {editing ? (
              <>
                <input className="inline-input" defaultValue={p.text} onBlur={(e) => e.target.value.trim() && updatePriority(p.id, { text: e.target.value.trim() })} aria-label="Priorité" />
                <button type="button" className="icon-btn small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">↑</button>
                <button type="button" className="icon-btn small" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">↓</button>
                <button type="button" className="btn-text danger" onClick={() => deletePriority(p.id)}>Retirer</button>
              </>
            ) : (
              <span className="row-title priority-text"><span className="priority-num">{i + 1}</span>{p.text}</span>
            )}
          </li>
        ))}
      </ol>
      {list.length < MAX_PRIORITIES && (
        <form onSubmit={add} className="add-row">
          <input className="inline-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={list.length ? 'Ajouter une priorité' : 'Ta priorité n°1 cette semaine ?'} enterKeyHint="done" />
        </form>
      )}
      {list.length === 0 && leftover > 0 && (
        <button type="button" className="btn-text" onClick={() => carryOverPriorities(addDays(weekStart, -7), weekStart)}>
          Reprendre {leftover} priorité{leftover > 1 ? 's' : ''} non terminée{leftover > 1 ? 's' : ''} de la semaine précédente
        </button>
      )}
    </section>
  )
}

function Days({ weekStart, onOpenDay }: { weekStart: string; onOpenDay: (d: string) => void }) {
  const app = useApp()
  const weekEnd = addDays(weekStart, 6)
  const items = useItemsBetween(weekStart, weekEnd)
  const series = useSeries()
  const byDay = entriesForRange(items, series, weekStart, weekEnd)
  const today = todayISO()

  return (
    <section className="block-section">
      <h3 className="section-title">Jours</h3>
      <ul className="list">
        {[...byDay].map(([date, entries]) => {
          const shown = entries.slice(0, 4)
          const more = entries.length - shown.length
          return (
            <li key={date} className={'list-row tappable day-row' + (date === today ? ' is-today' : '') + (date < today ? ' past' : '')} onClick={() => onOpenDay(date)}>
              <div className="day-label">
                <span className="day-name">{WEEKDAY_SHORT[weekday(date)]}</span>
                <span className="day-num">{fromISO(date).getDate()}</span>
              </div>
              <div className="day-summary">
                {entries.length === 0 && <span className="muted">—</span>}
                {shown.map((e) => (
                  <span key={e.id} className={'summary-item' + (e.done ? ' done' : '') + (e.kind === 'exam' ? ' strong' : '')}>
                    <Dot subject={app.subjectById(e.subjectId)} />
                    {e.start && <span className="muted">{formatTime(e.start)} </span>}
                    {e.title}
                  </span>
                ))}
                {more > 0 && <span className="muted">+ {more} autre{more > 1 ? 's' : ''}</span>}
              </div>
              <Chevron dir="right" />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
