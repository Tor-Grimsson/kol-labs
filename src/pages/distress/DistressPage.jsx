import { Route, Routes } from 'react-router-dom'
import MainPage from './pages/MainPage.jsx'
import RefinePage from './pages/RefinePage.jsx'
import './distress.css'

// Descendant routes under the shell's /distress/* mount (was a standalone
// BrowserRouter app in kol-labs).
function DistressPage() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="refine" element={<RefinePage />} />
    </Routes>
  )
}

export default DistressPage
