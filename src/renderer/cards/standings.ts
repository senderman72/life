import type { Standing } from '../../types'

const FAVORITE_TEAMS = ['Liverpool'] // Could be passed via config in future

function renderStandings(container: HTMLElement, standings: Standing[]): void {
  container.textContent = ''

  const label = document.createElement('div')
  label.className = 'card-label'
  label.textContent = 'Premier League'
  container.appendChild(label)

  if (standings.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'card-placeholder'
    empty.textContent = 'Loading table...'
    container.appendChild(empty)
    return
  }

  for (const entry of standings) {
    const row = document.createElement('div')
    row.className = 'standings-row'

    const rank = document.createElement('span')
    rank.className = 'standings-rank'
    rank.textContent = String(entry.rank)

    const team = document.createElement('span')
    team.className = 'standings-team'
    if (FAVORITE_TEAMS.includes(entry.teamName)) {
      team.classList.add('is-favorite')
    }
    team.textContent = entry.teamName

    const pts = document.createElement('span')
    pts.className = 'standings-pts'
    pts.textContent = String(entry.points)

    const gd = document.createElement('span')
    gd.className = 'standings-gd'
    gd.textContent = entry.goalDifference > 0 ? `+${entry.goalDifference}` : String(entry.goalDifference)

    row.append(rank, team, pts, gd)
    container.appendChild(row)
  }
}

export function initStandings(container: HTMLElement): () => void {
  return window.myday.onStandingsUpdate((standings: Standing[]) => {
    renderStandings(container, standings)
  })
}
