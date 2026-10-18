import { createRoot } from 'react-dom/client'
import '@fontsource/amiri/arabic-400.css'; import '@fontsource/amiri/arabic-700.css'; import '@fontsource/amiri/latin-400.css'
import '@fontsource/noto-naskh-arabic/arabic-400.css'; import '@fontsource/noto-naskh-arabic/arabic-700.css'
// Latin text. The -ext subsets carry the transliteration letters (ā ḥ ṣ ṭ ż ī ū) so they are never
// substituted from a fallback font.
import '@fontsource/plus-jakarta-sans/latin-400.css'; import '@fontsource/plus-jakarta-sans/latin-600.css'; import '@fontsource/plus-jakarta-sans/latin-ext-400.css'; import '@fontsource/plus-jakarta-sans/latin-ext-600.css'
import '@fontsource/source-serif-4/latin-400.css'; import '@fontsource/source-serif-4/latin-600.css'; import '@fontsource/source-serif-4/latin-400-italic.css'
import '@fontsource/source-serif-4/latin-ext-400.css'; import '@fontsource/source-serif-4/latin-ext-600.css'; import '@fontsource/source-serif-4/latin-ext-400-italic.css'
// Reading-font choice "Atkinson Hyperlegible" (designed for low-vision legibility).
import '@fontsource/atkinson-hyperlegible-next/latin-400.css'; import '@fontsource/atkinson-hyperlegible-next/latin-600.css'
// Cover headline: لغتي (no harakat) in a Riq'ah hand.
import '@fontsource/aref-ruqaa/arabic-700.css'
import './index.css'
import App from './App'
import ErrorBoundary from './ErrorBoundary'
import { registerSW } from './lib/pwa'
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>)
registerSW()
