// Toutes les opérations qui modifient les données.

import { db, newId } from './db'
import type { Entry, Item, Kind, Priority, Series, Settings, Subject } from '../types'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import { makeBackup, type Backup } from '../lib/backup'
import type { RevisionProposal } from '../lib/revisions'

/** Ce que l'éditeur manipule (nouvel élément ou modification). */
export interface Draft {
  kind: Kind
  title: string
  subjectId?: string
  date: string
  start?: string
  end?: string
  done?: boolean
  /** Jours de répétition ; vide = pas de répétition. */
  weekdays: number[]
  endDate?: string
}

export type Scope = 'one' | 'series'

const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T

// ---------------------------------------------------------------------------
// Création

/** Crée un élément ou une série. Renvoie l'élément créé (undefined pour une série). */
export async function createFromDraft(d: Draft): Promise<Item | undefined> {
  if (d.weekdays.length > 0) {
    const s: Series = clean({
      id: newId(), kind: d.kind, title: d.title, subjectId: d.subjectId, weekdays: d.weekdays,
      start: d.start, end: d.start ? d.end : undefined, startDate: d.date, endDate: d.endDate,
      exceptions: [], createdAt: Date.now(),
    })
    await db.series.add(s)
    return undefined
  }
  const item: Item = clean({
    id: newId(), kind: d.kind, title: d.title, subjectId: d.subjectId, date: d.date,
    start: d.start, end: d.start ? d.end : undefined, done: false, createdAt: Date.now(),
  })
  await db.items.add(item)
  return item
}

// ---------------------------------------------------------------------------
// Modification

function itemFields(d: Draft) {
  return {
    kind: d.kind, title: d.title, subjectId: d.subjectId || undefined, date: d.date,
    start: d.start || undefined, end: d.start ? d.end || undefined : undefined, done: d.done ?? false,
  }
}

/** Remplace complètement un élément (les champs vidés disparaissent). */
async function putItem(id: string, base: Partial<Item>, d: Draft) {
  const existing = await db.items.get(id)
  await db.items.put(clean({ ...existing, ...base, ...itemFields(d), id, createdAt: existing?.createdAt ?? Date.now() }) as Item)
}

/** Détache une occurrence de sa série : elle devient un élément indépendant. */
async function detach(entry: Entry, d: Draft) {
  const s = await db.series.get(entry.seriesId!)
  if (!s) return
  const date = entry.occurrenceDate ?? entry.date
  await db.transaction('rw', db.series, db.items, async () => {
    await db.series.update(s.id, { exceptions: [...new Set([...s.exceptions, date])] })
    await putItem(newId(), { seriesId: s.id, occurrenceDate: date }, d)
  })
}

export async function saveEntry(entry: Entry, d: Draft, scope: Scope) {
  if (entry.seriesId && scope === 'series') {
    const s = await db.series.get(entry.seriesId)
    if (!s) return
    const weekdays = d.weekdays.length ? d.weekdays : s.weekdays
    await db.series.put(clean({
      ...s, kind: d.kind, title: d.title, subjectId: d.subjectId || undefined, weekdays,
      start: d.start || undefined, end: d.start ? d.end || undefined : undefined, endDate: d.endDate,
    }) as Series)
    // L'occurrence modifiée à part suit aussi la série pour le titre et le type.
    if (!entry.virtual) await db.items.update(entry.id, { title: d.title, kind: d.kind, subjectId: d.subjectId })
    return
  }
  if (entry.virtual) return detach(entry, d)
  // Un élément simple qu'on veut maintenant répéter : il devient une série.
  if (!entry.seriesId && d.weekdays.length > 0) {
    await db.transaction('rw', db.items, db.series, async () => {
      await db.items.delete(entry.id)
      await createFromDraft(d)
    })
    return
  }
  await putItem(entry.id, {}, d)
}

/** Déplace une entrée (glisser-déposer, "demain"). Une occurrence de série est détachée. */
export async function moveEntry(entry: Entry, patch: { date?: string; start?: string; end?: string }) {
  if (entry.virtual) {
    return detach(entry, { ...entryToDraft(entry), ...patch, weekdays: [] })
  }
  await db.items.update(entry.id, patch)
}

export async function toggleDone(entry: Entry) {
  if (entry.virtual) return detach(entry, { ...entryToDraft(entry), done: true, weekdays: [] })
  await db.items.update(entry.id, { done: !entry.done })
}

