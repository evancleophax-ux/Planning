// Types partagés par toute l'appli.

export type Kind = 'exam' | 'homework' | 'appointment' | 'task' | 'event' | 'revision'

export const KIND_LABELS: Record<Kind, string> = {
  exam: 'Contrôle',
  homework: 'Devoir',
  appointment: 'Rendez-vous',
  task: 'Tâche',
  event: 'Événement',
  revision: 'Révision',
}

/** Un élément daté (une seule fois). Dates "AAAA-MM-JJ", heures "HH:MM". */
export interface Item {
  id: string
  kind: Kind
  title: string
  subjectId?: string
  date: string
  start?: string
  end?: string
  done: boolean
  /** Séance de révision : id du contrôle concerné. */
  examId?: string
  /** Occurrence modifiée d'une série : id de la série + date d'origine. */
  seriesId?: string
  occurrenceDate?: string
  createdAt: number
}

/** Un élément qui se répète certains jours de la semaine. */
export interface Series {
  id: string
  kind: Kind
  title: string
  subjectId?: string
  /** 0 = dimanche, 1 = lundi … 6 = samedi */
  weekdays: number[]
  start?: string
  end?: string
  startDate: string
  endDate?: string
  /** Dates où l'occurrence est supprimée ou remplacée par un Item. */
  exceptions: string[]
  createdAt: number
}

export interface Priority {
  id: string
  /** Lundi de la semaine concernée. */
  weekStart: string
  text: string
  done: boolean
  order: number
}

export interface Subject {
  id: string
  name: string
  color: string
  /** Autres façons d'écrire la matière (sans accents, en minuscules de préférence). */
  aliases: string[]
}

export interface Settings {
  id: 'settings'
  /** Nombre de jours avant le contrôle pour chaque séance (ex. 7, 4, 2, 1). */
  revisionOffsets: number[]
  revisionDuration: number
  /** Heure à partir de laquelle placer les révisions en semaine / le week-end. */
  studyStartWeekday: string
  studyStartWeekend: string
  dayStart: string
  dayEnd: string
}

/** Ce qu'on affiche dans une journée : un Item réel ou une occurrence de série. */
export interface Entry extends Item {
  /** true si l'entrée vient d'une série et n'existe pas encore comme Item. */
  virtual?: boolean
}
