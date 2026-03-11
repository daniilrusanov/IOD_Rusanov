import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HEURISTICS } from '../data/heuristics';
import { storage } from '../lib/storage';

export default function Lab2Vote() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selected.length < 2 || selected.length > 3) {
      alert('Оберіть 2–3 евристики');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await storage.addLab2Vote({ voterName: name.trim(), selectedHeuristics: selected });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка збереження');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="page">
        <h1>Дякуємо</h1>
        <p className="subtitle">Ваш голос успішно подано.</p>
        <button onClick={() => navigate('/')}>На головну</button>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="link-btn back-btn" onClick={() => navigate('/')}>Повернутись на головну</button>
      <h1>ЛР2 — Вибір евристик</h1>
      <p className="subtitle">Вкажіть ім'я та оберіть 2–3 евристики для звуження підмножини.</p>

      <form onSubmit={handleSubmit} className="vote-form vote-form-lab2">
        <label>
          <span>Ваше ім'я</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Введіть ім'я"
            required
          />
        </label>

        <div className="heuristics-list">
          {HEURISTICS.map((h) => (
            <label key={h.id} className="heuristic-check">
              <input
                type="checkbox"
                checked={selected.includes(h.id)}
                onChange={() => toggle(h.id)}
              />
              <span>{h.id}: {h.name}</span>
            </label>
          ))}
        </div>
        <p className="hint">Обрано: {selected.length}/3 (потрібно 2–3)</p>

        {error && <p className="error">{error}</p>}

        <button
          type="submit"
          disabled={selected.length < 2 || submitting}
        >
          {submitting ? 'Збереження...' : 'Підтвердити'}
        </button>
      </form>
    </div>
  );
}
