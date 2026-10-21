import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

/* Runs the real sw.template.js in a sandbox with an in-memory Cache API and a scriptable network. */
const ORIGIN = 'https://lv.test', SCOPE = `${ORIGIN}/app/`
const abs = (u: string) => new URL(u, SCOPE).href
type Listener = (e: any) => void

class MemCache {
  m = new Map<string, Response>()
  private key(r: RequestInfo | URL) { return typeof r === 'string' ? abs(r) : (r as Request).url }
  constructor(private net: (r: Request) => Promise<Response>) {}
  async match(r: RequestInfo | URL, o?: { ignoreSearch?: boolean }) {
    let k = this.key(r); if (o?.ignoreSearch) k = k.split('?')[0]
    for (const [mk, v] of this.m) if ((o?.ignoreSearch ? mk.split('?')[0] : mk) === k) return v.clone()
  }
  async put(r: RequestInfo | URL, res: Response) { this.m.set(this.key(r), res) }
  async add(r: RequestInfo | URL) { const req = typeof r === 'string' ? new Request(abs(r)) : (r as Request); const res = await this.net(req); if (!res.ok) throw new TypeError('bad response'); this.m.set(req.url, res) }
  async addAll(rs: (RequestInfo | URL)[]) { await Promise.all(rs.map(r => this.add(r))) }
}

function boot(opts: { files?: Record<string, string>; offline?: boolean } = {}) {
  const files: Record<string, { body: string; type: string; status?: number }> = {
    '/app/index.html': { body: '<html>shell', type: 'text/html' },
    '/app/assets/a-1.js': { body: 'js', type: 'text/javascript' },
    '/app/words.json': { body: '{"v":2}', type: 'application/json' },
  }
  const net = { offline: !!opts.offline, files, hits: [] as string[] }
  const fetchFn = async (r: RequestInfo | URL) => {
    const u = new URL(typeof r === 'string' ? abs(r) : (r as Request).url); net.hits.push(u.pathname)
    if (net.offline) throw new TypeError('offline')
    const f = net.files[u.pathname]; if (!f) return new Response('nope', { status: 404 })
    return new Response(f.body, { status: f.status ?? 200, headers: { 'content-type': f.type } })
  }
  const stores = new Map<string, MemCache>()
  const caches = {
    async open(n: string) { if (!stores.has(n)) stores.set(n, new MemCache(fetchFn)); return stores.get(n)! },
    async keys() { return [...stores.keys()] },
    async delete(n: string) { return stores.delete(n) },
  }
  const listeners: Record<string, Listener> = {}
  const spy = { skipWaiting: 0, claim: 0 }
  class Req extends Request { constructor(u: any, i?: any) { super(typeof u === 'string' ? abs(u) : u, i) } }
  const sandbox: any = {
    caches, fetch: fetchFn, Request: Req, Response, URL, Promise, Set, Map, RegExp, Error, TypeError,
    location: new URL(SCOPE), registration: { scope: SCOPE },
    skipWaiting: () => { spy.skipWaiting++ }, clients: { claim: async () => { spy.claim++ } },
    addEventListener: (t: string, f: Listener) => { listeners[t] = f },
  }
  sandbox.self = sandbox
  const src = readFileSync('pwa/sw.template.js', 'utf-8').replace('__VERSION__', 'v1').replace('__PRECACHE__', JSON.stringify(['./index.html', './assets/a-1.js']))
  vm.runInNewContext(src, sandbox)

  const run = async (type: string, ev: Record<string, unknown> = {}) => {
    const waits: Promise<unknown>[] = []; let response: Promise<Response> | undefined
    listeners[type]({ ...ev, waitUntil: (p: Promise<unknown>) => waits.push(p), respondWith: (p: Promise<Response>) => (response = Promise.resolve(p)) })
    await Promise.all(waits); return response
  }
  const get = (path: string, mode = 'cors') => run('fetch', { request: { method: 'GET', url: ORIGIN + path, mode } })
  return { net, stores, spy, run, get, open: (n: string) => caches.open(n), shell: () => stores.get('lughati:/app/:shell:v1'), data: () => stores.get('lughati:/app/:data') }
}

