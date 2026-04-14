import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="page">
      <h1>Експертне опитування</h1>
      <p className="subtitle">Формування треку мультфільмів</p>

      <nav className="nav-cards">
        <Link to="/vote/lab1" className="nav-card">
          <h2>ЛР1 — Голосування</h2>
          <p>Пріоритетний вибір 3 мультфільмів</p>
        </Link>
        <Link to="/vote/lab2" className="nav-card">
          <h2>ЛР2 — Вибір евристик</h2>
          <p>Вибір 2–3 евристик для звуження</p>
        </Link>
        <Link to="/lab3" className="nav-card">
          <h2>ЛР3 — Колективне ранжування</h2>
          <p>Метрика Кука, перебір, еволюційний алгоритм</p>
        </Link>
        <Link to="/admin" className="nav-card admin">
          <h2>Адмін</h2>
          <p>Перегляд результатів та протоколу</p>
        </Link>
      </nav>
    </div>
  );
}
