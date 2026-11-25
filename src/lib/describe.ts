// Petit résumé lisible d'un élément : "Contrôle · Physique-chimie · mer. 16 déc. · 10 h – 11 h"

import { KIND_LABELS, type Kind, type Subject } from '../types'
import { formatShort, formatTime, WEEKDAY_SHORT } from './dates'

export function describeWeekdays(days: number[]): string {
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) // lundi d'abord
  if (sorted.length === 7) return 'Chaque jour'
  if (sorted.join() === '1,2,3,4,5') return 'En semaine'
  if (sorted.join() === '6,0') return 'Le week-end'
  return 'Chaque ' + sorted.map((d) => WEEKDAY_SHORT[d].toLowerCase() + '.').join(', ')
}

export function timeRange(start?: string, end?: string): string {
  if (!start) return ''
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start)
}

export function describe(
  d: { kind: Kind; subjectId?: string; date: string; start?: string; end?: string; weekdays?: number[] },
  subject?: Subject,
): string[] {
  const parts: string[] = [KIND_LABELS[d.kind]]
  if (subject) parts.push(subject.name)
  if (d.weekdays?.length) parts.push(describeWeekdays(d.weekdays))
  else parts.push(formatShort(d.date))
  if (d.start) parts.push(timeRange(d.start, d.end))
  return parts
}