describe('service worker', () => {
  let sw: ReturnType<typeof boot>
  beforeEach(() => { sw = boot() })

  it('installs shell and dictionary, and waits for the page before taking over', async () => {
    await sw.run('install')
    expect([...sw.shell()!.m.keys()].sort()).toEqual([abs('assets/a-1.js'), abs('index.html')])
    expect(sw.data()!.m.has(abs('words.json'))).toBe(true)
    expect(sw.spy.skipWaiting).toBe(0)
  })

  it('install fails (so the old version stays) when a shell file cannot be fetched', async () => {
    delete sw.net.files['/app/assets/a-1.js']
    await expect(sw.run('install')).rejects.toThrow()
  })

  it('install survives a failed dictionary refresh if an older copy is cached, but not otherwise', async () => {
    await sw.run('install')                                   // first install stores the dictionary
    sw.net.files['/app/words.json'].status = 500
    await expect(sw.run('install')).resolves.toBeUndefined()  // an update may keep the copy it has
    sw.data()!.m.clear()
    await expect(sw.run('install')).rejects.toThrow()
  })

  it('opens every navigation from the cached shell, offline too', async () => {
    await sw.run('install'); sw.net.offline = true
    for (const p of ['/app/', '/app/?utm=x', '/app/anything']) {
      const res = await sw.get(p, 'navigate'); expect(await res!.text()).toBe('<html>shell')
    }
  })

  it('serves precached assets without touching the network, and passes unknown ones through', async () => {
    await sw.run('install'); sw.net.hits.length = 0
    expect(await (await sw.get('/app/assets/a-1.js'))!.text()).toBe('js')
    expect(sw.net.hits).toEqual([])
    sw.net.files['/app/extra.txt'] = { body: 'x', type: 'text/plain' }
    expect(await (await sw.get('/app/extra.txt'))!.text()).toBe('x')
  })

  it('dictionary: answers from cache instantly and refreshes it in the background', async () => {
    await sw.run('install')
    sw.net.files['/app/words.json'].body = '{"v":3}'
    expect(await (await sw.get('/app/words.json'))!.text()).toBe('{"v":2}')   // stale copy first
    expect(await (await sw.get('/app/words.json'))!.text()).toBe('{"v":3}')   // refreshed by the previous request
  })

  it('dictionary: never replaces a good copy with an error page or a captive-portal HTML 200', async () => {
    await sw.run('install')
    sw.net.files['/app/words.json'] = { body: '<html>login', type: 'text/html' }
    await sw.get('/app/words.json')
    sw.net.files['/app/words.json'] = { body: 'boom', type: 'application/json', status: 500 }
    await sw.get('/app/words.json')
    expect(await (await sw.get('/app/words.json'))!.text()).toBe('{"v":2}')
  })

  it('dictionary: works offline from cache, and fails cleanly when there is no copy', async () => {
    await sw.run('install'); sw.net.offline = true
    expect(await (await sw.get('/app/words.json'))!.text()).toBe('{"v":2}')
    sw.data()!.m.clear()
    await expect(sw.get('/app/words.json')).rejects.toThrow()
  })

  it('activation removes old versions and the legacy caches, keeps ours and foreign ones, then claims clients', async () => {
    for (const n of ['lughati:/app/:shell:v0', 'lv-data', 'lv-0123456789', 'other-app-cache', 'lughati:/other/:shell:v9']) await sw.open(n)
    await sw.run('install'); await sw.run('activate')
    expect([...sw.stores.keys()].sort()).toEqual(['lughati:/app/:data', 'lughati:/app/:shell:v1', 'lughati:/other/:shell:v9', 'other-app-cache'])
    expect(sw.spy.claim).toBe(1)
  })

  it('skips waiting only when the page asks', async () => {
    await sw.run('message', { data: { type: 'nope' } }); await sw.run('message', { data: null })
    expect(sw.spy.skipWaiting).toBe(0)
    await sw.run('message', { data: { type: 'SKIP_WAITING' } })
    expect(sw.spy.skipWaiting).toBe(1)
  })

  it('ignores non-GET and cross-origin requests', async () => {
    expect(await sw.run('fetch', { request: { method: 'POST', url: ORIGIN + '/app/x', mode: 'cors' } })).toBeUndefined()
    expect(await sw.run('fetch', { request: { method: 'GET', url: 'https://cdn.example/x.js', mode: 'cors' } })).toBeUndefined()
  })
})
