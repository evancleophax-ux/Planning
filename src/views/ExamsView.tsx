// Vue « Contrôles & devoirs » : tout ce qui arrive, avec un compte à rebours.

import { useState } from 'react'
import { KIND_LABELS, type Item } from '../types'
import { useItemsOfKinds } from '../db/hooks'
import { toggleDone } from '../db/actions'
import { countdown, diffDays, formatShort, todayISO } from '../lib/dates'
import { useApp } from '../app/context'
import { Check, Dot, Segmented } from '../components/ui'

type Filter = 'upcoming' | 'past'
const KINDS: Item['kind'][] = ['exam', 'homework', 'revision']

export function ExamsView() {
  const app = useApp()
  const all = useItemsOfKinds(KINDS)
  const [filter, setFilter] = useState<Filter>('upcoming')
  const today = todayISO()

  const revisionsOf = (id: string) => all.filter((r) => r.kind === 'revision' && r.examId === id)
  const list = all
    .filter((i) => i.kind !== 'revision')
    .filter((i) => (filter === 'upcoming' ? i.date >= today : i.date < today))
    .sort((a, b) => (filter === 'upcoming' ? 1 : -1) * (a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '')))

  return (
    <div className="view">
      <header className="view-header">
        <div>
          <h1>Contrôles & devoirs</h1>
          <p className="muted">{filter === 'upcoming' ? `${list.length} à venir` : `${list.length} archivé${list.length > 1 ? 's' : ''}`}</p>
        </div>
      </header>
      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[{ value: 'upcoming', label: 'À venir' }, { value: 'past', label: 'Archives' }]}
      />
      {list.length === 0 && (
        <p className="muted empty">
          {filter === 'upcoming' ? 'Aucun contrôle ni devoir à venir. Écris par exemple « contrôle de physique dans 3 semaines ».' : 'Rien dans les archives.'}
        </p>
      )}
      <ul className="list">
        {list.map((i) => {
          const subject = app.subjectById(i.subjectId)
          const days = diffDays(i.date, today)
          const revs = i.kind === 'exam' ? revisionsOf(i.id) : []
          return (
            <li key={i.id} className={'list-row tappable' + (i.done ? ' done' : '')} onClick={() => app.openEditor({ mode: 'edit', entry: i })}>
              {i.kind === 'homework' ? <Check checked={i.done} onChange={() => toggleDone(i)} label="Fait" /> : <span className="check-spacer" />}
              <div className="row-text">
                <span className={'row-title' + (i.kind === 'exam' ? ' strong' : '')}>{i.title}</span>
                <span className="row-sub">
                  <Dot subject={subject} />
                  {[KIND_LABELS[i.kind], subject?.name, formatShort(i.date)].filter(Boolean).join(' · ')}
                  {revs.length > 0 && ` · ${revs.filter((r) => r.done).length}/${revs.length} révisions`}
                </span>
              </div>
              <span className={'countdown' + (days >= 0 && days <= 3 ? ' soon' : '')}>{countdown(i.date, today)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
