// Analyseur de saisie rapide : transforme une phrase en français en élément de planning.
//
// Principe : on travaille sur une version "normalisée" de la phrase (minuscules,
// sans accents, même longueur que l'original). Chaque reconnaisseur (date, heure,
// récurrence…) cherche son motif, note ce qu'il a compris, puis "efface" le
// morceau reconnu. Ce qui reste devient le titre.

import { KIND_LABELS, type Kind, type Subject } from '../types'
import { addDays, addMinutes, addMonths, isValidDate, startOfWeek, toISO, weekday, fromMinutes } from '../lib/dates'

export interface ParseResult {
  kind: Kind
  title: string
  subjectId?: string
  date: string
  start?: string
  end?: string
  /** Durée en minutes si elle a été donnée ("pendant 1h"). */
  duration?: number
  /** Présent si l'élément se répète : jours de la semaine (0 = dimanche). */
  recurrence?: { weekdays: number[]; endDate?: string }
  /** Informations ajoutées par défaut, à signaler dans l'aperçu. */
  defaulted: ('date' | 'heure')[]
}

export interface ParseOptions {
  now?: Date
  subjects?: Subject[]
}

// ---------------------------------------------------------------------------
// Vocabulaire

const WD = '(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)'
const WD_INDEX: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
}

const MONTH = '(janvier|janv|fevrier|fevr|fev|mars|avril|avr|mai|juin|juillet|juil|aout|septembre|sept|octobre|oct|novembre|nov|decembre|dec)\\.?'
const MONTH_INDEX: Record<string, number> = {
  janvier: 1, janv: 1, fevrier: 2, fevr: 2, fev: 2, mars: 3, avril: 4, avr: 4, mai: 5,
  juin: 6, juillet: 7, juil: 7, aout: 8, septembre: 9, sept: 9, octobre: 10, oct: 10,
  novembre: 11, nov: 11, decembre: 12, dec: 12,
}

const NUM = '(\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt)'
const NUM_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8,
  neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20,
}
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUM_WORDS[s] ?? 1)

/** Une heure : 14h, 14h30, 14 h 30, 14:30, 14 heures, midi, minuit. */
const T = '(?:\\b\\d{1,2}\\s*(?:h|heures?|:)\\s*(?:\\d{2}\\b)?|midi|minuit)'
const PM = "(?:\\s*(?:du soir|de l'apres-?midi|de l'aprem))?"

const KIND_PATTERNS: [Kind, RegExp][] = [
  ['revision', /\b(reviser|revisions?|revise)\b/],
  ['exam', /\b(controles?|ds|devoirs? (?:sur table|surveilles?)|examens?|exams?|interros?|interrogations?|partiels?|bac blanc|brevet blanc|evaluations?|evals?|tests?|qcm|colles?|oraux|oral|concours|epreuves?)\b/],
  ['homework', /\b(devoirs?|dm|dms|exposes?|dissertations?|disserts?|redactions?|exercices?|exos?|projets?|tp|commentaires?|fiches? de lecture|a rendre|compte[- ]rendu)\b/],
  ['appointment', /\b(rdv|rendez-?vous|dentiste|medecin|docteur|generaliste|orthodontiste|ortho|kine|kinesitherapeute|ophtalmo(?:logue)?|dermato(?:logue)?|psy|psychologue|osteo(?:pathe)?|gyneco(?:logue)?|orthophoniste|coiffeur|coiffeuse|entretien|reunion|consultation|veterinaire|veto|prise de sang|vaccin)\b/],
  ['event', /\b(sport|cours|entrainements?|match|concert|anniversaire|anniv|soiree|fete|cinema|cine|film|spectacle|dejeuner|diner|repas|brunch|resto|restaurant|piano|guitare|danse|foot|football|basket|hand|handball|volley|tennis|natation|piscine|muscu|musculation|judo|karate|boxe|escalade|theatre|club|repetition|footing|running|yoga|chorale|conservatoire|scouts)\b/],
]

/** Durées par défaut quand on connaît l'heure de début mais pas la fin. */
const DEFAULT_DURATION: Record<Kind, number> = {
  exam: 60, homework: 30, appointment: 60, task: 30, event: 60, revision: 45,
}

const PART_OF_DAY: Record<string, string> = {
  matin: '09:00', matinee: '09:00', midi: '12:00', 'apres-midi': '14:00', apresmidi: '14:00',
  'apres midi': '14:00', aprem: '14:00', soir: '19:00', soiree: '20:00', nuit: '22:00',
}

