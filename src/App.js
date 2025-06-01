import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import StockAnalysis from './components/InvestmentTable';
import WalletTracker from './components/WalletTracker';
import { MoneyProvider, useMoney } from './context/MoneyContext';
import './App.css';

// Component to display the Extra Money Caused value
const ExtraMoneyDisplay = () => {
  const { extraMoneyCaused, extraMoneyClass } = useMoney();
  
  // Format the money value with commas for thousands
  const formattedValue = parseFloat(extraMoneyCaused).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  // Determine if it's profit or loss
  const isProfit = extraMoneyClass === 'profit';
  
  return (
    <div className="extra-money-display">
      <div className="extra-money-label">Total P&L</div>
      <div className={`extra-money-value ${extraMoneyClass}`}>
        <span className="currency-symbol">₹</span>
        {isProfit ? '+' : ''}{formattedValue}
        <span className="indicator">{isProfit ? '↑' : '↓'}</span>
      </div>
    </div>
  );
};

function App() {
  return (
    <MoneyProvider>
      <Router>
        <div className="App">
          <nav className="app-nav">
            <Link to="/" className="nav-link">Stock Analysis</Link>
            <Link to="/wallet" className="nav-link">Wallet Tracker</Link>
          </nav>
          <ExtraMoneyDisplay />

          <Routes>
            <Route path="/" element={<StockAnalysis />} />
            <Route path="/wallet" element={<WalletTracker />} />
          </Routes>
        </div>
      </Router>
    </MoneyProvider>
  );
}

export default App;