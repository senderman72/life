import type { Fixture, GoalEvent, Standing } from '../../types'

const STATUS_LABELS: Record<string, string> = {
  NS: 'Upcoming', '1H': '1st Half', HT: 'Half Time', '2H': '2nd Half',
  FT: 'Full Time', ET: 'Extra Time', PEN: 'Penalties',
  PST: 'Postponed', CANC: 'Cancelled',
}

function formatKickoff(fixture: Fixture): string {
  // For NS fixtures, minute is null — show a placeholder
  return fixture.status === 'NS' ? 'TBD' : `${fixture.minute}\u2032`
}

function isLive(status: string): boolean {
  return ['1H', '2H', 'HT', 'ET', 'PEN'].includes(status)
}

function renderFixture(fixture: Fixture): HTMLElement {
  const row = document.createElement('div')
  row.className = 'football-match'
  row.dataset.fixtureId = String(fixture.id)

  const teams = document.createElement('div')
  teams.className = 'football-teams'

  const home = document.createElement('span')
  home.className = 'football-team'
  home.textContent = fixture.homeTeam

  const vs = document.createElement('span')
  vs.className = 'football-vs'

  if (fixture.status === 'NS') {
    vs.textContent = 'vs'
  } else {
    vs.textContent = `${fixture.score.home} \u2013 ${fixture.score.away}`
    if (isLive(fixture.status)) vs.classList.add('football-live-score')
  }

  const away = document.createElement('span')
  away.className = 'football-team'
  away.textContent = fixture.awayTeam

  teams.append(home, vs, away)

  const status = document.createElement('div')
  status.className = 'football-status'
  if (isLive(fixture.status)) {
    status.classList.add('football-status-live')
    status.textContent = `${STATUS_LABELS[fixture.status] ?? fixture.status} ${formatKickoff(fixture)}`
  } else {
    status.textContent = STATUS_LABELS[fixture.status] ?? fixture.status
  }

  row.append(teams, status)
  return row
}

function renderStandings(container: HTMLElement, standings: Standing[][]): void {
  for (const table of standings) {
    if (table.length === 0) continue
    const top5 = table.slice(0, 5)
    const section = document.createElement('div')
    section.className = 'football-standings'

    for (const entry of top5) {
      const row = document.createElement('div')
      row.className = 'football-standing-row'
      row.textContent = `${entry.rank}. ${entry.teamName} \u2014 ${entry.points} pts`
      section.appendChild(row)
    }
    container.appendChild(section)
  }
}

function renderFootball(container: HTMLElement, fixtures: Fixture[]): void {
  container.textContent = ''

  const label = document.createElement('div')
  label.className = 'card-label'
  label.textContent = 'Football'
  container.appendChild(label)

  if (fixtures.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'football-empty'
    empty.textContent = 'No matches today'
    container.appendChild(empty)
    return
  }

  for (const fixture of fixtures) {
    container.appendChild(renderFixture(fixture))
  }
}

function applyGoalFlash(container: HTMLElement, goal: GoalEvent): void {
  const matchEl = container.querySelector(`[data-fixture-id="${goal.fixtureId}"]`)
  if (!matchEl) return

  let flashClass: string
  if (goal.isFavorite) {
    flashClass = 'goal-flash-green'
  } else if (goal.againstFavorite) {
    flashClass = 'goal-flash-red'
  } else {
    flashClass = 'goal-flash-amber'
  }

  matchEl.classList.add(flashClass)

  setTimeout(() => {
    matchEl.classList.add('fading')
  }, 8000)

  setTimeout(() => {
    matchEl.classList.remove(flashClass, 'fading')
  }, 9000)
}

export function initFootball(container: HTMLElement): () => void {
  const disposeUpdate = window.myday.onFootballUpdate((fixtures: Fixture[]) => {
    renderFootball(container, fixtures)
  })

  const disposeGoal = window.myday.onGoalEvent((goal: GoalEvent) => {
    applyGoalFlash(container, goal)
  })

  return () => { disposeUpdate(); disposeGoal() }
}
