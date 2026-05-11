import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { helpSystem, type HelpTopic } from '../lib/help';

export default function Help() {
  const navigate = useNavigate();
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const topics = searchQuery ? helpSystem.searchTopics(searchQuery) : helpSystem.getAllTopics();
  const related = selectedTopic ? helpSystem.getRelatedTopics(selectedTopic.id) : [];

  return (
    <div className="page help-page">
      <button className="link-btn back-btn" onClick={() => navigate('/')}>
        На головну
      </button>
      <h1>Система допомоги</h1>

      <div className="help-layout">
        <div className="help-sidebar">
          <input
            type="text"
            placeholder="Пошук допомоги..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="help-search"
          />

          <div className="help-topics-list">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setSelectedTopic(topic)}
                className={`help-topic-btn ${selectedTopic?.id === topic.id ? 'active' : ''}`}
              >
                {topic.title}
              </button>
            ))}
          </div>
        </div>

        <div className="help-content">
          {selectedTopic ? (
            <>
              <h2>{selectedTopic.title}</h2>
              <p className="help-description">{selectedTopic.description}</p>

              {selectedTopic.steps.length > 0 && (
                <div>
                  <h3>Кроки:</h3>
                  <ol>
                    {selectedTopic.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {selectedTopic.examples.length > 0 && (
                <div>
                  <h3>Приклади:</h3>
                  <ul>
                    {selectedTopic.examples.map((ex, i) => (
                      <li key={i}>{ex}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedTopic.shortcuts && selectedTopic.shortcuts.length > 0 && (
                <div>
                  <h3>Гарячі клавіші:</h3>
                  <ul>
                    {selectedTopic.shortcuts.map((sc, i) => (
                      <li key={i}>{sc}</li>
                    ))}
                  </ul>
                </div>
              )}

              {related.length > 0 && (
                <div className="help-related">
                  <h3>Пов'язані теми:</h3>
                  <div className="related-topics">
                    {related.map((topic) => (
                      <button
                        key={topic.id}
                        onClick={() => setSelectedTopic(topic)}
                        className="related-link"
                      >
                        {topic.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="help-placeholder">Виберіть тему допомоги зі списку</p>
          )}
        </div>
      </div>
    </div>
  );
}

