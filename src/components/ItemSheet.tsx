// Fiche pour créer, corriger, modifier ou supprimer un élément.

import { useState } from 'react'
import { KIND_LABELS, type Kind } from '../types'
import { createFromDraft, deleteEntry, entryToDraft, saveEntry, type Draft, type Scope } from '../db/actions'
import { useSeries, useItemsOfKinds } from '../db/hooks'
import { addDays, addMinutes, formatShort, toMinutes, fromMinutes, todayISO } from '../lib/dates'
import type { EditorTarget } from '../app/context'
import { useApp } from '../app/context'
import { Segmented, Sheet } from './ui'

const KINDS: Kind[] = ['task', 'exam', 'homework', 'appointment', 'event', 'revision']
const DAYS = [1, 2, 3, 4, 5, 6, 0]
const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export function ItemSheet({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const app = useApp()
  const allSeries = useSeries()
  const revisions = useItemsOfKinds(['revision'])
  const entry = target.mode === 'edit' ? target.entry : undefined
  const series = entry?.seriesId ? allSeries.find((s) => s.id === entry.seriesId) : undefined

  const [draft, setDraft] = useState<Draft>(() => (entry ? entryToDraft(entry) : target.mode === 'new' ? target.draft : (undefined as never)))
  const [scope, setScope] = useState<Scope>('one')
  // Les jours de répétition d'une série existante s'affichent quand on modifie "toute la série".
  const weekdays = entry?.seriesId && scope === 'series' && draft.weekdays.length === 0 && series ? series.weekdays : draft.weekdays
  const canRepeat = !entry || !entry.seriesId || scope === 'series'

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  function setStart(start: string) {
    if (!start) return set({ start: undefined, end: undefined })
    const length = draft.start && draft.end ? toMinutes(draft.end) - toMinutes(draft.start) : 60
    set({ start, end: addMinutes(start, length > 0 ? length : 60) })
  }

  function toggleDay(d: number) {
    const next = weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d]
    set({ weekdays: next })
  }

  async function save() {
    const d: Draft = { ...draft, title: draft.title.trim() || KIND_LABELS[draft.kind], weekdays: canRepeat ? weekdays : [] }
    if (d.start && (!d.end || d.end <= d.start)) d.end = addMinutes(d.start, 60)
    if (entry) {
      await saveEntry(entry, d, scope)
      onClose()
      return
    }
    const item = await createFromDraft(d)
    onClose()
    app.toast(d.weekdays.length ? 'Ajouté · se répète' : `Ajouté · ${formatShort(d.date)}`, d.date)
    if (item?.kind === 'exam') app.openRevisions(item)
  }

  async function remove() {
    if (!entry) return
    const what = entry.seriesId && scope === 'series' ? 'toute la série' : 'cet élément'
    const linked = entry.kind === 'exam' ? revisions.filter((r) => r.examId === entry.id).length : 0
    const extra = linked ? ` et ses ${linked} séance(s) de révision` : ''
    if (!confirm(`Supprimer ${what}${extra} ?`)) return
    await deleteEntry(entry, scope)
    onClose()
  }

  async function moveToTomorrow() {
    if (!entry) return
    const date = addDays(entry.date < todayISO() ? todayISO() : entry.date, 1)
    await saveEntry(entry, { ...draft, date, weekdays: [] }, 'one')
    onClose()
    app.toast(`Déplacé au ${formatShort(date)}`, date)
  }

  const linkedRevisions = entry?.kind === 'exam' ? revisions.filter((r) => r.examId === entry.id) : []
  const exam = entry?.kind === 'revision' && entry.examId ? true : false

  return (
    <Sheet onClose={onClose} title={entry ? 'Modifier' : 'Nouvel élément'}>
      <div className="sheet-header">
        <button type="button" className="btn-text" onClick={onClose}>Annuler</button>
        <h2>{entry ? 'Modifier' : 'Nouveau'}</h2>
        <button type="button" className="btn-text strong" onClick={save}>OK</button>
      </div>

      <div className="form">
        <input
          className="title-input"
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Titre"
          aria-label="Titre"
        />

        {entry?.seriesId && (
          <div className="field">
            <span className="field-label">Modifier</span>
            <Segmented<Scope>
              value={scope}
              onChange={setScope}
              options={[{ value: 'one', label: 'Cette fois seulement' }, { value: 'series', label: 'Toute la série' }]}
            />
          </div>
        )}

        <div className="field">
          <span className="field-label">Type</span>
          <div className="chips">
            {KINDS.map((k) => (
              <button key={k} type="button" className={'chip' + (draft.kind === k ? ' active' : '')} onClick={() => set({ kind: k })}>
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Matière</span>
          <div className="chips">
            <button type="button" className={'chip' + (!draft.subjectId ? ' active' : '')} onClick={() => set({ subjectId: undefined })}>
              Aucune
            </button>
            {app.subjects.map((s) => (
              <button key={s.id} type="button" className={'chip' + (draft.subjectId === s.id ? ' active' : '')} onClick={() => set({ subjectId: s.id })}>
                <span className="dot" style={{ background: s.color }} />{s.name || 'Sans nom'}
              </button>
            ))}
          </div>
        </div>

        {!(entry?.seriesId && scope === 'series') && (
          <label className="row-field">
            <span>{weekdays.length ? 'À partir du' : 'Date'}</span>
            <input type="date" value={draft.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
          </label>
        )}

        <label className="row-field">
          <span>Heure</span>
          <span className="time-pair">
            <input type="time" value={draft.start ?? ''} onChange={(e) => setStart(e.target.value)} aria-label="Début" step={300} />
            {draft.start && (
              <>
                <span className="muted">à</span>
                <input type="time" value={draft.end ?? ''} onChange={(e) => set({ end: e.target.value })} aria-label="Fin" step={300} />
              </>
            )}
          </span>
        </label>
        {draft.start && (
          <div className="row-actions">
            <button type="button" className="btn-text" onClick={() => set({ start: undefined, end: undefined })}>Sans heure</button>
            {[30, 45, 60, 90, 120].map((m) => (
              <button key={m} type="button" className="btn-text small" onClick={() => set({ end: fromMinutes(toMinutes(draft.start!) + m) })}>
                {m < 60 ? `${m} min` : m === 90 ? '1 h 30' : `${m / 60} h`}
              </button>
            ))}
          </div>
        )}

        {canRepeat && (
          <div className="field">
            <span className="field-label">Répéter</span>
            <div className="days">
              {DAYS.map((d) => (
                <button key={d} type="button" className={'day' + (weekdays.includes(d) ? ' active' : '')} onClick={() => toggleDay(d)} aria-pressed={weekdays.includes(d)}>
                  {DAY_LETTERS[d]}
                </button>
              ))}
            </div>
            {weekdays.length > 0 && (
              <label className="row-field">
                <span>Jusqu'au</span>
                <input type="date" value={draft.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value || undefined })} />
              </label>
            )}
          </div>
        )}

        {entry?.kind === 'exam' && (
          <div className="field">
            <span className="field-label">Révisions</span>
            <p className="muted">
              {linkedRevisions.length
                ? `${linkedRevisions.length} séance(s) : ` + linkedRevisions.sort((a, b) => a.date.localeCompare(b.date)).map((r) => formatShort(r.date)).join(', ')
                : 'Aucune séance prévue.'}
            </p>
            <button type="button" className="btn-secondary" onClick={() => { onClose(); app.openRevisions(entry) }}>
              Planifier des révisions
            </button>
          </div>
        )}
        {exam && <p className="muted small">Séance liée à un contrôle.</p>}
      </div>

      {entry && (
        <div className="sheet-footer">
          <button type="button" className="btn-danger" onClick={remove}>Supprimer</button>
          <button type="button" className="btn-secondary" onClick={moveToTomorrow}>Reporter à demain</button>
        </div>
      )}
      {!entry && (
        <div className="sheet-footer">
          <button type="button" className="btn-primary wide" onClick={save}>Ajouter</button>
        </div>
      )}
    </Sheet>
  )
}
