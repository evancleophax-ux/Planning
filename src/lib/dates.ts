// Petites fonctions de dates, toujours en heure locale.
// Une date est une chaîne "AAAA-MM-JJ", une heure une chaîne "HH:MM".

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(now = new Date()): string {
  return toISO(now)
}

export function addDays(s: string, n: number): string {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function addMonths(s: string, n: number): string {
  const d = fromISO(s)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toISO(d)
}

/** 0 = dimanche … 6 = samedi */
export function weekday(s: string): number {
  return fromISO(s).getDay()
}

/** Lundi de la semaine contenant la date. */
export function startOfWeek(s: string): string {
  const wd = weekday(s)
  return addDays(s, wd === 0 ? -6 : 1 - wd)
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86400000)
}

export function isValidDate(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(min: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)))
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export function addMinutes(t: string, n: number): string {
  return fromMinutes(toMinutes(t) + n)
}

export function formatTime(t: string): string {
  const [h, m] = t.split(':')
  return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`
}

const fmtShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtDayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/** "mar. 16 déc." */
export function formatShort(s: string): string {
  return fmtShort.format(fromISO(s))
}

/** "Mardi 16 décembre" */
export function formatLong(s: string): string {
  const t = fmtLong.format(fromISO(s))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function formatDayMonth(s: string): string {
  return fmtDayMonth.format(fromISO(s))
}

export const WEEKDAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
export const WEEKDAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

/** "aujourd'hui", "demain", "dans 12 jours", "hier", "il y a 3 jours" */
export function countdown(date: string, today: string): string {
  const n = diffDays(date, today)
  if (n === 0) return "aujourd'hui"
  if (n === 1) return 'demain'
  if (n === -1) return 'hier'
  if (n > 0) return `dans ${n} jours`
  return `il y a ${-n} jours`
}
