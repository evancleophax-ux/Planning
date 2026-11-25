// Base de données locale (IndexedDB) via Dexie. Tout reste sur l'appareil.

import Dexie, { type EntityTable } from 'dexie'
import type { Item, Priority, Series, Settings, Subject } from '../types'
import { DEFAULT_SETTINGS, DEFAULT_SUBJECTS } from '../lib/defaults'

class PlanningDB extends Dexie {
  items!: EntityTable<Item, 'id'>
  series!: EntityTable<Series, 'id'>
  priorities!: EntityTable<Priority, 'id'>
  subjects!: EntityTable<Subject, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('planning')
    this.version(1).stores({
      items: 'id, date, kind, examId, seriesId',
      series: 'id',
      priorities: 'id, weekStart',
      subjects: 'id',
      settings: 'id',
    })
    // Premier lancement : matières et réglages par défaut.
    this.on('populate', (tx) => {
      tx.table('subjects').bulkAdd(DEFAULT_SUBJECTS)
      tx.table('settings').add(DEFAULT_SETTINGS)
    })
  }
}

export const db = new PlanningDB()

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2)

/** Demande au navigateur de ne pas effacer les données (important sur iPad). */
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {})
}
