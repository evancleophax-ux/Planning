// La frise de la journée, heure par heure.
// Appui long sur un bloc puis glisser = changer son heure (par pas de 15 min).

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Entry } from '../types'
import { formatTime, fromMinutes, toMinutes } from '../lib/dates'
import { layoutColumns } from '../lib/entries'
import { timeRange } from '../lib/describe'
import { useApp } from '../app/context'
import { Check, Dot } from '../components/ui'

const HOUR = 56 // hauteur d'une heure en pixels
const PX_PER_MIN = HOUR / 60
const SNAP = 15
const LONG_PRESS = 280

/** Vrai pendant un glisser-déposer (pour ne pas changer de jour en même temps). */
export const dragState = { active: false }

interface Props {
  entries: Entry[]
  isToday: boolean
  onOpen: (e: Entry) => void
  onMove: (e: Entry, start: string, end: string) => void
  onToggle: (e: Entry) => void
}

export function Timeline({ entries, isToday, onOpen, onMove, onToggle }: Props) {
  const app = useApp()
  const timed = entries.filter((e) => e.start && e.end)
  let first = Math.floor(toMinutes(app.settings.dayStart) / 60)
  let last = Math.ceil(toMinutes(app.settings.dayEnd) / 60)
  for (const e of timed) {
    first = Math.min(first, Math.floor(toMinutes(e.start!) / 60))
    last = Math.max(last, Math.ceil(toMinutes(e.end!) / 60))
  }
  last = Math.min(Math.max(last, first + 1), 24)
  const hours = Array.from({ length: last - first }, (_, i) => first + i)
  const layout = layoutColumns(timed)

  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes())
  useEffect(() => {
    const t = setInterval(() => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()), 60000)
    return () => clearInterval(t)
  }, [])

  const top = (min: number) => (min - first * 60) * PX_PER_MIN

  // À l'ouverture : faire défiler jusqu'à l'heure actuelle (aujourd'hui) ou au premier élément.
  const container = useRef<HTMLDivElement>(null)
  const hasTimed = timed.length > 0
  const firstStart = hasTimed ? Math.min(...timed.map((e) => toMinutes(e.start!))) : 8 * 60
  useLayoutEffect(() => {
    const el = container.current
    const scroller = el?.closest('.content')
    if (!el || !scroller) return
    const target = isToday ? nowMin - 90 : firstStart - 30
    if (target <= first * 60) return
    const offset = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    scroller.scrollTop = offset + top(target) - 8
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTimed])

  return (
    <div ref={container} className="timeline" style={{ height: hours.length * HOUR }}>
      {hours.map((h) => (
        <div key={h} className="hour" style={{ top: (h - first) * HOUR }}>
          <span className="hour-label">{h}:00</span>
        </div>
      ))}
      {isToday && nowMin >= first * 60 && nowMin <= last * 60 && (
        <div className="now-line" style={{ top: top(nowMin) }} />
      )}
      {timed.map((e) => {
        const pos = layout.get(e.id) ?? { col: 0, cols: 1 }
        return (
          <Block
            key={e.id}
            entry={e}
            top={top(toMinutes(e.start!))}
            height={Math.max(24, (toMinutes(e.end!) - toMinutes(e.start!)) * PX_PER_MIN - 2)}
            col={pos.col}
            cols={pos.cols}
            onOpen={onOpen}
            onMove={onMove}
            onToggle={onToggle}
          />
        )
      })}
    </div>
  )
}

function Block({ entry, top, height, col, cols, onOpen, onMove, onToggle }: {
  entry: Entry; top: number; height: number; col: number; cols: number
  onOpen: Props['onOpen']; onMove: Props['onMove']; onToggle: Props['onToggle']
}) {
  const app = useApp()
  const ref = useRef<HTMLDivElement>(null)
  const [dy, setDy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const g = useRef({ startY: 0, timer: 0, moved: false, dragging: false, dy: 0 })

  // Sur iPad, empêcher le défilement de la page pendant qu'on déplace un bloc.
  useEffect(() => {
    const el = ref.current!
    const block = (ev: TouchEvent) => { if (g.current.dragging) ev.preventDefault() }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [])

  const snapMinutes = (px: number) => Math.round(px / PX_PER_MIN / SNAP) * SNAP

  function onPointerDown(ev: React.PointerEvent) {
    if ((ev.target as HTMLElement).closest('.check')) return
    g.current = { startY: ev.clientY, timer: 0, moved: false, dragging: false, dy: 0 }
    const id = ev.pointerId
    g.current.timer = window.setTimeout(() => {
      g.current.dragging = true
      dragState.active = true
      setDragging(true)
      ref.current?.setPointerCapture?.(id)
      navigator.vibrate?.(8)
    }, ev.pointerType === 'mouse' ? 150 : LONG_PRESS)
  }

  function onPointerMove(ev: React.PointerEvent) {
    const d = ev.clientY - g.current.startY
    if (!g.current.dragging) {
      if (Math.abs(d) > 8) { g.current.moved = true; clearTimeout(g.current.timer) }
      return
    }
    g.current.dy = d
    setDy(d)
  }

  function finish(commit: boolean) {
    clearTimeout(g.current.timer)
    const wasDragging = g.current.dragging
    g.current.dragging = false
    setTimeout(() => { dragState.active = false }, 50)
    setDragging(false)
    setDy(0)
    if (wasDragging && commit) {
      const delta = snapMinutes(g.current.dy)
      if (delta !== 0) {
        const len = toMinutes(entry.end!) - toMinutes(entry.start!)
        const start = Math.max(0, Math.min(24 * 60 - len, toMinutes(entry.start!) + delta))
        onMove(entry, fromMinutes(start), fromMinutes(start + len))
      }
    } else if (!wasDragging && !g.current.moved && commit) {
      onOpen(entry)
    }
  }

  const subject = app.subjectById(entry.subjectId)
  const checkable = entry.kind !== 'event' && entry.kind !== 'appointment' && entry.kind !== 'exam'
  const delta = snapMinutes(dy)
  const liveStart = dragging ? fromMinutes(toMinutes(entry.start!) + delta) : entry.start!
  const width = `calc((100% - var(--gutter)) / ${cols} - 4px)`
  const left = `calc(var(--gutter) + (100% - var(--gutter)) / ${cols} * ${col})`

  return (
    <div
      ref={ref}
      className={'block' + (dragging ? ' dragging' : '') + (entry.done ? ' done' : '') + (entry.kind === 'exam' ? ' exam' : '')}
      style={{ top, height, left, width, transform: dragging ? `translateY(${delta * PX_PER_MIN}px)` : undefined, borderLeftColor: subject?.color }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
      onContextMenu={(e) => e.preventDefault()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(entry)}
    >
      {checkable && <Check checked={entry.done} onChange={() => onToggle(entry)} label="Fait" />}
      <div className="block-text">
        <span className="block-title"><Dot subject={subject} />{entry.title}</span>
        {height > 34 && (
          <span className="block-time">
            {dragging ? formatTime(liveStart) : timeRange(entry.start, entry.end)}
            {entry.seriesId ? ' · ↻' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
