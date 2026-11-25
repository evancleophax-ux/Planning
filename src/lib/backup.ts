// Sauvegarde : tout le contenu de la base dans un fichier JSON, et l'inverse.

import type { Item, Priority, Series, Settings, Subject } from '../types'

export interface Backup {
  app: 'planning'
  version: 1
  exportedAt: string
  items: Item[]
  series: Series[]
  priorities: Priority[]
  subjects: Subject[]
  settings: Settings[]
}

export function makeBackup(data: Omit<Backup, 'app' | 'version' | 'exportedAt'>, now = new Date()): Backup {
  return { app: 'planning', version: 1, exportedAt: now.toISOString(), ...data }
}

/** Vérifie qu'un fichier importé est bien une sauvegarde de l'appli. Lève une erreur sinon. */
export function readBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("Ce fichier n'est pas un fichier JSON valide.")
  }
  const b = data as Partial<Backup>
  if (!b || b.app !== 'planning' || b.version !== 1) {
    throw new Error("Ce fichier n'est pas une sauvegarde de Planning.")
  }
  for (const key of ['items', 'series', 'priorities', 'subjects', 'settings'] as const) {
    if (!Array.isArray(b[key])) throw new Error(`Sauvegarde incomplète (« ${key} » manquant).`)
  }
  return b as Backup
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `planning-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}
