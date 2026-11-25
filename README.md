# Planning

Planning personnel pour iPad : on écrit une phrase (« DS de maths le 12/12 à 10h »), l'appli la range toute seule.

- **Aujourd'hui** : frise heure par heure + tâches sans heure à cocher. Appui long sur un bloc pour le déplacer, balayage gauche/droite pour changer de jour.
- **Semaine** : 3 à 5 priorités + résumé des 7 jours.
- **Contrôles** : contrôles et devoirs à venir avec compte à rebours ; les passés sont archivés.
- **Révisions** : à chaque contrôle, séances proposées (J-7, J-4, J-2, J-1 par défaut) dans les créneaux libres.
- **Paramètres** : matières, réglages des révisions, export / import (sauvegarde JSON).

Tout reste sur l'appareil (IndexedDB). Pas de compte, pas de serveur, pas d'IA : les phrases sont comprises par `src/parser/parse.ts`.

## Commandes (sur un ordinateur, avec Node.js)

```bash
npm install      # une seule fois
npm test         # lance les tests automatiques
npm run dev      # ouvre l'appli en local
npm run build    # prépare la version à mettre en ligne (dossier dist/)
```

## Organisation du code

```
src/parser/   analyseur de phrases + tests
src/lib/      dates, séries, placement des révisions, sauvegarde (+ tests)
src/db/       base locale (Dexie) et actions
src/views/    écrans Aujourd'hui, Semaine, Contrôles, Paramètres
src/components/ saisie rapide, fiches d'édition et de révisions
```

## Mise en ligne

Chaque envoi sur la branche `main` de GitHub publie l'appli sur GitHub Pages
(`.github/workflows/deploy.yml`). Dans le dépôt : Settings → Pages → Source : **GitHub Actions**.
