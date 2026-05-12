import assert from 'node:assert/strict'
import { test } from 'node:test'
import http from 'node:http'
import { once } from 'node:events'
import { WebSocketServer, WebSocket } from 'ws'
import { createProxyServer, rewriteMessageToken } from '../server.js'

test('rewriteMessageToken replaces params.token', () => {
  const raw = JSON.stringify({ jsonrpc: '2.0', method: 'x', params: { token: 'public', a: 1 }, id: 1 })
  const rewritten = JSON.parse(rewriteMessageToken(raw, 'secret'))
  assert.equal(rewritten.params.token, 'secret')
  assert.equal(rewritten.params.a, 1)
})

test('rewriteMessageToken adds params when missing', () => {
  const raw = JSON.stringify({ jsonrpc: '2.0', method: 'x', id: 1 })
  const rewritten = JSON.parse(rewriteMessageToken(raw, 'secret'))
  assert.equal(rewritten.params.token, 'secret')
})

test('proxy forwards websocket message with server-side token', async () => {
  const upstreamHttp = http.createServer()
  const upstreamWss = new WebSocketServer({ server: upstreamHttp })
  upstreamHttp.listen(0)
  await once(upstreamHttp, 'listening')
  const upstreamPort = upstreamHttp.address().port

  const seen = []
  upstreamWss.on('connection', ws => {
    ws.on('message', data => {
      const msg = JSON.parse(data.toString())
      seen.push(msg)
      ws.send(JSON.stringify({ ok: true }))
    })
  })

  const proxy = createProxyServer({
    backendUrl: `ws://127.0.0.1:${upstreamPort}`,
    backendToken: 'server-secret-token',
    port: 0,
  })
  const address = await proxy.listen()
  const proxyPort = address.port

  const client = new WebSocket(`ws://127.0.0.1:${proxyPort}/ws`)
  await once(client, 'open')

  client.send(
    JSON.stringify({
      jsonrpc: '2.0',
      method: 'agent.list',
      params: { token: 'browser-token', extra: 123 },
      id: 1,
    }),
  )

  const [message] = await once(client, 'message')
  assert.deepEqual(JSON.parse(message.toString()), { ok: true })
  assert.equal(seen.length, 1)
  assert.equal(seen[0].params.token, 'server-secret-token')
  assert.equal(seen[0].params.extra, 123)

  client.close()
  await proxy.close()
  await new Promise(resolve => upstreamWss.close(resolve))
  await new Promise(resolve => upstreamHttp.close(resolve))
})
