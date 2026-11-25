import { describe, expect, it } from 'vitest'
import type { Entry, Item, Series } from '../types'
import { DEFAULT_SETTINGS } from './defaults'
import { entriesForDate, layoutColumns, occursOn } from './entries'
import { proposeRevisions } from './revisions'
import { makeBackup, readBackup } from './backup'
import { countdown, startOfWeek } from './dates'

const item = (over: Partial<Item>): Item => ({
  id: Math.random().toString(36), kind: 'task', title: 'x', date: '2026-11-25', done: false, createdAt: 0, ...over,
})

const sport: Series = {
  id: 's1', kind: 'event', title: 'Sport', weekdays: [1, 4], start: '18:00', end: '20:00',
  startDate: '2026-11-26', exceptions: ['2026-12-03'], createdAt: 0,
}

describe('dates', () => {
  it('début de semaine = lundi', () => {
    expect(startOfWeek('2026-11-25')).toBe('2026-11-23')
    expect(startOfWeek('2026-11-29')).toBe('2026-11-23') // dimanche
    expect(startOfWeek('2026-11-30')).toBe('2026-11-30')
  })
  it('compte à rebours', () => {
    expect(countdown('2026-12-07', '2026-11-25')).toBe('dans 12 jours')
    expect(countdown('2026-11-26', '2026-11-25')).toBe('demain')
    expect(countdown('2026-11-25', '2026-11-25')).toBe("aujourd'hui")
  })
})

describe('séries', () => {
  it('se répète les bons jours, sauf exceptions', () => {
    expect(occursOn(sport, '2026-11-26')).toBe(true) // jeudi
    expect(occursOn(sport, '2026-11-30')).toBe(true) // lundi
    expect(occursOn(sport, '2026-11-27')).toBe(false) // vendredi
    expect(occursOn(sport, '2026-12-03')).toBe(false) // exception
    expect(occursOn(sport, '2026-11-23')).toBe(false) // avant le début
  })

  it('mélange éléments et occurrences, triés par heure', () => {
    const list = entriesForDate(
      [item({ date: '2026-11-30', start: '09:00', end: '10:00', title: 'A' }), item({ date: '2026-11-30', title: 'B' })],
      [sport], '2026-11-30',
    )
    expect(list.map((e) => e.title)).toEqual(['A', 'Sport', 'B'])
    expect(list[1].virtual).toBe(true)
  })
})

describe('colonnes de la frise', () => {
  it('met côte à côte ce qui se chevauche', () => {
    const e = (id: string, start: string, end: string) => item({ id, start, end }) as Entry
    const layout = layoutColumns([e('a', '09:00', '11:00'), e('b', '10:00', '11:00'), e('c', '12:00', '13:00')])
    expect(layout.get('a')).toEqual({ col: 0, cols: 2 })
    expect(layout.get('b')).toEqual({ col: 1, cols: 2 })
    expect(layout.get('c')).toEqual({ col: 0, cols: 1 })
  })
})

describe('révisions', () => {
  const now = new Date(2026, 10, 25, 10, 0) // mercredi 25 nov.

  it('propose J-7, J-4, J-2, J-1 aux heures préférées', () => {
    const r = proposeRevisions('2026-12-16', DEFAULT_SETTINGS, () => [], now)
    expect(r.map((x) => [x.date, x.start, x.end])).toEqual([
      ['2026-12-09', '17:30', '18:15'], // mercredi
      ['2026-12-12', '10:00', '10:45'], // samedi
      ['2026-12-14', '17:30', '18:15'],
      ['2026-12-15', '17:30', '18:15'],
    ])
    expect(r.every((x) => !x.conflict)).toBe(true)
  })

  it('évite les créneaux occupés', () => {
    const busy = (d: string): Entry[] => (d === '2026-12-14' ? [item({ date: d, start: '17:00', end: '19:00' })] : [])
    const r = proposeRevisions('2026-12-16', DEFAULT_SETTINGS, busy, now)
    expect(r.find((x) => x.date === '2026-12-14')?.start).toBe('19:00')
  })

  it('ignore les jours déjà passés', () => {
    const r = proposeRevisions('2026-11-28', DEFAULT_SETTINGS, () => [], now)
    expect(r.map((x) => x.offset)).toEqual([2, 1])
  })

  it("aujourd'hui, ne propose pas une heure déjà passée", () => {
    const late = new Date(2026, 10, 25, 18, 10)
    const r = proposeRevisions('2026-11-26', DEFAULT_SETTINGS, () => [], late)
    expect(r[0]).toMatchObject({ date: '2026-11-25', start: '18:30' })
  })

  it('respecte les réglages (nombre et durée)', () => {
    const r = proposeRevisions('2026-12-16', { ...DEFAULT_SETTINGS, revisionOffsets: [3, 1], revisionDuration: 90 }, () => [], now)
    expect(r.map((x) => [x.date, x.start, x.end])).toEqual([
      ['2026-12-13', '10:00', '11:30'],
      ['2026-12-15', '17:30', '19:00'],
    ])
  })

  it('signale un conflit si la journée est pleine', () => {
    const full = (d: string): Entry[] => [item({ date: d, start: '07:00', end: '23:00' })]
    const r = proposeRevisions('2026-12-16', DEFAULT_SETTINGS, full, now)
    expect(r.every((x) => x.conflict)).toBe(true)
  })
})

describe('sauvegarde', () => {
  it('relit ce qu’elle a écrit', () => {
    const b = makeBackup({ items: [item({})], series: [sport], priorities: [], subjects: [], settings: [DEFAULT_SETTINGS] })
    expect(readBackup(JSON.stringify(b)).items).toHaveLength(1)
  })
  it('refuse un mauvais fichier', () => {
    expect(() => readBackup('pas du json')).toThrow(/JSON/)
    expect(() => readBackup('{"a":1}')).toThrow(/sauvegarde/)
  })
})
