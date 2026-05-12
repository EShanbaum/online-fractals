import { useNavigate } from 'react-router-dom'
import './Home.css'

const TOOLS = [
  {
    path: '/decimal',
    icon: '∿',
    title: 'Fraction Paths',
    description: 'Visualize the base-n digit expansion of any fraction as a directed path on the plane.',
  },
  {
    path: '/toothpick',
    icon: '⌥',
    title: 'Custom Sequences',
    description: 'Draw a shape, mark attachment and growth points, and watch it recursively tile the plane.',
  },
]

export default function Home() {
  const navigate = useNavigate()
  return (
    <div className="home">
      <header className="home-header">
        <h1>Visualizations</h1>
        <p>Interactive tools for exploring mathematical patterns.</p>
      </header>
      <main className="home-grid">
        {TOOLS.map(tool => (
          <button key={tool.path} className="tool-card" onClick={() => navigate(tool.path)}>
            <span className="tool-icon">{tool.icon}</span>
            <h2>{tool.title}</h2>
            <p>{tool.description}</p>
          </button>
        ))}
      </main>
    </div>
  )
}
