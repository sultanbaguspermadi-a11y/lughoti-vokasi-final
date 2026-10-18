import { useEffect, useDeferredValue, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import Cover from './Cover'
import Onboard from './Onboard'
import Settings from './Settings'
import About from './About'
import BrandLogo from './BrandLogo'
import { BackToTop, Ic, ICON, Khatam } from './ui'
import { renderStory, STYLES } from './lib/share'
import { useHistoryLayer } from './lib/nav'
import { AR_FONTS, DEFAULTS, ID_FONTS, dailyWord, normalizePrefs, entryNo, entrySeq, majorOf, norm, parseDataset, stripHarakat, search, similarFor, usePersisted, isStringArray, isPlainObject, isMineValue, type Major, type Prefs, type Similar, type Word } from './lib/core'

type Data = { words: Word[]; similar: Similar[]; skipped: number }
type Scope = 'all' | 'fav' | 'recent'

function Mark({ t, q }: { t: string; q: string }) {
  const nq = norm(q).trim(); if (!nq) return <>{t}</>
  let s = ''; const map: number[] = []
  for (let i = 0; i < t.length; i++) { const c = norm(t[i]); for (const ch of c) { s += ch; map.push(i) } }
  const i = s.indexOf(nq); if (i < 0) return <>{t}</>
  const a = map[i]; let b = map[i + nq.length - 1] + 1
  while (b < t.length && norm(t[b]) === '') b++ // keep trailing diacritics inside the highlight
  return <>{t.slice(0, a)}<mark>{t.slice(a, b)}</mark>{t.slice(b)}</>
}

/** Native <dialog>: focus trap, Esc and focus restore come from the platform. Bottom sheet on phones. */
function Dialog({ open, onClose, title, flush, children }: { open: boolean; onClose: () => void; title: string; flush?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useHistoryLayer(open, onClose) // Back closes the sheet instead of leaving the site
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close() }, [open])
  return (
    <dialog className="sheet" ref={ref} aria-labelledby={id} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose() }}>
      <div className="dlg">
        <header className="dlg__head"><h2 id={id}>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Tutup"><Ic d={ICON.close} /></button></header>
        <div className={`dlg__body${flush ? ' dlg__body--flush' : ''}`}>{open && children}</div>
      </div>
    </dialog>
  )
}

function useMedia(query: string) {
  const [m, setM] = useState(() => matchMedia(query).matches)
  useEffect(() => { const l = matchMedia(query); const f = () => setM(l.matches); f(); l.addEventListener('change', f); return () => l.removeEventListener('change', f) }, [query])
  return m
}

