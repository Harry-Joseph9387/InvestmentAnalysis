import React, { useState, useEffect,useRef } from 'react';
import './WalletTracker.css';
import { useMoney } from '../context/MoneyContext';

import './WalletTracker.css';
import ChartDataLabels from 'chartjs-plugin-datalabels';
// Add these new imports for Chart.js
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Add these new imports for Chart.js
import { Pie, Bar,getElementAtEvent } from 'react-chartjs-2'; // <-- Import Bar
import {
  CategoryScale, // <-- Add this
  LinearScale,   // <-- Add this
  BarElement,      // <-- Add this
  Title            // <-- Add this (optional but good)
} from 'chart.js';

// Register all the components Chart.js needs
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartDataLabels
);

// Register the components Chart.js needs for a Pie chart
ChartJS.register(ArcElement, Tooltip, Legend);



const WalletTracker = () => {
  // State for companies and their data from localStorage
  
  // State to track which chart is visible
  const [chartView, setChartView] = useState('active');
  const [companiesData, setCompaniesData] = useState([]);
  const [companyNames, setCompanyNames] = useState([]);
  const portfolioChartRef = useRef(null);
  // Wallet transactions state (separate from investment transactions)
  const [walletTransactions, setWalletTransactions] = useState([]);
  // --- ADD THESE THREE LINES ---
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [otherModalData, setOtherModalData] = useState([]); // Data for the modal
  const [otherCompaniesList, setOtherCompaniesList] = useState([]); // Raw data
  // State for adding money to wallet - replace separate deposit and withdraw states with a single amount state
  const [walletAmount, setWalletAmount] = useState('');

  // --- ADD THESE FOR THE CLOSED CHART MODAL ---
  const [showClosedOtherModal, setShowClosedOtherModal] = useState(false);
  const [closedOtherModalData, setClosedOtherModalData] = useState([]);
  const [closedOtherCompaniesList, setClosedOtherCompaniesList] = useState([]);

  // --- ADD A REF FOR THE BAR CHART ---
  const closedChartRef = useRef(null);

  // Save status message
  const [saveStatus, setSaveStatus] = useState('');
  
  // State for info modal
  const [showInfoModal, setShowInfoModal] = useState(false);

  // State for active tab
  const [activeTab, setActiveTab] = useState('active-investments');

  // Add these new state variables for the reminder feature
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [reminderStock, setReminderStock] = useState('');
  const [reminderQuantity, setReminderQuantity] = useState('');
  const [reminderPrice, setReminderPrice] = useState('');
  const [reminderType, setReminderType] = useState('buy');

  // Add these state variables at the top of the component
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [visibleCompanies, setVisibleCompanies] = useState([]);
  const [dropdownCompanies, setDropdownCompanies] = useState([]);

  // Add these new state variables at the top of the component
  const [expandedBuyRows, setExpandedBuyRows] = useState([]);
  const [individualBuyTransactions, setIndividualBuyTransactions] = useState({});

  // Add this new state variable for the utility panel
  const [showUtilityPanel, setShowUtilityPanel] = useState(false);

  // State for our new charts
  const [portfolioPieData, setPortfolioPieData] = useState(null);
  const [closedBarData, setClosedBarData] = useState(null); // <-- Renamed
  // Add this to get context access
  const { setExtraMoneyCaused } = useMoney();

  // Process company data to create wallet transactions
  const processCompanyData = (parsedCompanies) => {
    try {
      const historyCompany = parsedCompanies.find(c => c.name === "_TransactionHistory");
      if (!historyCompany || !historyCompany.transactions) {
        console.log("No transaction history found.");
        setWalletTransactions([]);
        return;
      }

      const transactions = historyCompany.transactions;
      let newWalletTransactions = [];
      let currentAmount = 0;
      let extraMoney = 0;
      let companyInvestments = {}; // Tracks value in each company

      // Initialize company investments
      companyNames.forEach(name => {
        companyInvestments[name] = 0;
      });

      transactions.forEach((tx, index) => {
        let isNote = false;
        let noteText = '';
        let rowAmount = currentAmount;
        let rowExtraMoney = extraMoney;
        let rowCompanyInvestments = { ...companyInvestments };

        if (tx.type === 'deposit') {
          currentAmount += parseFloat(tx.amount);
          rowAmount = currentAmount;
          isNote = true;
          noteText = `Deposited ₹${parseFloat(tx.amount).toFixed(2)}`;
        } else if (tx.type === 'withdraw') {
          currentAmount -= parseFloat(tx.amount);
          rowAmount = currentAmount;
          isNote = true;
          noteText = `Withdrew ₹${parseFloat(tx.amount).toFixed(2)}`;
        } else if (tx.transactionType === 'buy') {
          const cost = parseFloat(tx.quantity) * parseFloat(tx.price);
          currentAmount -= cost;
          companyInvestments[tx.companyName] = (companyInvestments[tx.companyName] || 0) + cost;
          rowAmount = currentAmount;
          rowCompanyInvestments = { ...companyInvestments };
          isNote = true;
          noteText = `Bought ${tx.quantity} ${tx.companyName} @ ₹${parseFloat(tx.price).toFixed(2)}`;
        } else if (tx.transactionType === 'sell') {
          const revenue = parseFloat(tx.quantity) * parseFloat(tx.price);
          const costOfSoldShares = tx.averageBuyPrice ? parseFloat(tx.quantity) * parseFloat(tx.averageBuyPrice) : 0;
          const profitLoss = revenue - costOfSoldShares;

          currentAmount += revenue;
          extraMoney += profitLoss;
          companyInvestments[tx.companyName] = (companyInvestments[tx.companyName] || 0) - costOfSoldShares;
          
          rowAmount = currentAmount;
          rowExtraMoney = extraMoney;
          rowCompanyInvestments = { ...companyInvestments };
          isNote = true;
          noteText = `Sold ${tx.quantity} ${tx.companyName} @ ₹${parseFloat(tx.price).toFixed(2)} (P/L: ₹${profitLoss.toFixed(2)})`;
        }

        newWalletTransactions.push({
          id: index,
          date: tx.date,
          amountInWallet: rowAmount,
          extraMoneyCaused: rowExtraMoney,
          companyInvestments: rowCompanyInvestments,
          isNote: isNote,
          note: noteText,
          transaction: tx // Store the original transaction
        });
      });

      // Set the final processed transactions
      setWalletTransactions(newWalletTransactions.reverse()); // Show newest first
    } catch (error) {
      console.error("Error processing company data:", error);
    }
  };
  // Add this to get context access
// ... inside your component, before the useEffect that uses investedCompanies ...

  // Derive the list of invested companies from companiesData
  const investedCompanies = companiesData.filter(
    company => company.name !== "_TransactionHistory" && company.quantity > 0
  );

  const handleAddMoneyToWallet = (amountStr) => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      setSaveStatus('Please enter a valid amount');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }

    try {
      const savedCompanies = JSON.parse(localStorage.getItem('companies') || '[]');
      let historyCompany = savedCompanies.find(c => c.name === "_TransactionHistory");

      if (!historyCompany) {
        historyCompany = { name: "_TransactionHistory", transactions: [] };
        savedCompanies.push(historyCompany);
      }

      const newTransaction = {
        type: 'deposit',
        amount: amount,
        date: new Date().toISOString()
      };

      historyCompany.transactions.push(newTransaction);
      localStorage.setItem('companies', JSON.stringify(savedCompanies));
      refreshData(); // Refresh to show the change
    } catch (error) {
      console.error("Error adding money:", error);
      setSaveStatus('Error saving deposit');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleWithdrawMoneyFromWallet = (amountStr) => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      setSaveStatus('Please enter a valid amount');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }

    try {
      const savedCompanies = JSON.parse(localStorage.getItem('companies') || '[]');
      let historyCompany = savedCompanies.find(c => c.name === "_TransactionHistory");

      if (!historyCompany) {
        historyCompany = { name: "_TransactionHistory", transactions: [] };
        savedCompanies.push(historyCompany);
      }

      const newTransaction = {
        type: 'withdraw',
        amount: amount,
        date: new Date().toISOString()
      };

      historyCompany.transactions.push(newTransaction);
      localStorage.setItem('companies', JSON.stringify(savedCompanies));
      refreshData(); // Refresh to show the change
    } catch (error) {
      console.error("Error withdrawing money:", error);
      setSaveStatus('Error saving withdrawal');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };
  // Add a separate useEffect to update visible companies...
  useEffect(() => {
    // ... (rest of the useEffect) ...
    // Get current companies data
    const threshold = windowWidth < 768 ? 2 : 
                      windowWidth < 992 ? 3 : 
                      windowWidth < 1200 ? 4 : 5;
    
    if (investedCompanies.length <= threshold) {
      // ...
    } else {
      // ...
    }
  }, [walletTransactions, companyNames, windowWidth, companiesData]); // <-- Add companiesData here
  // Load companies data from localStorage when component mounts
  useEffect(() => {
    const loadCompaniesFromStorage = () => {
      try {
        const savedCompanies = localStorage.getItem('companies');
        if (savedCompanies) {
          const parsedCompanies = JSON.parse(savedCompanies);
          setCompaniesData(parsedCompanies);
          
          // Extract just the company names, excluding _TransactionHistory
          const names = parsedCompanies
            .map(company => company.name)
            .filter(name => name !== "_TransactionHistory");
          setCompanyNames(names);
          
          // Process company data to create wallet transactions
          processCompanyData(parsedCompanies);
        }
      } catch (error) {
        console.error("Error parsing companies from localStorage:", error);
      }
    };

    // Initial load
    loadCompaniesFromStorage();
    
    // Setup a listener for localStorage changes (only works across tabs)
    window.addEventListener('storage', (event) => {
      if (event.key === 'companies') {
        loadCompaniesFromStorage();
      }
    });
    
    // Load reminders from localStorage
    const loadRemindersFromStorage = () => {
      const savedReminders = localStorage.getItem('stockReminders');
      if (savedReminders) {
        try {
          const parsedReminders = JSON.parse(savedReminders);
          console.log("Loading reminders from localStorage:", parsedReminders);
          setReminders(parsedReminders);
        } catch (error) {
          console.error("Error parsing reminders from localStorage:", error);
        }
      }
    };
    
    // Initial reminders load
    loadRemindersFromStorage();
    
    return () => {
      window.removeEventListener('storage', loadCompaniesFromStorage);
    };
  }, []);

  // Modify the useEffect that handles responsive layout
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial state
    
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Only run on mount

  // Add a separate useEffect to update visible companies when transactions or window width changes
  useEffect(() => {
    // Get current companies data
    const threshold = windowWidth < 768 ? 2 : 
                      windowWidth < 992 ? 3 : 
                      windowWidth < 1200 ? 4 : 5;
    
    if (investedCompanies.length <= threshold) {
      // If we have fewer companies than the threshold, show them all
      setVisibleCompanies(investedCompanies);
      setDropdownCompanies([]);
    } else {
      // Otherwise, show the first few and put the rest in dropdown
      setVisibleCompanies(investedCompanies.slice(0, threshold));
      setDropdownCompanies(investedCompanies.slice(threshold));
    }
  }, [walletTransactions, companyNames, windowWidth]); // Dependencies that should trigger updates

  
  // Process company data to create wallet transactions
  
  // ... after your other useEffect hooks ...
