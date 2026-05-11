import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storage, type Lab1Vote } from '../lib/storage';
import { OBJECTS } from '../data/objects';
import { logger } from '../lib/logging';

/**
 * Завдання 10: Реалізувати можливість незначної зміни індивідуальних ранжувань
 * з метою часткової зміни результатів
 */

export default function RankingModification() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [votes, setVotes] = useState<Lab1Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoteId, setSelectedVoteId] = useState<string>('');
  const [newRanking, setNewRanking] = useState<number[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const v = await storage.getLab1Votes();
        setVotes(v);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="page">
        <h1>Доступ заборонено</h1>
        <p>Тільки адміністратор може модифікувати ранжування.</p>
        <button onClick={() => navigate('/')}>На головну</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <p>Завантаження...</p>
      </div>
    );
  }

  const selectedVote = votes.find((v) => v.id === selectedVoteId);

  const handleSelectVote = (voteId: string) => {
    const vote = votes.find((v) => v.id === voteId);
    if (vote) {
      setSelectedVoteId(voteId);
      setNewRanking([...vote.ranking]);
      setMessage('');
    }
  };

  const handleObjectClick = (id: number) => {
    setNewRanking((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const getLabel = (id: number) => {
    const idx = newRanking.indexOf(id);
    return idx >= 0 ? idx + 1 : null;
  };

  const saveModification = async () => {
    if (newRanking.length !== 3 || !selectedVote) {
      setMessage('Помилка: оберіть рівно 3 об\'єкти');
      return;
    }

    logger.log({
      userType: 'admin',
      userName: 'admin',
      action: 'Модифікація ранжування експерта',
      module: 'RankingModification',
      details: {
        voteId: selectedVoteId,
        originalRanking: selectedVote.ranking,
        newRanking: newRanking as [number, number, number],
      },
      status: 'success',
    });

    setMessage('Ранжування модифіковано! (Зберегти дані вручну у базі)');
    setTimeout(() => setMessage(''), 3000);
  };

  const resetModification = () => {
    if (selectedVote) {
      setNewRanking([...selectedVote.ranking]);
      setMessage('Скинуто на оригіналь');
      setTimeout(() => setMessage(''), 2000);
    }
  };

  return (
    <div className="page">
      <button className="link-btn back-btn" onClick={() => navigate('/admin')}>
        Повернутись
      </button>
      <h1>Модифікація ранжувань</h1>
      <p className="subtitle">
        Обереіте голос експерта та легко змініть порядок вибору для часткової зміни результатів
      </p>

      {message && (
        <p className={message.includes('Помилка') ? 'error' : 'success'}>{message}</p>
      )}

      <section>
        <h2>Оберіть голос для редагування</h2>
        <div className="votes-list">
          {votes.map((vote) => (
            <button
              key={vote.id}
              className={`vote-btn ${selectedVoteId === vote.id ? 'active' : ''}`}
              onClick={() => handleSelectVote(vote.id)}
            >
              <strong>{vote.voterName}</strong>
              <br />
              {vote.ranking
                .map((id) => OBJECTS.find((o) => o.id === id)?.name ?? id)
                .join(' → ')}
              <br />
              <small>{new Date(vote.createdAt).toLocaleString()}</small>
            </button>
          ))}
        </div>
      </section>

      {selectedVote && (
        <section>
          <h2>Редагує голос: {selectedVote.voterName}</h2>
          <p className="subtitle">Клікніть на мультфільми в новому порядку: 1, 2, 3 місце</p>

          <div className="options-grid">
            {OBJECTS.map((o) => {
              const label = getLabel(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`option-card ${label ? 'selected' : ''}`}
                  onClick={() => handleObjectClick(o.id)}
                >
                  {label !== null && <span className={`option-label place-${label}`}>{label}</span>}
                  <span className="option-name">{o.name}</span>
                </button>
              );
            })}
          </div>

          <p className="selection-hint">Обрано: {newRanking.length}/3</p>

          <div className="button-group">
            <button
              onClick={saveModification}
              disabled={newRanking.length !== 3}
              className="primary-btn"
            >
              💾 Зберегти зміни
            </button>
            <button onClick={resetModification} className="secondary-btn">
              ↺ Скинути
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