export default function App() {
  const [prefs, setPrefs] = usePersisted('prefs', DEFAULTS, isPlainObject)
  const p = useMemo(() => normalizePrefs(prefs), [prefs])
  // Write the cleaned copy back once: stale or corrupt stored values never linger, and what Settings shows is what is saved.
  useEffect(() => { if (JSON.stringify(p) !== JSON.stringify(prefs)) setPrefs(p) }, [p, prefs, setPrefs])
  const [mine, setMine] = usePersisted<Major | 'all' | null>('mine', null, isMineValue)
  const [stage, setStage] = useState<'cover' | 'pick' | 'app' | 'about'>('cover')
  const [topic, setTopic] = useState('all')
  const [aboutFrom, setAboutFrom] = useState<'cover' | 'app'>('app')
  const [aboutSeen, setAboutSeen] = usePersisted('aboutSeen', false, v => typeof v === 'boolean')
  const [favs, setFavs] = usePersisted<string[]>('favs', [], isStringArray)
  const [recent, setRecent] = usePersisted<string[]>('recent', [], isStringArray)
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [tries, setTries] = useState(0)
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q)
  const [major, setMajor] = useState<Major>(mine && mine !== 'all' ? mine : 'RPL')
  const [scope, setScope] = useState<Scope>('all')
  const [lim, setLim] = useState(60)
  const [sel, setSel] = useState<Word | null>(null)
  const [cfg, setCfg] = useState(false)
  const [shareW, setShareW] = useState<Word | null>(null)
  const [style, setStyle] = useState<(typeof STYLES)[number]>('Zamrud')
  const [img, setImg] = useState<{ url: string; blob: Blob } | null>(null)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState('')
  const wide = useMedia('(min-width:1024px)')
  const [sysDark, setSysDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const hasMine = mine != null && mine !== 'all'
  useHistoryLayer(stage === 'about', () => setStage(aboutFrom))
  useHistoryLayer(stage === 'pick', () => setStage(hasMine ? 'app' : 'cover'))

  useEffect(() => {
    const m = matchMedia('(prefers-color-scheme: dark)'); const f = () => setSysDark(m.matches)
    m.addEventListener('change', f); return () => m.removeEventListener('change', f)
  }, [])
  useEffect(() => {
    const r = document.documentElement; const s = r.style
    r.dataset.theme = p.theme === 'system' ? (sysDark ? 'dark' : 'light') : p.theme
    r.dataset.calm = String(p.calm); r.dataset.compact = String(p.compact); r.dataset.translit = String(p.translit)
    s.setProperty('--acc', p.accent); s.setProperty('--ar-size', p.arSize + 'rem'); s.setProperty('--id-size', p.idSize + 'rem')
    s.setProperty('--sub-size', p.subSize + 'rem'); s.setProperty('--lh', String(p.lh)); s.setProperty('--maxw', p.width + 'px')
    s.setProperty('--ar-font', AR_FONTS[p.arFont] ?? AR_FONTS.Amiri); s.setProperty('--id-font', ID_FONTS[p.idFont] ?? ID_FONTS[DEFAULTS.idFont])
  }, [p.theme, p.accent, p.arSize, p.idSize, p.subSize, p.lh, p.width, p.arFont, p.idFont, p.calm, p.compact, p.translit, sysDark])
  useEffect(() => {
    let live = true; setErr('')
    fetch(`${import.meta.env.BASE_URL}words.json`).then(r => { if (!r.ok) throw new Error(`Gagal memuat words.json (HTTP ${r.status}).`); return r.json() })
      .then(j => live && setData(parseDataset(j))).catch(e => live && setErr(e instanceof Error ? e.message : 'Terjadi kesalahan.'))
    return () => { live = false }
  }, [tries])
  // story image preview, regenerated when the word or style changes
  useEffect(() => {
    if (!shareW) { setImg(null); return }
    let live = true, url = ''; setImg(null); setNote('')
    renderStory(shareW, style, p.arFont).then(b => { if (!live) return; url = URL.createObjectURL(b); setImg({ url, blob: b }) }).catch(() => live && setNote('Gagal membuat gambar.'))
    return () => { live = false; if (url) URL.revokeObjectURL(url) }
  }, [shareW, style, p.arFont])

  const byId = useMemo(() => new Map(data?.words.map(w => [w.id, w])), [data])
  const activeWords = useMemo(() => (data ? data.words.filter(w => w.major === major) : []), [data, major])
  const activeIds = useMemo(() => new Set(activeWords.map(w => w.id)), [activeWords])
  const activeFavIds = useMemo(() => favs.filter(id => activeIds.has(id) && byId.has(id)), [favs, activeIds, byId])
  const activeRecentIds = useMemo(() => recent.filter(id => activeIds.has(id) && byId.has(id)), [recent, activeIds, byId])
  const own = useMemo(() => search(activeWords, dq), [activeWords, dq])
  // Nothing in the chosen major: look through the whole dictionary instead of dead-ending.
  const crossMajor = scope === 'all' && !!dq.trim() && own.length === 0 && !!data
  const hits = useMemo(() => (crossMajor && data ? search(data.words, dq) : own), [crossMajor, data, own, dq])
  const base = useMemo(() => {
    if (scope === 'all') return hits
    const ids = scope === 'fav' ? activeFavIds : activeRecentIds
    const set = new Set(ids)
    const l = hits.filter(h => set.has(h.w.id))
    return dq ? l : l.sort((a, b) => ids.indexOf(a.w.id) - ids.indexOf(b.w.id))
  }, [hits, scope, activeFavIds, activeRecentIds, dq])
  const topics = useMemo(() => { const m = new Map<string, number>(); base.forEach(h => { if (h.w.topic) m.set(h.w.topic, (m.get(h.w.topic) || 0) + 1) }); return [...m].sort((a, b) => b[1] - a[1]) }, [base])
  const shown = useMemo(() => (topic === 'all' ? base : base.filter(h => h.w.topic === topic)), [base, topic])
  const daily = useMemo(() => (data && activeWords.length ? dailyWord(activeWords) : null), [data, activeWords])
  const similar = useMemo(() => (sel && data ? similarFor(data.similar, sel) : []), [sel, data])
  const counts = useMemo(() => { if (!data) return null; const m = new Map<Major, number>(); data.words.forEach(w => m.set(w.major, (m.get(w.major) ?? 0) + 1)); return m }, [data])

  useEffect(() => setLim(60), [dq, major, scope, topic])
  useEffect(() => setTopic('all'), [major])
  useEffect(() => { if (topic !== 'all' && !topics.some(t => t[0] === topic)) setTopic('all') }, [topic, topics])
  useEffect(() => { window.scrollTo(0, 0) }, [stage])
  const choose = (m: Major) => { setMine(m); setMajor(m); setTopic('all'); setQ(''); setScope('all'); setStage('app') }
  const open = (w: Word) => { setSel(w); setRecent(r => [w.id, ...r.filter(x => x !== w.id)].slice(0, 120)) }
  const toggleFav = (id: string) => setFavs(f => (f.includes(id) ? f.filter(x => x !== id) : [id, ...f]))
  const rnd = () => activeWords.length && open(activeWords[Math.floor(Math.random() * activeWords.length)])
  const resetFilters = () => { setQ(''); setScope('all'); setTopic('all') }
  const copy = async (w: Word) => {
    const t = [`${w.ar} (${w.tr}) = ${w.mean}`, w.exAr && `${w.exAr} — ${w.exId}`].filter(Boolean).join('\n')
    try { await navigator.clipboard.writeText(t) } catch { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove() }
    setCopied(w.id); setTimeout(() => setCopied(''), 1600)
  }
  const fname = (w: Word) => `lughati-${w.id.replace(':', '-')}.png`
  const download = () => { if (!img || !shareW) return; const a = document.createElement('a'); a.href = img.url; a.download = fname(shareW); a.click(); setNote('Gambar diunduh. Unggah dari galeri ke Story-mu.') }
  const share = async () => {
    if (!img || !shareW) return
    const f = new File([img.blob], fname(shareW), { type: 'image/png' })
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], title: 'Lughati Vokasi', text: `${shareW.ar} = ${shareW.mean}` }) } catch (e) { if ((e as Error).name !== 'AbortError') download() } }
    else download()
  }
  const openAbout = (from: 'cover' | 'app') => { setAboutFrom(from); setAboutSeen(true); setStage('about') }

  if (stage === 'about') return <About counts={counts} onBack={() => setStage(aboutFrom)} />
  if (stage === 'cover') return <Cover onStart={() => setStage(mine == null || mine === 'all' ? 'pick' : 'app')} onAbout={() => openAbout('cover')} />
  if (stage === 'pick') return <Onboard current={mine === 'all' ? null : mine} words={data?.words} onPick={choose} onClose={mine != null && mine !== 'all' ? () => setStage('app') : undefined} />

  const mj = majorOf(major)
  const selFav = !!sel && favs.includes(sel.id)
  const scopes: [Scope, string, number][] = [['all', 'Semua', activeWords.length], ['fav', 'Favorit', activeFavIds.length], ['recent', 'Terakhir', activeRecentIds.length]]
  const A = (t: string) => (p.harakat ? t : stripHarakat(t))
  const dailyEl = daily && !q && scope === 'all' && topic === 'all' ? (
    <button className="daily" onClick={() => open(daily)}>
      <span className="daily__meta"><span>Kata hari ini</span><span className="daily__go">{entryNo(daily)}<Ic d={ICON.chevron} /></span></span>
      <span className="daily__mean">{daily.mean}{daily.tr && <small className="daily__tr" dir="ltr">{daily.tr}</small>}</span>
      <span className="daily__ar ar" lang="ar" dir="rtl">{A(daily.ar)}</span>
    </button>) : null
  return (
    <div className="page screen">
      <a className="skip" href="#hasil">Lewati ke daftar kata</a>
      <div className="shell">
        <header className="hd">
          <button className="brand" onClick={() => setStage('cover')} aria-label="Kembali ke sampul"><span className="brand__logo"><BrandLogo decorative /></span>Lughati</button>
          <div className="hd__tools">
            <button className="icon-btn" onClick={rnd} aria-label="Kata acak" title="Kata acak"><Ic d={ICON.shuffle} /><span className="icon-btn__lbl">Acak</span></button>
            <button className="icon-btn" onClick={() => setCfg(true)} aria-label="Pengaturan tampilan" title="Pengaturan tampilan"><Ic d={ICON.sliders} /><span className="icon-btn__lbl">Tampilan</span></button>
          </div>
        </header>

        <main className="main">
          <div className="rail">
            {/* 1 · jurusan aktif */}
            <section className="vol" aria-labelledby="vol-name">
              <div className="vol__bar"><span className="stamp">{mj.code}</span><button className="link" onClick={() => setStage('pick')}>Ganti jurusan</button></div>
              <div className="vol__title"><h1 className="vol__name" id="vol-name">{mj.full}</h1><span className="vol__ar ar" lang="ar" dir="rtl">{mj.ar}</span></div>
            </section>

            {/* 2 · pencarian */}
            <div className="sbar-wrap" role="search">
              <div className="sbar">
                <Ic d={ICON.search} />
                <input type="search" dir="auto" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari kata Arab atau artinya" aria-label={`Cari kosakata jurusan ${mj.full}`}
                  inputMode="search" enterKeyHint="search" autoComplete="off" autoCapitalize="off" spellCheck={false}
                  onKeyDown={e => { if (e.key === 'Escape' && q) { e.preventDefault(); setQ('') } }} />
                {q && <button className="icon-btn" onClick={() => setQ('')} aria-label="Hapus pencarian"><Ic d={ICON.close} /></button>}
              </div>
            </div>
            <div className="tabs" role="group" aria-label="Tampilkan">
              {scopes.map(([k, l, n]) => <button key={k} aria-pressed={scope === k} onClick={() => setScope(k)}>{l}<small>{n}</small></button>)}
            </div>

            {/* 3 · kata hari ini */}
            {!wide && dailyEl}
            {/* 5 · filter kategori (sekunder) */}
            {topics.length > 0 && <div className="topics" role="group" aria-label="Kategori kata">
              <button aria-pressed={topic === 'all'} onClick={() => setTopic('all')}>Semua kategori</button>
              {topics.map(([t, n]) => <button key={t} aria-pressed={topic === t} onClick={() => setTopic(t)}>{t}<small>{n}</small></button>)}
            </div>}
          </div>

          {/* 4 · daftar kosakata */}
          <div className="results" id="hasil" tabIndex={-1}>
            {wide && dailyEl}
            {!aboutSeen && <div className="teaser" role="note">
              <button className="teaser__open" onClick={() => openAbout('app')}><b>Kenapa kamus ini dibuat?</b>Bahasa Arab yang nyambung dengan jurusanmu. Baca ceritanya.</button>
              <button className="icon-btn" onClick={() => setAboutSeen(true)} aria-label="Tutup pengantar"><Ic d={ICON.close} /></button></div>}

            {err && <div className="state state--error" role="alert"><h2>Kamus gagal dimuat</h2><p>{err}</p><button className="btn" onClick={() => setTries(t => t + 1)}>Coba lagi</button></div>}
            {!data && !err && <><p className="state state--load" role="status"><span className="ld" aria-hidden />Memuat kamus…</p><ul className="skel" aria-hidden>{Array.from({ length: 6 }, (_, i) => <li key={i} />)}</ul></>}
            {data && <>
              <p className="count" aria-live="polite"><b>{shown.length}</b> entri {crossMajor ? 'di jurusan lain' : `di ${mj.code}`}{q && <> untuk “{q}”</>}{topic !== 'all' && <>, kategori {topic}</>}{data.skipped > 0 && <> ({data.skipped} baris dilewati)</>}</p>
              {crossMajor && shown.length > 0 && <p className="sub" role="status">Tidak ada “{q}” di {mj.code}. Menampilkan hasil dari jurusan lain.</p>}
              {shown.length ? <>
                <ul className="entries">{shown.slice(0, lim).map(({ w }) => {
                  const fav = favs.includes(w.id)
                  return (
                    <li key={w.id} className="entry">
                      <button className="entry__open" onClick={() => open(w)}>
                        <span className="entry__no" aria-hidden>{entrySeq(w)}</span>
                        <span className="entry__tx"><b><Mark t={w.mean} q={dq} /></b>{(w.tr || crossMajor) && <small dir="ltr">{crossMajor && `${majorOf(w.major).code} · `}{w.tr && <Mark t={w.tr} q={dq} />}</small>}</span>
                        <span className="entry__ar ar" lang="ar" dir="rtl"><Mark t={A(w.ar)} q={dq} /></span>
                      </button>
                      <button className="entry__fav" aria-pressed={fav} aria-label={`Favorit: ${w.mean}`} onClick={() => toggleFav(w.id)}><Ic d={ICON.star} fill={fav} /></button>
                    </li>)
                })}</ul>
                {shown.length > lim && <button className="btn more" onClick={() => setLim(l => l + 60)}>Tampilkan {Math.min(60, shown.length - lim)} lagi</button>}
              </> : <div className="state">
                <Khatam size={20} />
                <h2>{q ? 'Tidak ada hasil' : scope === 'fav' ? 'Belum ada favorit' : scope === 'recent' ? 'Belum ada riwayat' : 'Kategori ini masih kosong'}</h2>
                <p>{q ? `Tidak ada entri untuk “${q}” di ${mj.code}${topic !== 'all' ? `, kategori ${topic}` : ''}. Pencarian mengabaikan harakat, jadi cukup ketik hurufnya.`
                  : scope === 'fav' ? `Ketuk bintang di samping kata untuk menyimpannya di ${mj.code}.`
                  : scope === 'recent' ? `Kata yang kamu buka di ${mj.code} akan muncul di sini.` : 'Belum ada kata di kategori ini.'}</p>
                {(q || scope !== 'all' || topic !== 'all') && <button className="btn" onClick={resetFilters}>Reset filter</button>}
              </div>}
            </>}
          </div>
        </main>

        <footer className="foot">
          <div className="foot__links"><button className="link" onClick={() => setCfg(true)}>Sesuaikan huruf, warna &amp; tema</button><button className="link" onClick={() => openAbout('app')}>Tentang kamus ini</button></div>
          <p>Lughati Vokasi, SMK Muhammadiyah Pencongan. Disusun oleh Sultan Bagus Permadi.</p>
        </footer>
      </div>

      <BackToTop focusSel=".brand" />
      <Dialog open={!!sel} onClose={() => setSel(null)} title={sel ? `Entri ${entryNo(sel)}` : 'Detail kata'}>
        {sel && <article className="detail">
          <div className="detail__ar ar" lang="ar" dir="rtl">{A(sel.ar)}</div>
          <div><h3 className="detail__mean">{sel.mean}</h3>{sel.tr && <p className="detail__tr" dir="ltr">{sel.tr}</p>}</div>
          <dl className="spec">{sel.topic && <><dt>Bidang</dt><dd>{sel.topic}</dd></>}<dt>Jurusan</dt><dd>{majorOf(sel.major).full}</dd></dl>
          {sel.exAr ? <section className="sec"><h3>Contoh kalimat</h3><p className="sec__ar ar" lang="ar" dir="rtl">{A(sel.exAr)}</p><p className="sec__id">{sel.exId}</p></section>
            : <p className="sub">Contoh kalimat belum tersedia untuk kata ini.</p>}
          {similar.map((s, i) => <section key={i} className="sec note"><h3>Hati-hati, mirip</h3>
            <p><span lang="ar" dir="rtl">{A(s.a1)}</span> ({s.m1}) ≠ <span lang="ar" dir="rtl">{A(s.a2)}</span> ({s.m2})</p><p>{s.tip}</p></section>)}
          <div className="acts">
            <button className="btn btn--primary btn--lg" onClick={() => setShareW(sel)}><Ic d={ICON.share} />Bagikan ke Story</button>
            <button className="btn" aria-pressed={selFav} onClick={() => toggleFav(sel.id)}><Ic d={ICON.star} fill={selFav} />Simpan</button>
            <button className="btn" onClick={() => copy(sel)}><Ic d={copied === sel.id ? ICON.check : ICON.copy} />{copied === sel.id ? 'Tersalin' : 'Salin'}</button>
          </div>
          <span className="sr-only" role="status">{copied === sel.id ? 'Tersalin ke papan klip' : selFav ? 'Disimpan ke favorit' : ''}</span>
        </article>}
      </Dialog>
      <Dialog open={!!shareW} onClose={() => setShareW(null)} title="Bagikan ke Story">
        <div className="share">
          <div className="story">{img ? <img src={img.url} alt={`Pratinjau kartu story untuk ${shareW?.mean ?? ''}`} /> : <span className="ld" role="status" aria-label="Membuat gambar" />}</div>
          <div className="seg" role="group" aria-label="Gaya kartu">{STYLES.map(s => <button key={s} aria-pressed={style === s} onClick={() => setStyle(s)}>{s}</button>)}</div>
          <div className="acts acts--stack"><button className="btn btn--primary btn--lg" disabled={!img} onClick={share}>Bagikan</button><button className="btn" disabled={!img} onClick={download}>Unduh PNG</button></div>
          <p className="sub" role="status">{note || 'Gambar 1080×1920, siap untuk Instagram, WhatsApp, atau TikTok Story.'}</p>
        </div>
      </Dialog>
      <Dialog open={cfg} onClose={() => setCfg(false)} title="Tampilan" flush><Settings p={p} set={setPrefs} count={activeWords.length} onDone={() => setCfg(false)} /></Dialog>
    </div>
  )
}
