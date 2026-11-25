// Lecture "en direct" de la base : les écrans se mettent à jour tout seuls.

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import type { Item, Series, Subject } from '../types'

const EMPTY: never[] = []

export function useSettings() {
  return useLiveQuery(() => db.settings.get('settings'), []) ?? DEFAULT_SETTINGS
}

export function useSubjects(): Subject[] {
  return useLiveQuery(() => db.subjects.toArray(), []) ?? EMPTY
}

export function useSeries(): Series[] {
  return useLiveQuery(() => db.series.toArray(), []) ?? EMPTY
}

export function useItemsBetween(from: string, to: string): Item[] {
  return useLiveQuery(() => db.items.where('date').between(from, to, true, true).toArray(), [from, to]) ?? EMPTY
}

export function useItemsOfKinds(kinds: Item['kind'][]): Item[] {
  return useLiveQuery(() => db.items.where('kind').anyOf(kinds).toArray(), [kinds.join()]) ?? EMPTY
}

export function usePriorities(weekStart: string) {
  return useLiveQuery(() => db.priorities.where('weekStart').equals(weekStart).sortBy('order'), [weekStart]) ?? EMPTY
}
