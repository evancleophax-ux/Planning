// Calcule ce qui est prévu un jour donné : les éléments simples + les occurrences des séries.

import type { Entry, Item, Series } from '../types'
import { addDays, toMinutes, weekday } from './dates'

export function occursOn(s: Series, date: string): boolean {
  return (
    date >= s.startDate &&
    (!s.endDate || date <= s.endDate) &&
    s.weekdays.includes(weekday(date)) &&
    !s.exceptions.includes(date)
  )
}

/** Occurrence "virtuelle" d'une série : elle n'existe pas en base tant qu'on ne la modifie pas. */
export function virtualEntry(s: Series, date: string): Entry {
  return {
    id: `${s.id}@${date}`,
    kind: s.kind,
    title: s.title,
    subjectId: s.subjectId,
    date,
    start: s.start,
    end: s.end,
    done: false,
    seriesId: s.id,
    occurrenceDate: date,
    createdAt: s.createdAt,
    virtual: true,
  }
}

export function sortEntries(list: Entry[]): Entry[] {
  return [...list].sort((a, b) => {
    if (a.start && b.start) return a.start.localeCompare(b.start)
    if (a.start) return -1
    if (b.start) return 1
    return a.createdAt - b.createdAt
  })
}

export function entriesForDate(items: Item[], series: Series[], date: string): Entry[] {
  const list: Entry[] = items.filter((i) => i.date === date)
  for (const s of series) if (occursOn(s, date)) list.push(virtualEntry(s, date))
  return sortEntries(list)
}

/** Toutes les entrées de `from` à `to` inclus, rangées par date. */
export function entriesForRange(items: Item[], series: Series[], from: string, to: string): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>()
  for (let d = from; d <= to; d = addDays(d, 1)) map.set(d, entriesForDate(items, series, d))
  return map
}

export interface Interval { start: number; end: number }

/** Créneaux occupés (en minutes depuis minuit). */
export function busyIntervals(entries: Entry[]): Interval[] {
  return entries
    .filter((e) => e.start && e.end)
    .map((e) => ({ start: toMinutes(e.start!), end: toMinutes(e.end!) }))
}

/**
 * Place les blocs horaires d'une journée en colonnes quand ils se chevauchent.
 * Renvoie pour chaque entrée sa colonne et le nombre de colonnes de son groupe.
 */
export function layoutColumns(entries: Entry[]): Map<string, { col: number; cols: number }> {
  const timed = entries
    .filter((e) => e.start && e.end)
    .sort((a, b) => a.start!.localeCompare(b.start!) || b.end!.localeCompare(a.end!))
  const result = new Map<string, { col: number; cols: number }>()
  let group: { id: string; col: number }[] = []
  let colEnds: string[] = []
  let groupEnd = ''
  const flush = () => {
    for (const g of group) result.set(g.id, { col: g.col, cols: colEnds.length })
    group = []
    colEnds = []
  }
  for (const e of timed) {
    if (group.length && e.start! >= groupEnd) flush()
    let col = colEnds.findIndex((end) => end <= e.start!)
    if (col === -1) { col = colEnds.length; colEnds.push(e.end!) } else colEnds[col] = e.end!
    group.push({ id: e.id, col })
    groupEnd = group.length === 1 ? e.end! : (e.end! > groupEnd ? e.end! : groupEnd)
  }
  flush()
  return result
}
