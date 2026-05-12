import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { WebSocket, WebSocketServer } from 'ws'

const WS_PATH = '/ws'
const HEALTH_PATH = '/healthz'

const normalize = value => value.replace(/\/$/, '')

export function rewriteMessageToken(raw, token) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw
    const params = parsed.params
    const safeParams =
      params && typeof params === 'object' && !Array.isArray(params) ? params : {}
    return JSON.stringify({ ...parsed, params: { ...safeParams, token } })
  } catch {
    return raw
  }
}

function parseAllowedOrigins(raw) {
  if (!raw) return []
  return raw
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .map(normalize)
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!allowedOrigins.length) return true
  if (!origin) return false
  return allowedOrigins.includes(normalize(origin))
}

export function createProxyServer({
  backendUrl,
  backendToken,
  port = 8787,
  allowedOrigins = [],
} = {}) {
  if (!backendUrl) throw new Error('NODEGET_BACKEND_URL is required')
  if (!backendToken) throw new Error('NODEGET_BACKEND_TOKEN is required')

  const server = http.createServer((req, res) => {
    const path = new URL(req.url || '/', 'http://localhost').pathname
    if (path === HEALTH_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })

  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url || '/', 'http://localhost').pathname
    if (path !== WS_PATH) {
      socket.write('HTTP/1.1 404 Not Found\\r\\n\\r\\n')
      socket.destroy()
      return
    }

    if (!isOriginAllowed(req.headers.origin, allowedOrigins)) {
      socket.write('HTTP/1.1 403 Forbidden\\r\\n\\r\\n')
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws)
    })
  })

  wss.on('connection', client => {
    const upstream = new WebSocket(backendUrl)
    const queue = []

    const flush = () => {
      while (queue.length && upstream.readyState === WebSocket.OPEN) {
        upstream.send(queue.shift())
      }
    }

    client.on('message', (data, isBinary) => {
      if (isBinary) {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: true })
        return
      }

      const outbound = rewriteMessageToken(data.toString(), backendToken)
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(outbound)
      } else if (upstream.readyState === WebSocket.CONNECTING) {
        queue.push(outbound)
      }
    })

    upstream.on('open', flush)

    upstream.on('message', (data, isBinary) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary })
      }
    })

    upstream.on('error', () => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1011, 'upstream error')
      }
    })

    upstream.on('close', (code, reason) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(code || 1011, reason.toString())
      }
    })

    client.on('close', () => {
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.close()
      }
    })

    client.on('error', () => {
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.close()
      }
    })
  })

  return {
    server,
    listen() {
      return new Promise(resolve => {
        server.listen(port, () => {
          resolve(server.address())
        })
      })
    },
    close() {
      return new Promise(resolve => {
        wss.clients.forEach(client => client.terminate())
        wss.close(() => {
          server.close(() => resolve())
        })
      })
    },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const proxy = createProxyServer({
    backendUrl: process.env.NODEGET_BACKEND_URL,
    backendToken: process.env.NODEGET_BACKEND_TOKEN,
    port: Number(process.env.PORT || 8787),
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  })

  proxy
    .listen()
    .then(address => {
      const listenPort = typeof address === 'object' && address ? address.port : process.env.PORT || 8787
      console.log(`nodeget proxy listening on :${listenPort}`)
    })
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}
