import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storage } from '../lib/storage';
import type { Lab1Vote, Lab2Vote } from '../lib/storage';
import { computeLab1Ranking } from '../lib/lab1Results';
import { computeHeuristicPopularity, applyHeuristics } from '../lib/lab2Heuristics';
import { logger, type LogEntry } from '../lib/logging';
import { configManager } from '../lib/configuration';
import { OBJECTS } from '../data/objects';
import { HEURISTICS } from '../data/heuristics';

export default function Admin() {
  const { isAdmin, login, logout } = useAuth();
  const navigate = useNavigate();
  const [loginInput, setLoginInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [error, setError] = useState('');
  const [lab1Votes, setLab1Votes] = useState<Lab1Vote[]>([]);
  const [lab2Votes, setLab2Votes] = useState<Lab2Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'protocol' | 'settings' | 'logs' | 'modifications'>('protocol');

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      try {
        const [v1, v2] = await Promise.all([storage.getLab1Votes(), storage.getLab2Votes()]);
        setLab1Votes(v1);
        setLab2Votes(v2);
        setLogs(logger.getAllLogs());
        logger.log({
          userType: 'admin',
          userName: 'admin',
          action: 'Вхід до панелі адміністратора',
          module: 'Admin',
          details: { votesCount: v1.length },
          status: 'success',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(loginInput, passInput)) {
      setError('');
    } else {
      setError('Невірний логін або пароль');
    }
  };

  if (!isAdmin) {
    return (
      <div className="page">
        <h1>Вхід для адміністратора</h1>
        <form onSubmit={handleLogin} className="login-form">
          <label>
            <span>Логін</span>
            <input type="text" value={loginInput} onChange={(e) => setLoginInput(e.target.value)} />
          </label>
          <label>
            <span>Пароль</span>
            <input type="password" value={passInput} onChange={(e) => setPassInput(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit">Увійти</button>
        </form>
        <button className="link-btn" onClick={() => navigate('/')}>На головну</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <p className="subtitle">Завантаження...</p>
      </div>
    );
  }

  const lab1Ranking = computeLab1Ranking(lab1Votes);
  const topObjects = lab1Ranking.slice(0, 15).map((r) => r.objectId);
  const heuristicsPopularity = computeHeuristicPopularity(lab2Votes);
  const topHeuristics = heuristicsPopularity.slice(0, 3).map((h) => h.heuristicId);
  const winners = applyHeuristics(lab1Votes, topObjects, topHeuristics, 10);

  const config = configManager.getConfig();

  return (
    <div className="page admin-page">
      <div className="admin-header">
        <h1>Панель адміністратора</h1>
        <button onClick={logout}>Вийти</button>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'protocol' ? 'active' : ''}`}
          onClick={() => setActiveTab('protocol')}
        >
          Протокол
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Налаштування
        </button>
        <button
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Логи {logs.length > 0 && `(${logs.length})`}
        </button>
        <button
          className={`tab-btn ${activeTab === 'modifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('modifications')}
        >
          Редаг. ранжувань
        </button>
      </div>

      {activeTab === 'protocol' && (
        <>
          <section>
            <h2>Протокол ЛР1</h2>
            <p>Всього голосів: {lab1Votes.length}</p>
            <div className="protocol">
              {lab1Votes.map((v) => (
                <div key={v.id} className="protocol-row">
                  <span>{v.voterName}</span>
                  <span>
                    {v.ranking.map((id) => OBJECTS.find((o) => o.id === id)?.name ?? id).join(' → ')}
                  </span>
                  <span>{new Date(v.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>Результати ЛР1 (ранжування)</h2>
            <table className="results-table">
              <thead>
                <tr>
                  <th>Місце</th>
                  <th>Мультфільм</th>
                  <th>Бали</th>
                </tr>
              </thead>
              <tbody>
                {lab1Ranking.map((r) => (
                  <tr key={r.objectId}>
                    <td>{r.rank}</td>
                    <td>{OBJECTS.find((o) => o.id === r.objectId)?.name ?? r.objectId}</td>
                    <td>{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2>Протокол ЛР2</h2>
            <p>Всього голосів: {lab2Votes.length}</p>
            <div className="protocol">
              {lab2Votes.map((v) => (
                <div key={v.id} className="protocol-row">
                  <span>{v.voterName}</span>
                  <span>{v.selectedHeuristics.join(', ')}</span>
                  <span>{new Date(v.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>Популярність евристик</h2>
            <table className="results-table">
              <thead>
                <tr>
                  <th>Місце</th>
                  <th>Евристика</th>
                  <th>Кількість</th>
                </tr>
              </thead>
              <tbody>
                {heuristicsPopularity.map((h) => (
                  <tr key={h.heuristicId}>
                    <td>{h.rank}</td>
                    <td>{HEURISTICS.find((x) => x.id === h.heuristicId)?.name ?? h.heuristicId}</td>
                    <td>{h.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2>Підмножина переможців (макс. 10)</h2>
            <p>Застосовано топ-3 евристики: {topHeuristics.join(', ')}</p>
            <ul className="winners-list">
              {winners.map((id, i) => (
                <li key={id}>
                  {i + 1}. {OBJECTS.find((o) => o.id === id)?.name ?? id}
                </li>
              ))}
            </ul>
          </section>

          <div className="admin-footer-links">
            <button className="link-btn" type="button" onClick={() => navigate('/lab3')}>
              ЛР3 — колективне ранжування
            </button>
            <button className="link-btn" type="button" onClick={() => navigate('/')}>
              На головну
            </button>
          </div>
        </>
      )}

      {activeTab === 'settings' && (
        <section>
          <h2>Налаштування системи</h2>
          <p><strong>Предметна область:</strong> {config.domainName}</p>
          <p><strong>Об'єктів:</strong> {config.objectCount}</p>
          <p><strong>Макс. об'єктів для перебору:</strong> {config.bruteForceMaxN}</p>
          <p><strong>Конфіденційний режим:</strong> {config.confidentialMode ? 'Так' : 'Ні'}</p>
          <p><strong>Відкритий режим:</strong> {config.openMode ? 'Так' : 'Ні'}</p>
          <p className="hint">Повне редагування налаштувань розширена функціональність - вручну у коді lib/configuration.ts</p>
        </section>
      )}

      {activeTab === 'logs' && (
        <section>
          <h2>Логи системи</h2>
          <p>Всього записів: {logs.length}</p>
          <div className="button-group">
            <button onClick={() => logger.exportLogs()}>📥 Експортувати JSON</button>
            <button onClick={() => logger.exportLogsCSV()}>📊 Експортувати CSV</button>
            <button onClick={() => { logger.clearLogs(); setLogs([]); }}>🗑️ Очистити логи</button>
          </div>
          <div className="logs-list">
            {logs.slice(-50).reverse().map((log) => (
              <div key={log.id} className="log-row">
                <strong>{log.action}</strong>
                <span>{log.userType === 'admin' ? '👤 Адмін' : '👥 Користувач'}</span>
                <span>{log.status === 'success' ? '✓' : '✗'} {log.status}</span>
                <small>{new Date(log.timestamp).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'modifications' && (
        <section>
          <h2>Редагування ранжувань</h2>
          <p>Перейти на сторінку для редагування окремих ранжувань експертів:</p>
          <button onClick={() => navigate('/ranking-modification')} className="primary-btn">
            Редагувати ранжування
          </button>
        </section>
      )}
    </div>
  );
}
