#!/usr/bin/env node

// One-time Strava OAuth setup.
// Run: node scripts/auth-strava.js
// Saves tokens to ~/.myday/strava-tokens.json

const http = require('http')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const CONFIG_PATH = path.join(__dirname, '..', 'config.json')
const TOKENS_PATH = path.join(require('os').homedir(), '.myday', 'strava-tokens.json')

let config
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
} catch (err) {
  console.error(`Error: Could not read ${CONFIG_PATH}: ${err.message}`)
  process.exit(1)
}
const { clientId, clientSecret } = config.strava || {}

if (!clientId || !clientSecret) {
  console.error('Error: strava.clientId and strava.clientSecret must be set in config.json')
  process.exit(1)
}

const REDIRECT_URI = 'http://localhost:3000/oauth/callback'
const AUTH_URL = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=activity:read_all`

console.log('\nOpening browser for Strava authorization...\n')
console.log(`If the browser doesn't open, visit:\n${AUTH_URL}\n`)

try {
  spawnSync('open', [AUTH_URL])
} catch {
  // Browser open failed — user can use the URL above
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3000')
  if (!url.pathname.startsWith('/oauth/callback')) {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const code = url.searchParams.get('code')
  if (!code) {
    res.writeHead(400)
    res.end('Missing authorization code')
    return
  }

  try {
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      throw new Error(`Token exchange failed: ${err}`)
    }

    const tokens = await tokenResponse.json()

    if (!tokens.access_token || !tokens.refresh_token || typeof tokens.expires_at !== 'number') {
      throw new Error(`Unexpected token response: ${JSON.stringify(tokens)}`)
    }

    const dir = path.dirname(TOKENS_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const tokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at * 1000, // Strava returns Unix seconds, convert to ms
    }

    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokenData, null, 2))
    console.log(`\nTokens saved to ${TOKENS_PATH}`)
    console.log('Strava authorization complete!\n')

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body><h2>Authorization complete!</h2><p>You can close this tab.</p></body></html>')
  } catch (err) {
    console.error('Authorization failed:', err.message)
    res.writeHead(500)
    res.end(`Authorization failed: ${err.message}`)
  } finally {
    server.close()
  }
})

server.listen(3000, () => {
  console.log('Waiting for OAuth callback on http://localhost:3000/oauth/callback ...')
})
