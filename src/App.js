import React, { useEffect } from 'react'; // <-- Add useEffect
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import StockAnalysis from './components/InvestmentTable';
import WalletTracker from './components/WalletTracker';
import { MoneyProvider, useMoney } from './context/MoneyContext';
import './App.css';

// Component to display the Extra Money Caused value
const ExtraMoneyDisplay = () => {
  const { extraMoneyCaused, extraMoneyClass } = useMoney();
  
  const formattedValue = parseFloat(extraMoneyCaused).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
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

// --- THIS FUNCTION IS MOVED FROM WALLETTRACKER.JSX ---
// It calculates the P/L for a single closed company
const calculateCompanyPL = (company) => {
  if (!company || !company.transactions || company.transactions.length === 0) {
    return 0;
  }
  let totalRevenue = 0;
  let totalCost = 0;
  company.transactions.forEach(tx => {
    const quantity = parseFloat(tx.quantity);
    const unitPrice = parseFloat(tx.price);
    const extraCharges = parseFloat(tx.extraCharges || 0);
    if (isNaN(quantity) || isNaN(unitPrice)) {
      return;
    }
    if (quantity > 0) {
      // This is a BUY transaction
      totalCost += (quantity * unitPrice) + extraCharges;
    } else if (quantity < 0) {
      // This is a SELL transaction
      totalRevenue += (Math.abs(quantity) * unitPrice) - extraCharges;
    }
  });
  return totalRevenue - totalCost;
};


// --- NEW COMPONENT ---
// This component contains your app's layout and logic
// It can use useMoney() because it will be *inside* MoneyProvider
const AppLayout = () => {
  // Get the setter function from the context
  const { setExtraMoneyCaused } = useMoney();

  // This hook runs once when the app loads
  useEffect(() => {
    try {
      const savedCompanies = localStorage.getItem('companies');
      if (!savedCompanies) return; // No data

      const parsedCompanies = JSON.parse(savedCompanies);
      
      let totalRealizedPL = 0;

      // Filter for real companies that have transactions
      const investmentCompanies = parsedCompanies.filter(
        company => company.name !== "_TransactionHistory" &&
                   company.transactions && 
                   company.transactions.length > 0
      );

      // Calculate P/L for *only* closed positions
      investmentCompanies.forEach(company => {
        const lastTx = company.transactions[company.transactions.length - 1];
        // Check if shares are zero
        if (lastTx && (lastTx.totalShares === 0 || lastTx.totalShares === '0')) {
          // This is a closed position. Calculate its P/L.
          totalRealizedPL += calculateCompanyPL(company);
        }
      });

      // Update the context with the total P/L
      setExtraMoneyCaused(totalRealizedPL);

    } catch (error) {
      console.error("Error calculating total P/L in App.js:", error);
    }
  }, [setExtraMoneyCaused]); // The [setExtraMoneyCaused] dependency is stable

  // This is the JSX that used to be in App
  return (
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
  );
};

// --- MODIFIED App COMPONENT ---
// App's only job is to provide the context and render the layout
function App() {
  return (
    <MoneyProvider>
      <AppLayout />
    </MoneyProvider>
  );
}

export default App;