export async function deleteEntry(entry: Entry, scope: Scope) {
  if (entry.seriesId && scope === 'series') {
    await db.transaction('rw', db.series, db.items, async () => {
      await db.series.delete(entry.seriesId!)
      await db.items.where('seriesId').equals(entry.seriesId!).delete()
    })
    return
  }
  if (entry.virtual) {
    const s = await db.series.get(entry.seriesId!)
    if (s) await db.series.update(s.id, { exceptions: [...s.exceptions, entry.date] })
    return
  }
  await db.transaction('rw', db.items, async () => {
    await db.items.delete(entry.id)
    // Supprimer un contrôle supprime aussi ses séances de révision.
    if (entry.kind === 'exam') await db.items.where('examId').equals(entry.id).delete()
  })
}

export function entryToDraft(e: Entry, series?: Series): Draft {
  return {
    kind: e.kind, title: e.title, subjectId: e.subjectId, date: e.date, start: e.start, end: e.end,
    done: e.done, weekdays: series ? series.weekdays : [], endDate: series?.endDate,
  }
}

// ---------------------------------------------------------------------------
// Révisions

export async function addRevisions(exam: Item, sessions: RevisionProposal[], subjectName?: string) {
  const label = subjectName ? `Réviser ${subjectName.toLowerCase()}` : `Réviser : ${exam.title}`
  await db.items.bulkAdd(sessions.map((s, i) => ({
    id: newId(), kind: 'revision' as const, title: label, subjectId: exam.subjectId, date: s.date,
    start: s.start, end: s.end, done: false, examId: exam.id, createdAt: Date.now() + i,
  })))
}

// ---------------------------------------------------------------------------
// Priorités

export async function addPriority(weekStart: string, text: string) {
  const count = await db.priorities.where('weekStart').equals(weekStart).count()
  await db.priorities.add({ id: newId(), weekStart, text, done: false, order: count })
}

export const updatePriority = (id: string, patch: Partial<Priority>) => db.priorities.update(id, patch)
export const deletePriority = (id: string) => db.priorities.delete(id)

export async function reorderPriorities(list: Priority[]) {
  await db.transaction('rw', db.priorities, async () => {
    await Promise.all(list.map((p, i) => db.priorities.update(p.id, { order: i })))
  })
}

/** Reporte les priorités non terminées d'une semaine sur une autre. */
export async function carryOverPriorities(from: string, to: string) {
  const old = await db.priorities.where('weekStart').equals(from).sortBy('order')
  const existing = await db.priorities.where('weekStart').equals(to).count()
  const todo = old.filter((p) => !p.done).slice(0, Math.max(0, 5 - existing))
  await db.priorities.bulkAdd(todo.map((p, i) => ({ ...p, id: newId(), weekStart: to, order: existing + i })))
}

// ---------------------------------------------------------------------------
// Matières et réglages

export const saveSubject = (s: Subject) => db.subjects.put(s)
export const deleteSubject = (id: string) => db.subjects.delete(id)
export async function addSubject(color: string) {
  const s: Subject = { id: newId(), name: '', color, aliases: [] }
  await db.subjects.add(s)
  return s
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
  await db.settings.put({ ...current, ...patch, id: 'settings' })
}

// ---------------------------------------------------------------------------
// Sauvegarde

export async function exportAll(): Promise<Backup> {
  const [items, series, priorities, subjects, settings] = await Promise.all([
    db.items.toArray(), db.series.toArray(), db.priorities.toArray(), db.subjects.toArray(), db.settings.toArray(),
  ])
  return makeBackup({ items, series, priorities, subjects, settings })
}

export async function importAll(b: Backup) {
  await db.transaction('rw', [db.items, db.series, db.priorities, db.subjects, db.settings], async () => {
    await Promise.all([db.items.clear(), db.series.clear(), db.priorities.clear(), db.subjects.clear(), db.settings.clear()])
    await db.items.bulkAdd(b.items)
    await db.series.bulkAdd(b.series)
    await db.priorities.bulkAdd(b.priorities)
    await db.subjects.bulkAdd(b.subjects)
    await db.settings.bulkAdd(b.settings.length ? b.settings : [DEFAULT_SETTINGS])
  })
}
