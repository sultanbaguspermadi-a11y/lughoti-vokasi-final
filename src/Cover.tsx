import './cover.css'

interface Props { onStart: () => void; onAbout: () => void }

/** Title page. One centred axis, four things: the Arabic word, the title, the author, one action. */
export default function Cover({ onStart, onAbout }: Props) {
  return (
    <main className="cover screen">
      <p className="cover__top">Kamus Digital Arab–Indonesia</p>

      <section className="cover__center" aria-labelledby="cover-title">
        {/* real text (selectable, unvocalised, read aloud as "lughatī"), set in a Riq'ah face */}
        <p className="cover__ar" lang="ar" dir="rtl">لغتي</p>
        <h1 id="cover-title" className="cover__title">
          <span className="cover__latin">Lughati</span>{' '}
          <span className="cover__voc">Vokasi</span>
        </h1>
      </section>

      <footer className="cover__foot">
        <p className="cover__author">Sultan Bagus Permadi</p>
        <button type="button" className="btn btn--primary btn--lg cover__cta" onClick={onStart}>Buka kamus</button>
        <button type="button" className="link cover__about" onClick={onAbout}>Tentang kamus ini</button>
      </footer>
    </main>
  )
}
