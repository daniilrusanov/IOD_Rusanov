import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OBJECTS } from '../data/objects';
import { storage } from '../lib/storage';

export default function Lab1Vote() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [ranking, setRanking] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClick = (id: number) => {
    setRanking((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || ranking.length !== 3) {
      alert('Введіть ім\'я та оберіть 3 варіанти');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await storage.addLab1Vote({
        voterName: name.trim(),
        ranking: [ranking[0], ranking[1], ranking[2]],
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка збереження');
    } finally {
      setSubmitting(false);
    }
  };

  const getLabel = (id: number) => {
    const idx = ranking.indexOf(id);
    return idx >= 0 ? idx + 1 : null;
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
      <h1>ЛР1 — Голосування</h1>
      <p className="subtitle">Оберіть 3 мультфільми за пріоритетом. Клікніть по черзі: 1, 2, 3 місце.</p>

      <form onSubmit={handleSubmit} className="vote-form vote-form-lab1">
        <label className="name-field">
          <span>Ваше ім'я</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Введіть ім'я"
            required
          />
        </label>

        <div className="options-grid">
          {OBJECTS.map((o) => {
            const label = getLabel(o.id);
            return (
              <button
                key={o.id}
                type="button"
                className={`option-card ${label ? 'selected' : ''}`}
                onClick={() => handleClick(o.id)}
              >
                {label !== null && (
                <span className={`option-label place-${label}`}>{label}</span>
              )}
                <span className="option-name">{o.name}</span>
              </button>
            );
          })}
        </div>

        {ranking.length > 0 && (
          <p className="selection-hint">Обрано: {ranking.length}/3</p>
        )}

        {error && <p className="error">{error}</p>}

        <button
          type="submit"
          className="submit-btn"
          disabled={ranking.length !== 3 || !name.trim() || submitting}
        >
          {submitting ? 'Збереження...' : 'Підтвердити'}
        </button>
      </form>
    </div>
  );
}
