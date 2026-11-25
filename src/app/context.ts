import { createContext, useContext } from 'react'
import type { Entry, Item, Settings, Subject } from '../types'
import type { Draft } from '../db/actions'

export type EditorTarget = { mode: 'new'; draft: Draft } | { mode: 'edit'; entry: Entry }

export interface AppApi {
  subjects: Subject[]
  subjectById: (id?: string) => Subject | undefined
  settings: Settings
  openEditor: (target: EditorTarget) => void
  openRevisions: (exam: Item) => void
  goToDay: (date: string) => void
  toast: (text: string, date?: string) => void
}

export const AppContext = createContext<AppApi | null>(null)

export function useApp(): AppApi {
  const api = useContext(AppContext)
  if (!api) throw new Error('AppContext manquant')
  return api
}
