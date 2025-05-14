import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import StockAnalysis from './components/InvestmentTable';
import WalletTracker from './components/WalletTracker';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="app-nav">
          <Link to="/" className="nav-link">Stock Analysis</Link>
          <Link to="/wallet" className="nav-link">Wallet Tracker</Link>
        </nav>

        <Routes>
          <Route path="/" element={<StockAnalysis />} />
          <Route path="/wallet" element={<WalletTracker />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;