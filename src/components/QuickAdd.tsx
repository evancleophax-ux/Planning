// Le champ de saisie rapide, toujours en haut de l'écran.

import { useMemo, useState } from 'react'
import { parse, type ParseResult } from '../parser/parse'
import { createFromDraft, type Draft } from '../db/actions'
import { describe } from '../lib/describe'
import { formatShort } from '../lib/dates'
import { useApp } from '../app/context'
import { Dot } from './ui'

export function resultToDraft(r: ParseResult): Draft {
  return {
    kind: r.kind, title: r.title, subjectId: r.subjectId, date: r.date, start: r.start, end: r.end,
    weekdays: r.recurrence?.weekdays ?? [], endDate: r.recurrence?.endDate,
  }
}

export function QuickAdd() {
  const app = useApp()
  const [text, setText] = useState('')
  const result = useMemo(
    () => (text.trim() ? parse(text, { subjects: app.subjects }) : null),
    [text, app.subjects],
  )

  async function add() {
    if (!result) return
    const draft = resultToDraft(result)
    const item = await createFromDraft(draft)
    setText('')
    app.toast(draft.weekdays.length ? 'Ajouté · se répète' : `Ajouté · ${formatShort(draft.date)}`, draft.date)
    if (item?.kind === 'exam') app.openRevisions(item)
  }

  function edit() {
    if (!result) return
    app.openEditor({ mode: 'new', draft: resultToDraft(result) })
    setText('')
  }

  const subject = app.subjectById(result?.subjectId)
  const draft = result && resultToDraft(result)
  const missing = result?.defaulted.map((d) => (d === 'heure' ? 'heure par défaut' : 'date par défaut')).join(', ')

  return (
    <div className="quickadd">
      <form
        className="quickadd-row"
        onSubmit={(e) => { e.preventDefault(); add() }}
      >
        <input
          className="quickadd-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ajouter… ex. « DS de maths le 12/12 à 10h »"
          enterKeyHint="done"
          autoCapitalize="sentences"
          aria-label="Saisie rapide"
        />
        {result && <button type="submit" className="btn-primary">Ajouter</button>}
      </form>
      {result && draft && (
        <div className="preview">
          <button type="button" className="preview-text" onClick={edit} aria-label="Corriger">
            <Dot subject={subject} />
            <strong>{result.title}</strong>
            <span className="muted"> · {describe(draft, subject).join(' · ')}</span>
            {missing && <span className="muted small"> ({missing})</span>}
          </button>
          <button type="button" className="btn-text" onClick={edit}>Corriger</button>
        </div>
      )}
    </div>
  )
}
