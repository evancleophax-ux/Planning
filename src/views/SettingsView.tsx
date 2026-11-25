// Paramètres : matières, révisions, journée, sauvegarde.

import { useRef, useState } from 'react'
import type { Subject } from '../types'
import { addSubject, deleteSubject, exportAll, importAll, saveSettings, saveSubject } from '../db/actions'
import { backupFileName, readBackup } from '../lib/backup'
import { SUBJECT_COLORS } from '../lib/defaults'
import { useApp } from '../app/context'

const LAST_EXPORT_KEY = 'planning:lastExport'

function readLastExport(): string | null {
  try { return localStorage.getItem(LAST_EXPORT_KEY) } catch { return null }
}

export function SettingsView() {
  const app = useApp()
  const s = app.settings
  const [offsets, setOffsets] = useState(s.revisionOffsets.join(', '))

  function saveOffsets(text: string) {
    const list = [...new Set(text.split(/[^\d]+/).map(Number).filter((n) => n > 0 && n <= 60))].sort((a, b) => b - a)
    setOffsets(list.join(', '))
    saveSettings({ revisionOffsets: list })
  }

  return (
    <div className="view settings">
      <header className="view-header"><div><h1>Paramètres</h1></div></header>

      <section className="block-section">
        <h3 className="section-title">Matières</h3>
        <p className="muted small">Les « autres noms » servent à reconnaître la matière dans tes phrases (séparés par des virgules).</p>
        <ul className="list">
          {app.subjects.map((sub) => <SubjectRow key={sub.id} subject={sub} />)}
        </ul>
        <button type="button" className="btn-text" onClick={() => addSubject(SUBJECT_COLORS[app.subjects.length % SUBJECT_COLORS.length])}>
          Ajouter une matière
        </button>
      </section>

      <section className="block-section">
        <h3 className="section-title">Révisions automatiques</h3>
        <ul className="list">
          <li className="list-row">
            <label className="setting">
              <span>Séances (jours avant le contrôle)</span>
              <input className="inline-input narrow" value={offsets} inputMode="numeric" onChange={(e) => setOffsets(e.target.value)} onBlur={(e) => saveOffsets(e.target.value)} />
            </label>
          </li>
          <li className="list-row">
            <label className="setting">
              <span>Durée d'une séance</span>
              <select value={s.revisionDuration} onChange={(e) => saveSettings({ revisionDuration: Number(e.target.value) })}>
                {[20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
          </li>
          <li className="list-row">
            <label className="setting">
              <span>Réviser à partir de (en semaine)</span>
              <input type="time" value={s.studyStartWeekday} onChange={(e) => e.target.value && saveSettings({ studyStartWeekday: e.target.value })} />
            </label>
          </li>
          <li className="list-row">
            <label className="setting">
              <span>Réviser à partir de (week-end)</span>
              <input type="time" value={s.studyStartWeekend} onChange={(e) => e.target.value && saveSettings({ studyStartWeekend: e.target.value })} />
            </label>
          </li>
        </ul>
      </section>

      <section className="block-section">
        <h3 className="section-title">Journée</h3>
        <ul className="list">
          <li className="list-row">
            <label className="setting">
              <span>La frise commence à</span>
              <input type="time" value={s.dayStart} step={3600} onChange={(e) => e.target.value && saveSettings({ dayStart: e.target.value })} />
            </label>
          </li>
          <li className="list-row">
            <label className="setting">
              <span>et se termine à</span>
              <input type="time" value={s.dayEnd} step={3600} onChange={(e) => e.target.value && saveSettings({ dayEnd: e.target.value })} />
            </label>
          </li>
        </ul>
      </section>

      <Backup />

      <section className="block-section">
        <h3 className="section-title">Exemples de phrases</h3>
        <ul className="examples muted">
          <li>contrôle de physique dans 3 semaines</li>
          <li>mon prof a rajouté un DS de maths le 12/12 à 10h</li>
          <li>devoir de SES pour vendredi</li>
          <li>dentiste mardi prochain 14h30</li>
          <li>sport tous les lundis et jeudis de 18h à 20h</li>
          <li>appeler la banque demain</li>
          <li>réviser l'anglais après-demain à 17h pendant 1h</li>
          <li>piano chaque mercredi à 14h jusqu'au 20 juin</li>
        </ul>
      </section>
    </div>
  )
}

function SubjectRow({ subject }: { subject: Subject }) {
  const [name, setName] = useState(subject.name)
  const [aliases, setAliases] = useState(subject.aliases.join(', '))
  const nextColor = () => {
    const i = SUBJECT_COLORS.indexOf(subject.color)
    saveSubject({ ...subject, color: SUBJECT_COLORS[(i + 1) % SUBJECT_COLORS.length] })
  }
  const commit = () => saveSubject({
    ...subject,
    name: name.trim(),
    aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
  })
  return (
    <li className="list-row subject-row">
      <button type="button" className="dot big" style={{ background: subject.color }} onClick={nextColor} aria-label="Changer la couleur" />
      <input className="inline-input subject-name" value={name} placeholder="Nom" onChange={(e) => setName(e.target.value)} onBlur={commit} autoFocus={!subject.name} />
      <input className="inline-input subject-aliases" value={aliases} placeholder="autres noms" onChange={(e) => setAliases(e.target.value)} onBlur={commit} />
      <button type="button" className="btn-text danger" onClick={() => confirm(`Supprimer la matière « ${subject.name} » ?`) && deleteSubject(subject.id)}>Retirer</button>
    </li>
  )
}

function Backup() {
  const app = useApp()
  const fileInput = useRef<HTMLInputElement>(null)
  const [lastExport, setLastExport] = useState(readLastExport)

  async function doExport() {
    const data = await exportAll()
    const name = backupFileName()
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
    const file = new File([blob], name, { type: 'application/json' })
    // Sur iPad : la feuille de partage permet « Enregistrer dans Fichiers ».
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name })
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        throw e
      }
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    const when = new Date().toISOString()
    try { localStorage.setItem(LAST_EXPORT_KEY, when) } catch { /* rien */ }
    setLastExport(when)
  }

  async function doImport(file: File) {
    try {
      const backup = readBackup(await file.text())
      const date = new Date(backup.exportedAt).toLocaleDateString('fr-FR')
      if (!confirm(`Remplacer toutes tes données par la sauvegarde du ${date} (${backup.items.length} éléments) ?`)) return
      await importAll(backup)
      app.toast('Sauvegarde importée')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <section className="block-section">
      <h3 className="section-title">Sauvegarde</h3>
      <p className="muted small">
        Tes données restent uniquement sur cet iPad. Exporte-les de temps en temps dans Fichiers ou iCloud Drive.
        {lastExport ? ` Dernier export : ${new Date(lastExport).toLocaleDateString('fr-FR')}.` : ' Aucun export pour l’instant.'}
      </p>
      <div className="button-row">
        <button type="button" className="btn-primary" onClick={doExport}>Exporter</button>
        <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>Importer</button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) doImport(f) }}
        />
      </div>
    </section>
  )
}
