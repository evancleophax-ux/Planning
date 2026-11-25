// Propose des séances de révision avant un contrôle, dans des créneaux libres.

import type { Entry, Settings } from '../types'
import { addDays, fromMinutes, toISO, toMinutes, weekday } from './dates'
import { busyIntervals, type Interval } from './entries'

export interface RevisionProposal {
  date: string
  start: string
  end: string
  /** Nombre de jours avant le contrôle (J-7…). */
  offset: number
  /** true si aucun créneau libre n'a été trouvé (on propose quand même une heure). */
  conflict: boolean
}

const STEP = 15

function isFree(start: number, end: number, busy: Interval[]): boolean {
  return busy.every((b) => end <= b.start || start >= b.end)
}

export function proposeRevisions(
  examDate: string,
  settings: Settings,
  entriesOn: (date: string) => Entry[],
  now = new Date(),
): RevisionProposal[] {
  const today = toISO(now)
  const duration = settings.revisionDuration
  const dayStart = toMinutes(settings.dayStart)
  const dayEnd = toMinutes(settings.dayEnd)
  const offsets = [...new Set(settings.revisionOffsets.filter((n) => n > 0))].sort((a, b) => b - a)
  const proposals: RevisionProposal[] = []

  for (const offset of offsets) {
    const date = addDays(examDate, -offset)
    if (date < today) continue
    const wd = weekday(date)
    const preferred = toMinutes(wd === 0 || wd === 6 ? settings.studyStartWeekend : settings.studyStartWeekday)
    // Aujourd'hui : pas avant maintenant (+ un quart d'heure, arrondi).
    const earliest = date === today
      ? Math.ceil((now.getHours() * 60 + now.getMinutes() + 15) / STEP) * STEP
      : dayStart
    const busy = busyIntervals(entriesOn(date))

    let found: number | undefined
    // D'abord à partir de l'heure préférée, puis plus tôt dans la journée.
    const ranges: [number, number][] = [
      [Math.max(preferred, earliest), dayEnd - duration],
      [earliest, Math.min(preferred, dayEnd) - duration],
    ]
    for (const [from, to] of ranges) {
      for (let t = from; t <= to && found === undefined; t += STEP) {
        if (isFree(t, t + duration, busy)) found = t
      }
      if (found !== undefined) break
    }
    if (found === undefined && earliest + duration > dayEnd) continue // trop tard aujourd'hui
    const start = found ?? Math.max(preferred, earliest)
    proposals.push({
      date,
      start: fromMinutes(start),
      end: fromMinutes(start + duration),
      offset,
      conflict: found === undefined,
    })
  }
  return proposals
}
