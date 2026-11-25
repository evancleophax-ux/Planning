// Propose des séances de révision pour un contrôle : on garde, on modifie ou on refuse.

import { useEffect, useState } from 'react'
import type { Item } from '../types'
import { db } from '../db/db'
import { addRevisions } from '../db/actions'
import { entriesForDate } from '../lib/entries'
import { proposeRevisions, type RevisionProposal } from '../lib/revisions'
import { addMinutes, formatShort, todayISO } from '../lib/dates'
import { useApp } from '../app/context'
import { Check, Sheet } from './ui'

interface Row extends RevisionProposal { keep: boolean }

export function RevisionSheet({ exam, onClose }: { exam: Item; onClose: () => void }) {
  const app = useApp()
  const [rows, setRows] = useState<Row[] | null>(null)
  const subject = app.subjectById(exam.subjectId)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [items, series] = await Promise.all([
        db.items.where('date').between(todayISO(), exam.date, true, true).toArray(),
        db.series.toArray(),
      ])
      const proposals = proposeRevisions(exam.date, app.settings, (d) => entriesForDate(items, series, d))
      if (alive) setRows(proposals.map((p) => ({ ...p, keep: true })))
    })()
    return () => { alive = false }
  }, [exam, app.settings])

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r!.map((row, j) => (i === j ? { ...row, ...patch } : row)))
  const kept = rows?.filter((r) => r.keep) ?? []

  async function accept() {
    await addRevisions(exam, kept, subject?.name)
    onClose()
    app.toast(`${kept.length} séance(s) de révision ajoutée(s)`)
  }

  return (
    <Sheet onClose={onClose} title="Révisions">
      <div className="sheet-header">
        <span />
        <h2>Révisions</h2>
        <span />
      </div>
      <div className="form">
        <p className="lead">
          {exam.title} · {formatShort(exam.date)}
          <br />
          <span className="muted">Je te propose ces séances dans tes créneaux libres.</span>
        </p>

        {rows && rows.length === 0 && <p className="muted">Le contrôle est trop proche pour planifier des séances.</p>}

        <ul className="list">
          {rows?.map((r, i) => (
            <li key={i} className={'list-row' + (r.keep ? '' : ' dimmed')}>
              <Check checked={r.keep} onChange={() => update(i, { keep: !r.keep })} label={`Garder J-${r.offset}`} />
              <span className="rev-label">J-{r.offset}</span>
              <input type="date" value={r.date} max={exam.date} onChange={(e) => e.target.value && update(i, { date: e.target.value, conflict: false })} aria-label="Date" />
              <input
                type="time"
                value={r.start}
                step={300}
                onChange={(e) => e.target.value && update(i, { start: e.target.value, end: addMinutes(e.target.value, app.settings.revisionDuration), conflict: false })}
                aria-label="Heure"
              />
              {r.conflict && <span className="small warn">créneau chargé</span>}
            </li>
          ))}
        </ul>
        <p className="muted small">{app.settings.revisionDuration} min par séance · modifiable dans les Paramètres.</p>
      </div>
      <div className="sheet-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Non merci</button>
        <button type="button" className="btn-primary" disabled={!kept.length} onClick={accept}>
          Ajouter {kept.length || ''} séance{kept.length > 1 ? 's' : ''}
        </button>
      </div>
    </Sheet>
  )
}
