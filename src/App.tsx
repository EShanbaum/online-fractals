import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import DecimalViz from './pages/DecimalViz'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/decimal" element={<DecimalViz />} />
      </Routes>
    </BrowserRouter>
  )
}