// ---------------------------------------------------------------------------
// Outils

/** Minuscules et sans accents, en gardant exactement la même longueur. */
export function normalize(s: string): string {
  let out = ''
  for (const ch of s) {
    let c = ch.normalize('NFD')[0].toLowerCase()
    if (c === '’' || c === '‘' || c === '`') c = "'"
    if (c.length !== ch.length) c = c.padEnd(ch.length, ' ').slice(0, ch.length)
    out += c
  }
  return out
}

/** Transforme "14h30", "14 heures", "midi" en "14:30". */
function parseTime(token: string, pm = false): string | undefined {
  const t = token.trim()
  if (t === 'midi') return '12:00'
  if (t === 'minuit') return '00:00'
  const m = /^(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?$/.exec(t)
  if (!m) return undefined
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (pm && h < 12) h += 12
  if (h > 23 || min > 59) return undefined
  return fromMinutes(h * 60 + min)
}

/** Transforme "1h30", "45 min", "2 heures", "une demi-heure" en minutes. */
function parseDuration(token: string): number | undefined {
  const t = token.trim()
  if (/demi-?\s?heure/.test(t)) return 30
  let m = new RegExp(`^${NUM}\\s*(?:h|heures?)\\s*(\\d{1,2})?\\s*(?:min(?:utes?)?)?$`).exec(t)
  if (m) return toNum(m[1]) * 60 + (m[2] ? Number(m[2]) : 0)
  m = new RegExp(`^${NUM}\\s*(?:min|minutes?|mn)$`).exec(t)
  if (m) return toNum(m[1])
  return undefined
}

/** Prochaine date (strictement après aujourd'hui) qui tombe tel jour de la semaine. */
function nextWeekday(today: string, wd: number): string {
  const delta = (wd - weekday(today) + 7) % 7
  return addDays(today, delta === 0 ? 7 : delta)
}

/** Construit une date jour/mois(/année). Sans année : la prochaine fois que ce jour arrive. */
function resolveDayMonth(today: string, d: number, m: number, y?: number): string | undefined {
  const thisYear = Number(today.slice(0, 4))
  if (y !== undefined) {
    if (y < 100) y += 2000
    return isValidDate(y, m, d) ? toISO(new Date(y, m - 1, d)) : undefined
  }
  for (const year of [thisYear, thisYear + 1]) {
    if (!isValidDate(year, m, d)) continue
    const iso = toISO(new Date(year, m - 1, d))
    if (iso >= today) return iso
  }
  return undefined
}

/** "le 12" tout seul : le 12 de ce mois, ou du mois suivant s'il est passé. */
function resolveDayOnly(today: string, d: number): string | undefined {
  const [y, m] = today.split('-').map(Number)
  for (let i = 0; i < 3; i++) {
    const date = new Date(y, m - 1 + i, d)
    if (date.getDate() !== d) continue
    const iso = toISO(date)
    if (iso >= today) return iso
  }
  return undefined
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---------------------------------------------------------------------------
// Analyse

export function parse(input: string, options: ParseOptions = {}): ParseResult {
  const now = options.now ?? new Date()
  const subjects = options.subjects ?? []
  const today = toISO(now)
  const norm = normalize(input)

  // Copie de travail : les morceaux reconnus y sont remplacés par des espaces.
  let work = norm
  const consumed = new Array<boolean>(input.length).fill(false)

  /** Petits mots qu'on avale avec une date ou une heure ("pour", "le", "à"…). */
  const LEADING = /(?:^|\s)(le|la|les|l'|a|au|aux|pour|ce|cette|cet|du|de|des|vers|avant|jusqu'au|jusqu'a|d'ici|en|dans|des le|a partir du|a partir de|dès|des|a compter du)\s*$/

  function consume(start: number, end: number, extendBack = true) {
    if (extendBack) {
      for (let i = 0; i < 3; i++) {
        const m = LEADING.exec(work.slice(0, start))
        if (!m) break
        start = start - m[0].length + (m[0].startsWith(' ') ? 1 : 0)
      }
    }
    for (let i = start; i < end; i++) consumed[i] = true
    work = work.slice(0, start) + ' '.repeat(end - start) + work.slice(end)
  }

  function take(re: RegExp, extendBack = true): RegExpExecArray | null {
    const m = re.exec(work)
    if (m) consume(m.index, m.index + m[0].length, extendBack)
    return m
  }

  let date: string | undefined
  let start: string | undefined
  let end: string | undefined
  let duration: number | undefined
  let hint: string | undefined
  let recurrence: number[] | undefined
  let recurrenceEnd: string | undefined
  let nextWeek = false
  let allDay = false

  // 1. Récurrence -----------------------------------------------------------
  let m: RegExpExecArray | null
  if ((m = take(/\b(?:tous les jours de la semaine|en semaine|du lundi au vendredi)\b/))) {
    recurrence = [1, 2, 3, 4, 5]
  } else if ((m = take(/\b(?:tous les|chaque)\s+(?:week-?ends?|we)\b/))) {
    recurrence = [0, 6]
  } else if ((m = take(/\b(?:tous les jours|chaque jour|quotidiennement|tous les (matins|soirs))\b/))) {
    recurrence = [0, 1, 2, 3, 4, 5, 6]
    if (m[1]) hint = m[1] === 'matins' ? '09:00' : '19:00'
  } else if (
    (m = take(new RegExp(`\\b(?:tous les|toutes les|chaque|les)\\s+${WD}s?((?:\\s*(?:,|et)\\s*(?:les\\s+)?${WD}s?)*)\\b(?:\\s+(matin|soir|apres-midi)s?)?`)))
  ) {
    const days = m[0].match(new RegExp(WD, 'g')) ?? []
    recurrence = [...new Set(days.map((d) => WD_INDEX[d]))].sort((a, b) => a - b)
    if (m[m.length - 1]) hint = PART_OF_DAY[m[m.length - 1]]
  } else if ((m = take(/\b(?:toutes les semaines|chaque semaine|une fois par semaine)\b/))) {
    recurrence = [] // jour choisi plus bas d'après la date
  }

  // 2. Durées ---------------------------------------------------------------
  if ((m = take(new RegExp(`\\b(?:pendant|durant|duree\\s*:?)\\s+(une demi-?\\s?heure|${NUM}\\s*(?:h|heures?)(?:\\s*\\d{1,2})?(?:\\s*min(?:utes?)?)?|${NUM}\\s*(?:min|minutes?|mn))\\b`)))) {
    duration = parseDuration(m[1])
  }

  // 3. Plages horaires : "de 18h à 20h", "18h-20h", "entre 14h et 16h" ------
  if ((m = take(new RegExp(`\\b(?:de|entre)\\s+(${T})\\s*(?:a|-|et|jusqu'a)\\s*(${T})${PM}`)))
    || (m = take(new RegExp(`(${T})\\s*(?:-|a)\\s*(${T})${PM}`)))) {
    const pm = /soir|apres|aprem/.test(m[0].slice(m[0].lastIndexOf(m[2]) + m[2].length))
    start = parseTime(m[1], pm)
    end = parseTime(m[2], pm)
  } else if ((m = take(new RegExp(`\\bde\\s+(\\d{1,2})\\s*(?:a|-)\\s*(${T})`)))) {
    start = parseTime(m[1] + 'h')
    end = parseTime(m[2])
  }

  // 4. "dans 2 heures" -------------------------------------------------------
  if ((m = take(new RegExp(`\\bdans\\s+(une demi-?\\s?heure|${NUM}\\s*(?:h|heures?|min|minutes?))\\b`)))) {
    const mins = parseDuration(m[1].replace(/\s*(h|heures?)$/, 'h'))
    if (mins !== undefined) {
      const total = now.getHours() * 60 + now.getMinutes() + mins
      date = addDays(today, Math.floor(total / 1440))
      start = fromMinutes(Math.round((total % 1440) / 5) * 5)
    }
  }

  // 5. Dates absolues -------------------------------------------------------
  const absNumeric = `(?:${WD}\\s+)?(?:le\\s+)?\\b(\\d{1,2})\\s*[/.-]\\s*(\\d{1,2})(?:\\s*[/.-]\\s*(\\d{4}|\\d{2}))?\\b`
  const absNamed = `(?:${WD}\\s+)?(?:le\\s+)?\\b(\\d{1,2}|1er|premier)\\s+${MONTH}(?:\\s+(\\d{4}))?\\b`
  const absDay = `(?:${WD}\\s+)?\\ble\\s+(\\d{1,2}|1er)\\b(?!\\s*(?:h\\b|h\\d|:|heures?|min|\\/|jours?|semaines?|mois))`

  function absoluteDate(prefix = ''): string | undefined {
    let r: RegExpExecArray | null
    if ((r = take(new RegExp(prefix + absNumeric)))) {
      return resolveDayMonth(today, Number(r[2]), Number(r[3]), r[4] ? Number(r[4]) : undefined)
    }
    if ((r = take(new RegExp(prefix + absNamed)))) {
      const d = /^\d+$/.test(r[2]) ? Number(r[2]) : 1
      return resolveDayMonth(today, d, MONTH_INDEX[r[3]], r[4] ? Number(r[4]) : undefined)
    }
    if ((r = take(new RegExp(prefix + absDay)))) {
      return resolveDayOnly(today, r[2] === '1er' ? 1 : Number(r[2]))
    }
    return undefined
  }

  if (recurrence) recurrenceEnd = absoluteDate("\\bjusqu'(?:au|a)\\s+")
  date ??= absoluteDate()

  // 6. Dates relatives : "dans 3 semaines" ---------------------------------
  if (!date && (m = take(new RegExp(`\\bdans\\s+(?:${NUM}\\s+)?(jours?|semaines?|mois|ans?)\\b`)))) {
    const n = m[1] ? toNum(m[1]) : 1
    const unit = m[2]
    if (unit.startsWith('jour')) date = addDays(today, n)
    else if (unit.startsWith('semaine')) date = addDays(today, n * 7)
    else if (unit === 'mois') date = addMonths(today, n)
    else date = addMonths(today, n * 12)
  }
  if (!date && (m = take(/\b(?:dans|d'ici)\s+(?:une\s+)?quinzaine(?: de jours)?\b/))) date = addDays(today, 14)

  // 7. Semaine prochaine, week-end -------------------------------------------
  if (take(/\b(?:la semaine prochaine|semaine prochaine|la semaine d'apres)\b/)) nextWeek = true
  if (!date && (m = take(/\b(?:ce|le)\s+week-?end(?: prochain)?\b/))) {
    const wd = weekday(today)
    date = wd === 6 || wd === 0 ? today : addDays(today, 6 - wd)
    if (/prochain/.test(m[0])) date = addDays(date, 7)
  }

  // 8. Jours de la semaine ----------------------------------------------------
  if (!date && (m = take(new RegExp(`\\b${WD}(?:\\s+(prochain|qui vient|en huit|d'apres))?\\b`)))) {
    const wd = WD_INDEX[m[1]]
    if (nextWeek) date = addDays(startOfWeek(today), 7 + (wd === 0 ? 6 : wd - 1))
    else date = nextWeekday(today, wd)
    if (m[2] === 'en huit' || m[2] === "d'apres") date = addDays(date, 7)
  }
  if (!date && nextWeek) date = addDays(startOfWeek(today), 7)

  // 9. Aujourd'hui, demain… ---------------------------------------------------
  if (!date && (m = take(/\b(?:ce (matin|soir)|cet (apres-?midi)|cette (aprem|nuit|soiree|matinee))\b/))) {
    date = today
    hint ??= PART_OF_DAY[(m[1] || m[2] || m[3]).replace('apresmidi', 'apres-midi')]
  }
  if (!date && take(/\bapres[- ]demain\b/)) date = addDays(today, 2)
  if (!date && take(/\bdemain\b/)) date = addDays(today, 1)
  if (!date && take(/\baujourd'?\s?hui\b|\bce jour\b/)) date = today
  if (!date && take(/\bavant[- ]hier\b/)) date = addDays(today, -2)
  if (!date && take(/\bhier\b/)) date = addDays(today, -1)

  // 10. Heure seule : "à 14h30", "14h", "midi" ------------------------------
  if (!start && (m = take(new RegExp(`(${T})${PM}`)))) {
    start = parseTime(m[1], m[0].length > m[1].length)
  }

  // 11. Moment de la journée : "le matin", "soir" ----------------------------
  if ((m = take(/\b(?:le |du |dans la |en |au )?(matinee|matin|apres-?midi|apres midi|aprem|soiree|soir|nuit)\b/))) {
    hint ??= PART_OF_DAY[m[1]]
  }
  if (take(/\b(?:toute la journee|journee entiere)\b/)) allDay = true

  // ---------------------------------------------------------------------------
  // Type d'élément (les mots restent dans le titre)
  let kind: Kind = 'task'
  for (const [k, re] of KIND_PATTERNS) {
    if (re.test(norm)) { kind = k; break }
  }
  if (kind === 'task' && (recurrence || (start && end))) kind = 'event'

  // Matière : on cherche le nom ou un synonyme, le plus long d'abord.
  let subjectId: string | undefined
  const candidates = subjects
    .flatMap((s) => [s.name, ...s.aliases].map((a) => ({ id: s.id, alias: normalize(a.trim()) })))
    .filter((c) => c.alias.length > 0)
    .sort((a, b) => b.alias.length - a.alias.length)
  for (const c of candidates) {
    if (new RegExp(`(^|[^a-z0-9])${escapeRe(c.alias)}([^a-z0-9]|$)`).test(norm)) {
      subjectId = c.id
      break
    }
  }

  // ---------------------------------------------------------------------------
  // Valeurs par défaut
  const defaulted: ParseResult['defaulted'] = []
  if (!date) {
    if (recurrence) date = today
    else if (kind === 'exam') { date = addDays(today, 7); defaulted.push('date') }
    else if (kind === 'homework') { date = addDays(today, 1); defaulted.push('date') }
    else date = today
  }
  if (recurrence && recurrence.length === 0) recurrence = [weekday(date)]
  // Une récurrence commence au premier jour concerné.
  if (recurrence && recurrence.length > 0) {
    for (let i = 0; i < 7 && !recurrence.includes(weekday(date)); i++) date = addDays(date, 1)
  }

  if (!start && !allDay && hint) start = hint
  if (!start && !allDay && kind === 'appointment') { start = '09:00'; defaulted.push('heure') }
  if (start && !end) end = addMinutes(start, duration ?? DEFAULT_DURATION[kind])
  if (start && end && end <= start) end = addMinutes(start, duration ?? DEFAULT_DURATION[kind])

  // ---------------------------------------------------------------------------
  // Titre : la phrase d'origine sans les morceaux reconnus.
  let raw = ''
  let rawNorm = ''
  for (let i = 0; i < input.length; i++) {
    raw += consumed[i] ? ' ' : input[i]
    rawNorm += consumed[i] ? ' ' : norm[i]
  }
  const cut = (re: RegExp) => {
    const r = re.exec(rawNorm)
    if (r) {
      raw = raw.slice(0, r.index) + ' '.repeat(r[0].length) + raw.slice(r.index + r[0].length)
      rawNorm = rawNorm.slice(0, r.index) + ' '.repeat(r[0].length) + rawNorm.slice(r.index + r[0].length)
    }
    return !!r
  }
  // Débuts de phrase inutiles.
  cut(/^\s*(?:(?:mon|ma|mes|le|la|les|notre|nos)\s+(?:prof|profs|professeur|professeure)(?:\s+(?:de|d')\s*[a-z-]+)?\s+(?:a|m'a|nous a|ont|nous ont)\s+(?:rajoute|ajoute|mis|donne|prevu|annonce|programme|fixe|planifie|place)\s+|j'ai\s+|j ai\s+|il y a\s+|y a\s+|on a\s+|nous avons\s+|rappel\s*:?\s+|penser a\s+|ne pas oublier (?:de\s+|d')?|faut que je\s+|je dois\s+|il faut\s+|ajouter\s+|ajoute\s+)/)
  cut(/^\s*(?:un|une|des)\s+/)
  // Petits mots restés en fin ou en début.
  const DANGLING = "(?:pour|le|la|les|l'|a|au|aux|de|du|des|d'|ce|cette|cet|et|en|dans|vers|avant|apres|pendant|entre|chez|a partir|jusqu'au|,|-|:|;)"
  while (cut(new RegExp(`(?:^|\\s)${DANGLING}\\s*$`))) { /* on recommence */ }
  while (cut(new RegExp(`^\\s*(?:,|-|:|;)`))) { /* on recommence */ }

  let title = raw.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim()
  title = title.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '')
  if (!title) {
    title = KIND_LABELS[kind]
    const subject = subjects.find((s) => s.id === subjectId)
    if (subject) title += ` de ${subject.name.toLowerCase()}`
  }
  title = title.charAt(0).toUpperCase() + title.slice(1)

  const result: ParseResult = { kind, title, date, defaulted }
  if (subjectId) result.subjectId = subjectId
  if (start) { result.start = start; result.end = end }
  if (duration) result.duration = duration
  if (recurrence) result.recurrence = recurrenceEnd ? { weekdays: recurrence, endDate: recurrenceEnd } : { weekdays: recurrence }
  return result
}