/**
   * Calculates the total profit or loss for a single company by
   * iterating all of its transactions.
   * This function assumes the data structure from your Python script.
   */
/**
   * Calculates the total profit or loss for a single company by
   * iterating all of its transactions.
   */
const calculateCompanyPL = (company) => {
  if (!company || !company.transactions || company.transactions.length === 0) {
    return 0;
  }

  let totalRevenue = 0; // Total money from selling shares
  let totalCost = 0;    // Total money spent buying shares

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


// Add this new useEffect to process data for the charts
// Add this new useEffect to process data for the charts
useEffect(() => {
  if (!companiesData || companiesData.length === 0) {
    setPortfolioPieData(null);
    setClosedBarData(null);
    setOtherCompaniesList([]); 
    setClosedOtherCompaniesList([]); // <-- NEW
    return; 
  }

  // --- Stage 1: Pre-process data (unchanged) ---
  const processedData = companiesData.map(company => {
    // ... (This logic is unchanged) ...
    if (company.name === "_TransactionHistory" || !company.transactions || company.transactions.length === 0) {
      return company; 
    }
    const lastTx = company.transactions[company.transactions.length - 1];
    const totalShares = lastTx.totalShares || 0;
    if (totalShares === 0) {
      const closedPL = calculateCompanyPL(company);
      return {
        ...company,
        closedProfitLoss: closedPL,
        lastTransactionTime: new Date(lastTx.time) 
      };
    }
    return company; 
  });
  
  // --- Stage 2: Build charts ---

  // --- 1. Data for Portfolio Distribution Pie (Unchanged) ---
  // ... (This logic is unchanged) ...
  // --- 1. Data for Portfolio Distribution Pie (Unchanged) ---
  // ... (This logic is unchanged) ...
  // --- MODIFIED: Use a professional green/grey palette ---
// --- 1. Data for Portfolio Distribution Pie (Unchanged) ---
  // ... (This logic is unchanged) ...
  
  // -// --- 1. Data for Portfolio Distribution Pie (Unchanged) ---
  // ... (This logic is unchanged) ...
  
  // --- MODIFIED: Use a "Highlight" Palette (Green + Greys) ---
  const professionalColors = [
    '#4caf50', // Main Green (from --dark-success) FOR THE 1ST SLICE
    '#888888', // Medium Grey
    '#555555', // Dark Grey
    '#BBBBBB', // Light Grey
    '#707070', // Another Grey
    '#A0A0A0'  // Another Light Grey
  ];
  // This is the color for the "Other" slice
  const otherColor = '#4E4E4E';
  let grandTotalCost = 0;
  const companyCosts = [];
  const investmentCompanies = processedData.filter(
      company => company.name !== "_TransactionHistory" &&
                 company.transactions && 
                 company.transactions.length > 0
  );
  investmentCompanies.forEach(company => {
      const lastTx = company.transactions[company.transactions.length - 1];
      if (!lastTx) return; 
      const totalShares = lastTx.totalShares || 0;
      const totalCost = lastTx.totalInvestment || 0; 
      if (totalShares > 0 && totalCost > 0) {
          companyCosts.push({ name: company.name, cost: totalCost });
          grandTotalCost += totalCost;
      }
  });
  const activeLabels = [];
  const activeValues = [];
  const activeColors = [];
  let otherTotalCost = 0;
  const otherCompaniesRaw = []; 
  let colorIndex = 0;
  if (grandTotalCost > 0) { 
      companyCosts.sort((a, b) => b.cost - a.cost);
      companyCosts.forEach(company => {
          const percentage = (company.cost / grandTotalCost) * 100;
          if (percentage > 5) {
              activeLabels.push(company.name);
              activeValues.push(company.cost);
              
              activeColors.push(professionalColors[colorIndex % professionalColors.length]);
              colorIndex++;
          } else {
              otherTotalCost += company.cost;
              otherCompaniesRaw.push(company); 
          }
      });
  }
  if (otherTotalCost > 0) {
      activeLabels.push("Other");
      activeValues.push(otherTotalCost);
      activeColors.push(otherColor);
  }
  setOtherCompaniesList(otherCompaniesRaw); 
  if (activeLabels.length > 0) {
    setPortfolioPieData({
      labels: activeLabels,
      datasets: [{
        label: 'Active Portfolio (by Total Cost)',
        data: activeValues,
        backgroundColor: activeColors,
        borderColor: '#333',
        borderWidth: 1,
      }]
    });
  } else {
    setPortfolioPieData(null); 
  }

  // --- 2. Data for Closed Investments BAR CHART (NEW LOGIC) ---
  const profitColor = 'rgba(46, 204, 113, 0.8)'; 
  const lossColor = 'rgba(231, 76, 60, 0.8)';   
  const zeroColor = 'rgba(149, 165, 166, 0.8)';
  const otherBarColor = 'rgba(128, 128, 128, 0.8)'; // A different grey for "Other"

  const allClosedInvestments = processedData
    .filter(company => company.closedProfitLoss !== undefined)
    .map(c => ({ name: c.name, pnl: c.pnl || c.closedProfitLoss, time: c.lastTransactionTime })); // Standardize

  if (allClosedInvestments.length > 0) {
    // Pass 1: Find the max absolute P/L to set the threshold
    const maxPnl = Math.max(...allClosedInvestments.map(c => Math.abs(c.pnl)));
    const threshold = maxPnl * 0.10; // 10% of the max P/L

    // Pass 2: Separate significant investments from "Other"
    const significantLabels = [];
    const significantValues = [];
    const closedOtherRaw = [];
    let otherPnlTotal = 0;

    // Sort by time first, so the chart is still chronological
    allClosedInvestments.sort((a, b) => b.time - a.time);

    allClosedInvestments.forEach(company => {
      if (Math.abs(company.pnl) > threshold) {
        // This one is significant
        significantLabels.push(company.name);
        significantValues.push(company.pnl);
      } else {
        // Add to "Other"
        otherPnlTotal += company.pnl;
        closedOtherRaw.push(company);
      }
    });

    // Pass 3: Add the "Other" bar if it has data
    if (closedOtherRaw.length > 0) {
      // Add "Other" as the last bar
      significantLabels.push("Other (Small P/L)");
      significantValues.push(otherPnlTotal);
    }
    
    // Save the raw "Other" data to state for the modal
    setClosedOtherCompaniesList(closedOtherRaw.sort((a,b) => b.pnl - a.pnl)); // Sort by P/L

    // Pass 4: Set the final chart data
    setClosedBarData({
      labels: significantLabels, 
      datasets: [{
        label: 'Closed P/L',
        data: significantValues, 
        backgroundColor: (context) => {
          // Check if this is the "Other" bar
          if (context.label === 'Other (Small P/L)') {
            return otherBarColor;
          }
          const value = context.raw;
          if (value > 0) return profitColor;
          if (value < 0) return lossColor;
          return zeroColor;
        },
        borderColor: (context) => {
          if (context.label === 'Other (Small P/L)') {
            return otherBarColor;
          }
          const value = context.raw;
          if (value > 0) return profitColor;
          if (value < 0) return lossColor;
          return zeroColor;
        },
        borderWidth: 1,
      }]
    });

  } else {
    setClosedBarData(null); // No data
  }

}, [companiesData]);
  // Refresh data from localStorage
  const refreshData = () => {
    try {
      console.log("Performing complete data refresh");
      
      // Clear any existing state first to force a complete rebuild
      setWalletTransactions([]);
      
      const savedCompanies = localStorage.getItem('companies');
      if (savedCompanies) {
        const parsedCompanies = JSON.parse(savedCompanies);
        
        // Log the transaction history for debugging
        const transactionHistory = parsedCompanies.find(c => c.name === "_TransactionHistory");
        if (transactionHistory && Array.isArray(transactionHistory.transactions)) {
          console.log(`Found ${transactionHistory.transactions.length} transactions in history`);
          
          // Check for sell transactions
          const sellTransactions = transactionHistory.transactions.filter(tx => 
            tx.transactionType === 'sell' || 
            (tx.quantity && parseFloat(tx.quantity) < 0)
          );
          console.log(`Found ${sellTransactions.length} sell transactions in history`);
        }
        
        setCompaniesData(parsedCompanies);
        
        // Extract just the company names, excluding _TransactionHistory
        const names = parsedCompanies
          .map(company => company.name)
          .filter(name => name !== "_TransactionHistory");
        setCompanyNames(names);
        
        // Process company data to create wallet transactions
        processCompanyData(parsedCompanies);
        
        setSaveStatus('Data refreshed successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        console.log("No companies data found in localStorage");
        setSaveStatus('No data found to refresh.');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
      setSaveStatus('Error refreshing data.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };



  useEffect(() => {
    const handleRemindersImported = (event) => {
      console.log("Reminders-imported event received", event.detail);
      if (event.detail && event.detail.reminders) {
        setReminders(event.detail.reminders);
        console.log("Updated reminders state with imported data:", event.detail.reminders);
      }
    };
    
    // Listen for the custom event
    window.addEventListener('reminders-imported', handleRemindersImported);
    
    return () => {
      window.removeEventListener('reminders-imported', handleRemindersImported);
    };
  }, []);

  // Also add this effect to listen for localStorage changes
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === 'stockReminders') {
        try {
          const updatedReminders = JSON.parse(event.newValue || '[]');
          console.log("stockReminders changed in localStorage:", updatedReminders);
          setReminders(updatedReminders);
        } catch (error) {
          console.error("Error parsing reminders from storage event:", error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Update the handleAddReminder function
  const handleAddReminder = () => {
    if (!reminderStock || !reminderQuantity || !reminderPrice) {
      alert("Please enter stock name, quantity, and price");
      return;
    }

    const newReminder = {
      id: Date.now(),
      stock: reminderStock,
      quantity: reminderQuantity,
      price: reminderPrice,
      type: reminderType,
      createdAt: new Date().toISOString()
    };

    // Update local state
    const updatedReminders = [...reminders, newReminder];
    setReminders(updatedReminders);
    
    // Save to localStorage so it's included in the exported JSON file
    localStorage.setItem('stockReminders', JSON.stringify(updatedReminders));
    
    // Get the companies data to update with new reminder
    const savedCompanies = localStorage.getItem('companies');
    if (savedCompanies) {
      try {
        // Update the data in localStorage so it's picked up by the export function
        // This step ensures reminders are always part of the same data structure
        
        // Since we use localStorage as the intermediary storage before export,
        // we don't need to modify the actual JSON file directly
      } catch (error) {
        console.error("Error updating companies data with reminders:", error);
      }
    }
    
    // Clear the inputs
    setReminderStock('');
    setReminderQuantity('');
    setReminderPrice('');
    
    setSaveStatus('Reminder added successfully');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  // Update the handleDeleteReminder function
  const handleDeleteReminder = (id) => {
    const updatedReminders = reminders.filter(reminder => reminder.id !== id);
    setReminders(updatedReminders);
    
    // Save to localStorage so it's included in the exported JSON file
    localStorage.setItem('stockReminders', JSON.stringify(updatedReminders));
    
    setSaveStatus('Reminder deleted');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  // Add this to update the context when transactions change
  useEffect(() => {
    if (walletTransactions.length > 0) {
      // Find the last non-note transaction
      const lastNonNoteTransaction = [...walletTransactions]
        .reverse()
        .find(tx => !tx.isNote);
      
      if (lastNonNoteTransaction && lastNonNoteTransaction.extraMoneyCaused) {
        setExtraMoneyCaused(lastNonNoteTransaction.extraMoneyCaused);
      }
    }
  }, [walletTransactions, setExtraMoneyCaused]);

  // Replace your existing 'renderActiveInvestmentsTable' with this
  const renderActiveInvestmentsTable = () => {
    // Show a message if there are no transactions
    if (walletTransactions.length === 0) {
      return (
        <div className="wallet-table-container">
          <p>No transaction history found. Add a deposit or buy a stock to get started.</p>
        </div>
      );
    }

    return (
      <div className="wallet-table-container">
        <table className="wallet-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount in Wallet</th>
              <th>Extra Money (P/L)</th>
              {/* Dynamically create a header for each company */}
              {companyNames.map(name => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {walletTransactions.map(tx => {
              // --- Render a NOTE Row ---
              // These are for 'buy', 'sell', 'deposit', 'withdraw'
              if (tx.isNote) {
                return (
                  <tr key={tx.id} className="note-row">
                    {/* colSpan makes this cell take up the whole row */}
                    <td colSpan={companyNames.length + 3}>
                      {tx.note}
                    </td>
                  </tr>
                );
              }

              // --- Render a DATA Row ---
              // These are the rows that show the state *after* a transaction
              return (
                <tr key={tx.id} className="data-row">
                  <td>{new Date(tx.date).toLocaleDateString()}</td>
                  <td>₹{tx.amountInWallet.toFixed(2)}</td>
                  
                  {/* Add 'profit' or 'loss' class for styling */}
                  <td className={
                    tx.extraMoneyCaused > 0 ? 'profit' :
                    tx.extraMoneyCaused < 0 ? 'loss' : ''
                  }>
                    ₹{tx.extraMoneyCaused.toFixed(2)}
                  </td>
                  
                  {/* Dynamically show the value for each company */}
                  {companyNames.map(name => (
                    <td key={name}>
                      ₹{(tx.companyInvestments[name] || 0).toFixed(2)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // We will leave this one as a placeholder for now
  const renderZeroInvestmentsTable = () => {
    return (
      <div className="table-placeholder">
        <h2>Zero Investments Table</h2>
        <p>This table will show companies you no longer hold.</p>
      </div>
    );
  };

  // --- ADD THIS NEW CLICK HANDLER FOR THE BAR CHART ---
  const handleClosedChartClick = (event) => {
    const chart = closedChartRef.current;
    if (!chart || !closedBarData) return; // Exit if no chart or data

    const elements = getElementAtEvent(chart, event);
    if (!elements || elements.length === 0) {
      return; // Exit if user didn't click a bar
    }

    const elementIndex = elements[0].index;
    const label = closedBarData.labels[elementIndex];

    // Check if the clicked bar is the "Other" bar
    if (label === 'Other (Small P/L)') {
      // Prepare the data for the modal
      // We already sorted this in the useEffect
      const modalData = closedOtherCompaniesList.map(company => ({
        name: company.name,
        pnl: company.pnl,
      }));
      
      setClosedOtherModalData(modalData);
      setShowClosedOtherModal(true);
    }
  };
  // --- ADD THIS NEW CLICK HANDLER FUNCTION ---
  const handleChartClick = (event) => {
    const chart = portfolioChartRef.current;
    if (!chart || !portfolioPieData) return; // Exit if no chart or data

    const elements = getElementAtEvent(chart, event);
    if (!elements || elements.length === 0) {
      return; // Exit if user didn't click a slice
    }

    const elementIndex = elements[0].index;
    const label = portfolioPieData.labels[elementIndex];

    // Check if the clicked slice is the "Other" slice
    if (label === 'Other') {
      // Calculate the grand total cost to get correct percentages
      const grandTotalCost = portfolioPieData.datasets[0].data.reduce((a, b) => a + b, 0);

      // Prepare the data for the modal
      const modalData = otherCompaniesList.map(company => ({
        name: company.name,
        cost: company.cost,
        // Calculate percentage of the *total* portfolio
        percentage: (company.cost / grandTotalCost) * 100 
      }))
      .sort((a, b) => b.cost - a.cost); // Sort by cost, largest first
      
      setOtherModalData(modalData);
      setShowOtherModal(true);
    }
  };
  
  return (
    <div className="wallet-tracker-container">
      <div className="wallet-header">
        
      </div>
      
      <div className={`utility-panel-container ${showUtilityPanel ? 'open' : ''}`}>
        <span className="arrow-icon" onClick={() => setShowUtilityPanel(!showUtilityPanel)}>{showUtilityPanel ? '▲' : '▼'}</span>
        
        <div className="utility-panel">
          <div className="utility-section">
            <h3>Wallet Management</h3>
            <div className="wallet-transaction-section">
              <input
                type="number"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                placeholder="Enter amount"
                className="wallet-amount-input"
              />
              <div className="wallet-buttons">
                <button 
                  className="deposit-button"
                  onClick={() => {
                    handleAddMoneyToWallet(walletAmount); 
                    setWalletAmount('');
                    setShowUtilityPanel(false);
                  }}
                >
                  Add Money
                </button>
                <button 
                  className="withdraw-button"
                  onClick={() => {
                    handleWithdrawMoneyFromWallet(walletAmount);
                    setWalletAmount('');
                    setShowUtilityPanel(false);
                  }}
                >
                  Withdraw Money
                </button>
              </div>
            </div>
          </div>
          
          <div className="utility-section">
            <h3>Actions</h3>
            <div className="utility-buttons">
              <button 
                className="utility-button"
                onClick={() => {refreshData(); setShowUtilityPanel(false);}}
                title="Refresh data from localStorage"
              >
                Refresh Data
              </button>
              
              <button 
                className="utility-button"
                onClick={() => {setShowReminderModal(true); setShowUtilityPanel(false);}}
                title="Set reminders for stocks to buy"
              >
                Stock Reminders
              </button>
              
              <button 
                className="utility-button"
                onClick={() => {setShowInfoModal(true); setShowUtilityPanel(false);}}
                title="View information about wallet calculations"
              >
                Wallet Information
              </button>
            </div>
          </div>
        </div>
      </div>
   
      
        {/* === ADD THIS TOGGLE BUTTON SECTION === */}
      {/* === THIS IS THE NEW JSX === */}
      <div className="chart-toggle-buttons">
        <button 
          className={`toggle-button ${chartView === 'active' ? 'active' : ''}`}
          onClick={() => setChartView('active')}
        >
          Active Portfolio
        </button>
        <button 
          className={`toggle-button ${chartView === 'closed' ? 'active' : ''}`}
          onClick={() => setChartView('closed')}
        >
          Closed Positions
        </button>
      </div>

      {/* The 'view-active' or 'view-closed' class will be used on mobile */}
      <div className={`charts-container view-${chartView}`}>
        
        {/* --- Active Chart (Always rendered) --- */}
        <div className="chart-wrapper" id="active-chart-wrapper">
          {portfolioPieData ? (
            <>
              <h3>Portfolio Distribution</h3>
              <Pie 
                ref={portfolioChartRef}
                onClick={handleChartClick}
                data={portfolioPieData} 
                options={{
                  responsive: true,
                  cutout: '60%', // Makes it a doughnut
                  plugins: { 
                    
                    // --- 1. KEEPS the legend on the right ---
                    legend: { 
                      display: true,
                      position: 'right',
                      labels: {
                        color: 'rgba(255, 255, 255, 0.6)', // Sets legend text to grey
                        padding: 20,
                        font: {
                          size: 14
                        }
                      }
                    },
                    
                    // --- 2. TURNS OFF the messy label on the chart ---
                    datalabels: {
                      display: false,
                    },

                    // --- 3. KEEPS your good tooltip ---
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const label = context.label || '';
                          const value = context.parsed;
                          const sum = context.dataset.data.reduce((a, b) => a + b, 0);
                          const percentage = (value * 100 / sum).toFixed(1) + '%';
                          const formattedValue = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
                          return `${label}: ${formattedValue} (${percentage})`;
                        }
                      }
                    }
                  }
                }}
              />
            </>
          ) : (
            <div className="chart-wrapper-empty">
              <h3>Portfolio Distribution</h3>
              <p>No active investments to display.</p>
            </div>
          )}
        </div>
        
        {/* --- Closed Chart (Always rendered) --- */}
        <div className="chart-wrapper" id="closed-chart-wrapper">
          {closedBarData ? (
            <>
              <h3>Closed Positions (Total P/L)</h3>
              <Bar 
                ref={closedChartRef}
                onClick={handleClosedChartClick}
                data={closedBarData} 
                options={{
                  responsive: true,
                  barPercentage: 0.8,
                  categoryPercentage: 0.8,
                  plugins: { 
                    legend: { display: false },
                    datalabels: { display: false },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          let label = context.dataset.label || '';
                          if (label) { label += ': '; }
                          if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(context.parsed.y);
                          }
                          return label;
                        }
                      }
                    }
                  },
                  scales: {
                    x: { ticks: { color: '#eee', display: false }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    y: { ticks: { color: '#eee', callback: (value) => '₹' + value.toLocaleString() }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                  }
                }} 
              />
              <div className="chart-note">Hover over bars to see company details</div>
            </>
          ) : (
            <div className="chart-wrapper-empty">
              <h3>Closed Positions (Total P/L)</h3>
              <p>No closed positions to display.</p>
            </div>
          )}
        </div>
        
      </div>
      
      
      
      {/* Add reminder modal */}
      {showReminderModal && (
        <div className="modal-overlay">
          <div className="modal-content reminder-modal">
            <div className="modal-header">
              <h2>Stock Reminders</h2>
              <button 
                className="modal-close"
                onClick={() => setShowReminderModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="reminder-form">
                <div className="form-group">
                  <label htmlFor="reminderStock">Stock Name</label>
                  <input 
                    type="text" 
                    id="reminderStock"
                    value={reminderStock}
                    onChange={(e) => setReminderStock(e.target.value)}
                    placeholder="Enter stock name"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="reminderQuantity">Quantity</label>
                  <input 
                    type="number" 
                    id="reminderQuantity"
                    value={reminderQuantity}
                    onChange={(e) => setReminderQuantity(e.target.value)}
                    placeholder="Enter quantity"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="reminderPrice">At what price (₹)</label>
                  <input 
                    type="number" 
                    id="reminderPrice"
                    value={reminderPrice}
                    onChange={(e) => setReminderPrice(e.target.value)}
                    placeholder="Enter target price"
                  />
                </div>
                
                <div className="form-group">
                  <label>Transaction Type</label>
                  <div className="transaction-type-selector">
                    <button 
                      type="button"
                      className={`transaction-type-button ${reminderType === 'buy' ? 'active' : ''}`}
                      onClick={() => setReminderType('buy')}
                    >
                      Buy
                    </button>
                    <button 
                      type="button"
                      className={`transaction-type-button ${reminderType === 'sell' ? 'active' : ''}`}
                      onClick={() => setReminderType('sell')}
                    >
                      Sell
                    </button>
                  </div>
                </div>
                
                <button 
                  className="add-reminder-button"
                  onClick={handleAddReminder}
                >
                  Add Reminder
                </button>
              </div>

              <div className="reminders-list">
                <h3>
                  Your Reminders
                  {reminders.length > 0 && (
                    <span className="reminders-count">{reminders.length}</span>
                  )}
                </h3>
                
                {reminders.length === 0 ? (
                  <p className="no-reminders">No reminders set</p>
                ) : (
                  <table className="reminders-table">
                    <thead>
                      <tr>
                        <th>Stock</th>
                        <th>Qtn</th>
                        <th>Price (₹)</th>
                        <th>Type</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reminders.map(reminder => (
                        <tr key={reminder.id} className={`reminder-row reminder-${reminder.type}`}>
                          <td>{reminder.stock}</td>
                          <td>{reminder.quantity}</td>
                          <td>₹{reminder.price}</td>
                          <td>
                            <span className={`reminder-tag ${reminder.type}`}>
                              {reminder.type.charAt(0).toUpperCase() + reminder.type.slice(1)}
                            </span>
                          </td>
                          <td>
                            <button 
                              className="delete-reminder-button"
                              onClick={() => handleDeleteReminder(reminder.id)}
                              title="Delete reminder"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showInfoModal && (
        <div className="modal-overlay">
          <div className="modal-content info-modal">
            <div className="modal-header">
              <h2>Wallet Calculation Information</h2>
              <button 
                className="modal-close"
                onClick={() => setShowInfoModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <ul>
                <li><strong>Transaction ID:</strong> Unique number for each transaction row.</li>
                <li><strong>Amount in Wallet:</strong> Current cash balance available.</li>
                <li><strong>Company Columns:</strong> Current investment value in each stock.</li>
                <li><strong>Extra Money Caused:</strong> Profit/loss from selling stocks.</li>
                <li><strong>Text Rows:</strong> Notes explaining transactions like buys/sells.</li>
                <li><strong>▶ Button:</strong> Expands to show individual buy transactions.</li>
                <li><strong>Green Values:</strong> Indicate profits from selling stocks.</li>
                <li><strong>Red Values:</strong> Indicate losses from selling stocks.</li>
                <li><strong>Active/Zero Tabs:</strong> Switch between current and past investments.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      {/* ... your other modals (reminder, info) ... */}
      {showClosedOtherModal && (
        <div className="modal-overlay" onClick={() => setShowClosedOtherModal(false)}>
          <div className="modal-content info-modal other-companies-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>"Other" Closed Positions (Small P/L)</h2>
              <button 
                className="modal-close"
                onClick={() => setShowClosedOtherModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <table className="other-companies-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Total Profit/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {closedOtherModalData.map(company => (
                    <tr key={company.name}>
                      <td>{company.name}</td>
                      {/* Add profit/loss class for color */}
                      <td className={
                        company.pnl > 0 ? 'profit' :
                        company.pnl < 0 ? 'loss' : ''
                      }>
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(company.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* --- ADD THIS NEW MODAL FOR "OTHER" COMPANIES --- */}
      {showOtherModal && (
        <div className="modal-overlay" onClick={() => setShowOtherModal(false)}>
          <div className="modal-content info-modal other-companies-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>"Other" Investments (&lt; 5% Each)</h2>
              <button 
                className="modal-close"
                onClick={() => setShowOtherModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <table className="other-companies-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Total Cost</th>
                    <th>% of Portfolio</th>
                  </tr>
                </thead>
                <tbody>
                  {otherModalData.map(company => (
                    <tr key={company.name}>
                      <td>{company.name}</td>
                      <td>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(company.cost)}</td>
                      <td>{company.percentage.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      

    </div>
  );
};

export default WalletTracker;