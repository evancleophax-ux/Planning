import type { Settings, Subject } from '../types'

/** Couleurs douces pour les pastilles de matière (lisibles en clair et en sombre). */
export const SUBJECT_COLORS = [
  '#FF6B6B', '#FF9F43', '#F7C948', '#4CC38A', '#2EC4B6',
  '#4DA3FF', '#7C6CF2', '#C56CF0', '#F368A9', '#8E9AAF',
]

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'maths', name: 'Maths', color: '#4DA3FF', aliases: ['math', 'mathematiques', 'mathématiques'] },
  { id: 'physique', name: 'Physique-chimie', color: '#7C6CF2', aliases: ['physique', 'chimie', 'pc', 'physique chimie'] },
  { id: 'ses', name: 'SES', color: '#FF9F43', aliases: ['eco', 'économie', 'economie', 'sciences economiques'] },
  { id: 'francais', name: 'Français', color: '#FF6B6B', aliases: ['francais', 'franc'] },
  { id: 'hggsp', name: 'HGGSP', color: '#F7C948', aliases: ['geopolitique', 'géopolitique'] },
  { id: 'anglais', name: 'Anglais', color: '#2EC4B6', aliases: ['english', 'ang'] },
  { id: 'espagnol', name: 'Espagnol', color: '#F368A9', aliases: ['esp'] },
  { id: 'histoire', name: 'Histoire-géo', color: '#C56CF0', aliases: ['histoire', 'geo', 'géo', 'hg', 'histoire geo', 'histoire-geographie'] },
  { id: 'philo', name: 'Philo', color: '#8E9AAF', aliases: ['philosophie'] },
  { id: 'svt', name: 'SVT', color: '#4CC38A', aliases: ['bio', 'biologie'] },
]

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  revisionOffsets: [7, 4, 2, 1],
  revisionDuration: 45,
  studyStartWeekday: '17:30',
  studyStartWeekend: '10:00',
  dayStart: '07:00',
  dayEnd: '23:00',
}
