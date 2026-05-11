import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import Lab1Vote from './pages/Lab1Vote';
import Lab2Vote from './pages/Lab2Vote';
import Lab3 from './pages/Lab3';
import Lab4 from './pages/Lab4';
import Admin from './pages/Admin';
import Help from './pages/Help';
import RankingModification from './pages/RankingModification';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <header className="header">
            <a href="/">Експертне опитування</a>
            <nav className="header-nav">
              <a href="/help" className="help-link" title="Допомога">❓</a>
            </nav>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/vote/lab1" element={<Lab1Vote />} />
              <Route path="/vote/lab2" element={<Lab2Vote />} />
              <Route path="/lab3" element={<Lab3 />} />
              <Route path="/lab4" element={<Lab4 />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/help" element={<Help />} />
              <Route path="/ranking-modification" element={<RankingModification />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
