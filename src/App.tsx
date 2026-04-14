import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import Lab1Vote from './pages/Lab1Vote';
import Lab2Vote from './pages/Lab2Vote';
import Lab3 from './pages/Lab3';
import Admin from './pages/Admin';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <header className="header">
            <a href="/">Експертне опитування</a>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/vote/lab1" element={<Lab1Vote />} />
              <Route path="/vote/lab2" element={<Lab2Vote />} />
              <Route path="/lab3" element={<Lab3 />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
