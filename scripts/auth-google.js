#!/usr/bin/env node

// One-time Google Calendar OAuth setup.
// Run: node scripts/auth-google.js
// Saves refresh token to ~/.myday/google-tokens.json

const http = require('http')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const CONFIG_PATH = path.join(__dirname, '..', 'config.json')
const TOKENS_PATH = path.join(require('os').homedir(), '.myday', 'google-tokens.json')

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
const { clientId, clientSecret, redirectUri } = config.google

if (!clientId || !clientSecret) {
  console.error('Error: google.clientId and google.clientSecret must be set in config.json')
  process.exit(1)
}

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'
const AUTH_URL = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&access_type=offline&prompt=consent`

console.log('\nOpening browser for Google Calendar authorization...\n')
console.log(`If the browser doesn't open, visit:\n${AUTH_URL}\n`)

try {
  spawnSync('open', [AUTH_URL])
} catch {
  // Browser open failed — user can use the URL above
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3000`)
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
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      throw new Error(`Token exchange failed: ${err}`)
    }

    const tokens = await tokenResponse.json()

    if (!tokens.access_token || !tokens.refresh_token || typeof tokens.expires_in !== 'number') {
      throw new Error(`Unexpected token response: ${JSON.stringify(tokens)}`)
    }

    // Ensure storage directory exists
    const dir = path.dirname(TOKENS_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const tokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    }

    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokenData, null, 2))
    console.log(`\nTokens saved to ${TOKENS_PATH}`)
    console.log('Google Calendar authorization complete!\n')

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
