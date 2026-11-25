import { describe, expect, it } from 'vitest'
import { parse } from './parse'
import { DEFAULT_SUBJECTS } from '../lib/defaults'

// Date de référence fixe : mercredi 25 novembre 2026, 10 h.
const now = new Date(2026, 10, 25, 10, 0)
const p = (text: string) => parse(text, { now, subjects: DEFAULT_SUBJECTS })

describe('exemples du cahier des charges', () => {
  it('contrôle de physique dans 3 semaines', () => {
    expect(p('contrôle de physique dans 3 semaines')).toMatchObject({
      kind: 'exam', subjectId: 'physique', date: '2026-12-16', title: 'Contrôle de physique',
    })
  })

  it('mon prof a rajouté un DS de maths le 12/12 à 10h', () => {
    const r = p('mon prof a rajouté un DS de maths le 12/12 à 10h')
    expect(r).toMatchObject({
      kind: 'exam', subjectId: 'maths', date: '2026-12-12', start: '10:00', end: '11:00', title: 'DS de maths',
    })
  })

  it('devoir de SES pour vendredi', () => {
    expect(p('devoir de SES pour vendredi')).toMatchObject({
      kind: 'homework', subjectId: 'ses', date: '2026-11-27', title: 'Devoir de SES',
    })
  })

  it('dentiste mardi prochain 14h30', () => {
    expect(p('dentiste mardi prochain 14h30')).toMatchObject({
      kind: 'appointment', date: '2026-12-01', start: '14:30', end: '15:30', title: 'Dentiste',
    })
  })

  it('sport tous les lundis et jeudis de 18h à 20h', () => {
    const r = p('sport tous les lundis et jeudis de 18h à 20h')
    expect(r).toMatchObject({
      kind: 'event', title: 'Sport', start: '18:00', end: '20:00', recurrence: { weekdays: [1, 4] },
    })
    expect(r.date).toBe('2026-11-26') // premier jeudi
  })

  it('appeler la banque demain', () => {
    const r = p('appeler la banque demain')
    expect(r).toMatchObject({ kind: 'task', date: '2026-11-26', title: 'Appeler la banque' })
    expect(r.start).toBeUndefined()
  })
})

describe('dates relatives', () => {
  it.each([
    ["faire les courses aujourd'hui", '2026-11-25'],
    ['faire les courses aujourdhui', '2026-11-25'],
    ['ranger ma chambre demain', '2026-11-26'],
    ['ranger ma chambre après-demain', '2026-11-27'],
    ['ranger ma chambre apres demain', '2026-11-27'],
    ['rappeler Léa dans 2 jours', '2026-11-27'],
    ['rappeler Léa dans deux jours', '2026-11-27'],
    ['renouveler le passe navigo dans une semaine', '2026-12-02'],
    ['renouveler le passe navigo dans 15 jours', '2026-12-10'],
    ['bilan dans 1 mois', '2026-12-25'],
    ['réserver le train dans une quinzaine', '2026-12-09'],
    ['acheter un cadeau ce week-end', '2026-11-28'],
    ['acheter un cadeau la semaine prochaine', '2026-11-30'],
  ])('%s → %s', (text, date) => {
    expect(p(text).date).toBe(date)
  })
})

describe('jours de la semaine', () => {
  it.each([
    ['piscine lundi', '2026-11-30'],
    ['piscine mardi', '2026-12-01'],
    ['piscine mercredi', '2026-12-02'], // aujourd'hui mercredi → mercredi suivant
    ['piscine jeudi', '2026-11-26'],
    ['piscine dimanche', '2026-11-29'],
    ['piscine ce samedi', '2026-11-28'],
    ['piscine vendredi prochain', '2026-11-27'],
    ['piscine jeudi en huit', '2026-12-03'],
    ['piscine mardi de la semaine prochaine', '2026-12-01'],
    ['piscine vendredi la semaine prochaine', '2026-12-04'],
  ])('%s → %s', (text, date) => {
    expect(p(text).date).toBe(date)
  })
})

describe('dates absolues', () => {
  it.each([
    ['DS de maths le 12/12', '2026-12-12'],
    ['DS de maths le 3/12', '2026-12-03'],
    ['DS de maths le 03/01', '2027-01-03'], // date passée cette année → l'an prochain
    ['DS de maths le 12/12/2026', '2026-12-12'],
    ['DS de maths le 12/12/27', '2027-12-12'],
    ['DS de maths le 12 décembre', '2026-12-12'],
    ['DS de maths le 12 decembre', '2026-12-12'],
    ['DS de maths le 1er décembre', '2026-12-01'],
    ['DS de maths le 5 janv.', '2027-01-05'],
    ['DS de maths le 14 février 2027', '2027-02-14'],
    ['DS de maths lundi 14 décembre', '2026-12-14'],
    ['DS de maths le 28', '2026-11-28'],
    ['DS de maths le 2', '2026-12-02'],
    ['oral le 20 nov', '2027-11-20'],
  ])('%s → %s', (text, date) => {
    expect(p(text).date).toBe(date)
  })

  it("ignore une date impossible et garde une valeur par défaut", () => {
    const r = p('contrôle de SVT le 31/02')
    expect(r.date).toBe('2026-12-02')
    expect(r.defaulted).toContain('date')
  })
})

