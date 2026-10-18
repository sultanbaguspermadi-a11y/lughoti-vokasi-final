import { useEffect } from 'react'
import { MAJORS, type Major } from './lib/core'
import { BackToTop, Ic, ICON, Khatam } from './ui'
import './about.css'

interface Props {
  /** Entries per major, derived from the loaded dataset so the page never shows stale numbers. */
  counts: Map<Major, number> | null
  onBack: () => void
}

const PICK = MAJORS.filter(m => m.key !== 'Umum')

const FEATURES = [
  ['Kosakata per jurusan', 'Setiap kata dipilih dari pekerjaan nyata di jurusanmu, bukan dari topik umum.'],
  ['Contoh kalimat kerja', 'Kalimat pendek yang bisa kamu ucapkan di kelas praktik, bengkel, kantor, atau saat magang.'],
  ['Hati-hati, mirip', 'Pasangan kata yang gampang tertukar, supaya salah baca tidak jadi salah kerja.'],
  ['Bagikan ke Story', 'Ubah satu kata menjadi kartu gambar untuk dibagikan dan diingat bersama teman.'],
] as const

export default function About({ counts, onBack }: Props) {
  useEffect(() => { window.scrollTo({ top: 0 }) }, [])
  const total = counts ? PICK.reduce((n, m) => n + (counts.get(m.key) ?? 0), 0) : null

  return (
    <main className="about screen">
      <div className="about__inner">
        <div className="about__bar">
          <button type="button" className="btn" onClick={onBack}><Ic d={ICON.back} />Kembali</button>
        </div>

        <header className="about__head">
          <h1 className="about__title">Bahasa Arab yang akhirnya nyambung dengan jurusanmu</h1>
          <div className="about__tag">
            <p>“Bahasaku dalam profesiku”</p>
            <span className="ar" lang="ar" dir="rtl">لُغَتِي فِي مِهْنَتِي</span>
          </div>
        </header>

        <section className="about__sec">
          <h2>Kenapa kamus ini ada</h2>
          <div className="about__body">
            <p>Di SMK, kita belajar bahasa Arab dari buku pelajaran yang sama untuk semua jurusan. Isinya tentang sekolah, keluarga, dan percakapan sehari-hari. Itu penting, tetapi jarang menyentuh dunia yang sedang kita siapkan: baris kode, jurnal dan neraca, bodi mobil, atau mesin motor.</p>
            <p>Akibatnya banyak dari kita merasa materinya tidak nyambung. “Ini nanti dipakai di mana?” Pertanyaan itu wajar, dan selama ini jarang ada yang menjawabnya.</p>
            <p>Lughati Vokasi dibuat untuk menjawabnya. Setiap kata di sini diambil dari pekerjaan yang benar-benar kamu pelajari, supaya bahasa Arab terasa seperti bagian dari keahlianmu, bukan pelajaran yang berdiri sendiri.</p>
          </div>
        </section>

        <section className="about__sec">
          <h2>Yang ada di dalamnya</h2>
          <div className="about__body">
            <dl className="about__feats">
              {FEATURES.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
            </dl>
            <ul className="about__index" aria-label="Isi kamus per jurusan">
              {PICK.map(m => (
                <li key={m.key}>
                  <span className="stamp">{m.code}</span>
                  <span>{m.full}</span>
                  <span className="n">{counts ? `${counts.get(m.key) ?? 0} entri` : '…'}</span>
                </li>
              ))}
            </ul>
            {total != null && <p className="about__total">Total {total} kata khusus jurusan, ditambah kosakata umum untuk dunia kerja.</p>}
          </div>
        </section>

        <section className="about__sec">
          <h2>Pesan untukmu</h2>
          <div className="about__body">
            <p>Kamu tidak sedang menambah beban pelajaran. Kamu sedang menambah satu bahasa untuk profesimu. Bahasa yang membuka buku panduan teknis, istilah perbankan syariah, peluang kerja yang lebih luas, dan percakapan dengan pelanggan yang beragam.</p>
            <p>Tidak perlu langsung fasih. Satu kata sehari sudah cukup. Setelah sebulan, tiga puluh kata yang benar-benar kamu pakai lebih berharga daripada tiga ratus yang dihafal lalu lupa.</p>
            <blockquote className="about__quote">
              <Khatam />
              <span className="ar" lang="ar" dir="rtl">مَنْ جَدَّ وَجَدَ</span>
              <small>man jadda wajada: siapa bersungguh-sungguh, ia akan berhasil</small>
            </blockquote>
          </div>
        </section>

        <section className="about__sec">
          <h2>Cara mulai</h2>
          <div className="about__body">
            <ol className="about__steps">
              <li><span>Pilih jurusanmu, lalu buka <b>Kata hari ini</b>.</span></li>
              <li><span>Baca contoh kalimatnya dan ucapkan dengan lantang.</span></li>
              <li><span>Simpan yang paling berguna ke favorit, lalu pakai saat praktik atau magang.</span></li>
            </ol>
          </div>
        </section>

        <footer className="about__sign">
          <p>Selamat belajar, dan tetap bangga dengan jalur vokasimu.</p>
          <strong>Sultan Bagus Permadi</strong>
          <span>SMK Muhammadiyah Pencongan</span>
          <button type="button" className="btn btn--primary btn--lg" onClick={onBack}>Mulai belajar</button>
        </footer>
      </div>
      <BackToTop focusSel=".about__bar .btn" />
    </main>
  )
}