describe('heures et durées', () => {
  it.each([
    ['réunion demain à 14h', '14:00', '15:00'],
    ['réunion demain à 14h30', '14:30', '15:30'],
    ['réunion demain à 14 h 30', '14:30', '15:30'],
    ['réunion demain à 9:15', '09:15', '10:15'],
    ['réunion demain à 14 heures', '14:00', '15:00'],
    ['réunion demain de 14h à 16h', '14:00', '16:00'],
    ['réunion demain 14h-15h30', '14:00', '15:30'],
    ['réunion demain entre 14h et 16h', '14:00', '16:00'],
    ['réunion demain de 9 à 11h', '09:00', '11:00'],
    ['réunion demain à 14h pendant 2h', '14:00', '16:00'],
    ['réunion demain à 14h pendant 1h30', '14:00', '15:30'],
    ['réunion demain à 14h pendant 45 min', '14:00', '14:45'],
    ['réunion demain à 14h pendant une demi-heure', '14:00', '14:30'],
    ['déjeuner avec Tom demain midi', '12:00', '13:00'],
    ['film à 8h du soir', '20:00', '21:00'],
    ['réunion demain matin', '09:00', '10:00'],
    ['appeler maman ce soir', '19:00', '19:30'],
  ])('%s → %s-%s', (text, start, end) => {
    const r = p(text)
    expect(r.start).toBe(start)
    expect(r.end).toBe(end)
  })

  it('"dans 2 heures" donne une heure précise', () => {
    expect(p('sortir le chien dans 2 heures')).toMatchObject({ date: '2026-11-25', start: '12:00' })
  })

  it('"ce soir" fixe aussi la date', () => {
    expect(p('appeler maman ce soir').date).toBe('2026-11-25')
  })

  it('garde la durée même sans heure', () => {
    const r = p('réviser les maths après-demain pendant 1h')
    expect(r).toMatchObject({ kind: 'revision', subjectId: 'maths', date: '2026-11-27', duration: 60 })
    expect(r.start).toBeUndefined()
  })
})

describe("type d'élément", () => {
  it.each([
    ['contrôle de maths lundi', 'exam'],
    ['DS de physique lundi', 'exam'],
    ['examen de français lundi', 'exam'],
    ['interro de philo lundi', 'exam'],
    ['interrogation écrite lundi', 'exam'],
    ['devoir surveillé de SES lundi', 'exam'],
    ['bac blanc de philo le 15/01', 'exam'],
    ['QCM de SVT lundi', 'exam'],
    ['devoir de maths lundi', 'homework'],
    ['DM de physique pour lundi', 'homework'],
    ['exposé d’anglais le 3 décembre', 'homework'],
    ['dissertation de philo pour lundi', 'homework'],
    ['exercices de maths pour demain', 'homework'],
    ['rdv orthodontiste lundi 17h', 'appointment'],
    ['rendez-vous chez le médecin jeudi', 'appointment'],
    ['coiffeur samedi 11h', 'appointment'],
    ['entretien de stage lundi 10h', 'appointment'],
    ['anniversaire de Léa samedi', 'event'],
    ['concert samedi 20h', 'event'],
    ['acheter du pain', 'task'],
    ['réviser le contrôle de maths demain', 'revision'],
    ['goûter de 16h à 17h', 'event'], // plage horaire → événement
  ])('%s → %s', (text, kind) => {
    expect(p(text).kind).toBe(kind)
  })
})

describe('matières', () => {
  it.each([
    ['contrôle de maths', 'maths'],
    ['contrôle de math', 'maths'],
    ['contrôle de mathématiques', 'maths'],
    ['contrôle de physique-chimie', 'physique'],
    ['contrôle de chimie', 'physique'],
    ['contrôle de SES', 'ses'],
    ['contrôle de français', 'francais'],
    ['contrôle de francais', 'francais'],
    ['contrôle d’HGGSP', 'hggsp'],
    ["contrôle d'anglais", 'anglais'],
    ['contrôle d’histoire-géo', 'histoire'],
    ['contrôle d’histoire', 'histoire'],
    ['contrôle de géo', 'histoire'],
    ['contrôle de philo', 'philo'],
    ['contrôle de SVT', 'svt'],
  ])('%s → %s', (text, subjectId) => {
    expect(p(text).subjectId).toBe(subjectId)
  })

  it('pas de matière quand il n’y en a pas', () => {
    expect(p('acheter du pain').subjectId).toBeUndefined()
  })

  it('ne confond pas un mot qui contient une matière', () => {
    expect(p('mettre la géolocalisation').subjectId).toBeUndefined()
    expect(p('économiser').subjectId).toBeUndefined()
  })

  it('utilise une liste de matières personnalisée', () => {
    const r = parse('partiel de droit civil lundi', {
      now, subjects: [{ id: 'droit', name: 'Droit civil', color: '#000', aliases: ['droit'] }],
    })
    expect(r).toMatchObject({ kind: 'exam', subjectId: 'droit' })
  })
})

describe('récurrences', () => {
  it.each([
    ['piano tous les mercredis à 14h', [3]],
    ['piano chaque mercredi à 14h', [3]],
    ['piano les mercredis à 14h', [3]],
    ['foot tous les mardis, jeudis et samedis', [2, 4, 6]],
    ['foot les lundis et les vendredis', [1, 5]],
    ['méditer tous les jours à 7h', [0, 1, 2, 3, 4, 5, 6]],
    ['méditer chaque jour', [0, 1, 2, 3, 4, 5, 6]],
    ['cours en semaine de 8h à 17h', [1, 2, 3, 4, 5]],
    ['cours du lundi au vendredi', [1, 2, 3, 4, 5]],
    ['grasse mat tous les week-ends', [0, 6]],
    ['appeler mamie toutes les semaines', [3]], // le jour d'aujourd'hui
  ])('%s → %j', (text, weekdays) => {
    expect(p(text).recurrence?.weekdays).toEqual(weekdays)
  })

  it('tous les soirs → chaque jour à 19h', () => {
    expect(p('lire tous les soirs')).toMatchObject({ start: '19:00', recurrence: { weekdays: [0, 1, 2, 3, 4, 5, 6] } })
  })

  it('date de fin avec "jusqu’au"', () => {
    const r = p('stage tous les jours de 9h à 17h jusqu’au 18 décembre')
    expect(r.recurrence).toEqual({ weekdays: [0, 1, 2, 3, 4, 5, 6], endDate: '2026-12-18' })
    expect(r.title).toBe('Stage')
  })

  it('date de début', () => {
    const r = p('guitare tous les samedis à partir du 5 décembre à 10h')
    expect(r).toMatchObject({ date: '2026-12-05', start: '10:00', title: 'Guitare' })
  })

  it('une récurrence sans "tous les" reste simple', () => {
    expect(p('piscine lundi').recurrence).toBeUndefined()
  })
})

describe('titres', () => {
  it.each([
    ['mon prof a rajouté un DS de maths le 12/12 à 10h', 'DS de maths'],
    ['ma prof de SES a ajouté un contrôle lundi', 'Contrôle'],
    ["j'ai un contrôle d'anglais vendredi", "Contrôle d'anglais"],
    ['il y a une interro de philo demain', 'Interro de philo'],
    ['ne pas oublier de rendre le livre au CDI jeudi', 'Rendre le livre au CDI'],
    ['penser à acheter du lait', 'Acheter du lait'],
    ['rdv chez le dentiste le 3 décembre à 9h pour une carie', 'Rdv chez le dentiste pour une carie'],
    ['le 12 décembre, DS de maths', 'DS de maths'],
    ['demain : appeler la banque', 'Appeler la banque'],
    ['DS', 'DS'],
    ['demain', 'Tâche'],
    ['contrôle', 'Contrôle'],
  ])('%s → %s', (text, title) => {
    expect(p(text).title).toBe(title)
  })
})

describe('valeurs par défaut', () => {
  it('rendez-vous sans heure → 9 h, signalé', () => {
    const r = p('ophtalmo jeudi')
    expect(r).toMatchObject({ start: '09:00', end: '10:00' })
    expect(r.defaulted).toEqual(['heure'])
  })

  it('contrôle sans date → dans une semaine, signalé', () => {
    const r = p('contrôle de maths')
    expect(r.date).toBe('2026-12-02')
    expect(r.defaulted).toEqual(['date'])
  })

  it('devoir sans date → demain, signalé', () => {
    const r = p('DM de maths')
    expect(r.date).toBe('2026-11-26')
    expect(r.defaulted).toEqual(['date'])
  })

  it('tâche sans date → aujourd’hui, rien de signalé', () => {
    expect(p('acheter du pain')).toMatchObject({ date: '2026-11-25', defaulted: [] })
  })

  it('une fin avant le début est corrigée', () => {
    expect(p('soirée de 22h à 1h')).toMatchObject({ start: '22:00', end: '23:00' })
  })

  it('ne plante pas sur une saisie vide ou bizarre', () => {
    expect(() => p('')).not.toThrow()
    expect(() => p('   ')).not.toThrow()
    expect(() => p('99h99 le 45/13 ???')).not.toThrow()
    expect(() => p('🙂 sport demain')).not.toThrow()
  })
})
