import React, { useState, useEffect } from 'react';
import './WalletTracker.css';

const WalletTracker = () => {
  // State for companies and their data from localStorage
  const [companiesData, setCompaniesData] = useState([]);
  const [companyNames, setCompanyNames] = useState([]);
  
  // Wallet transactions state (separate from investment transactions)
  const [walletTransactions, setWalletTransactions] = useState([]);
  
  // State for adding money to wallet
  const [depositAmount, setDepositAmount] = useState('');
  // State for withdrawing money from wallet
  const [withdrawAmount, setWithdrawAmount] = useState('');

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
  const [reminderPrice, setReminderPrice] = useState('');
  const [reminderNote, setReminderNote] = useState('');

  // Add these state variables at the top of the component
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [visibleCompanies, setVisibleCompanies] = useState([]);
  const [dropdownCompanies, setDropdownCompanies] = useState([]);

  // Add these new state variables at the top of the component
  const [expandedBuyRows, setExpandedBuyRows] = useState([]);
  const [individualBuyTransactions, setIndividualBuyTransactions] = useState({});

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
    const savedReminders = localStorage.getItem('stockReminders');
    if (savedReminders) {
      try {
        setReminders(JSON.parse(savedReminders));
      } catch (error) {
        console.error("Error parsing reminders from localStorage:", error);
      }
    }
    
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
    const { investedCompanies } = getTableColumns();
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
  const processCompanyData = (companies) => {
    try {
      // Find the transaction history record
      const transactionHistory = companies.find(c => c.name === "_TransactionHistory");
      
      // If there's no transaction history, we can't proceed correctly
      if (!transactionHistory || !Array.isArray(transactionHistory.transactions) || transactionHistory.transactions.length === 0) {
        console.log("No transaction history found, using fallback method");
        return;
      }
      
      console.log("Processing transaction history with", transactionHistory.transactions.length, "transactions");
      
      // Initialize wallet amount and investments
      let currentWalletAmount = 0;
      const initialInvestments = {};
      companies.forEach(company => {
        if (company.name !== "_TransactionHistory") {
          initialInvestments[company.name] = '0';
        }
      });
      
      // FIFO tracking for each company
      const fifoSharesByCompany = {};
      companyNames.forEach(name => {
        fifoSharesByCompany[name] = [];
      });
      
      // Sort the transaction history by globalIndex
      const sortedTransactions = [...transactionHistory.transactions].sort((a, b) => a.globalIndex - b.globalIndex);
      
      // Create wallet rows in the same order as the transaction history
      let walletRows = [];
      let rowId = 1;
      let currentInvestments = {...initialInvestments};
      let extraMoneyCaused = 0;
      
      // Variables to track combined buy transactions
      let pendingBuyRow = null;
      let hasPendingBuys = false;
      let pendingBuyDetails = []; // Array to store individual buy transaction details
      let allBuyTransactions = {}; // Store all buy transactions here instead of using setState
      
      // Process each transaction in the global order
      for (const historyRecord of sortedTransactions) {
        const { companyName, transactionNumber, type, amount, transactionType, quantity: recordedQuantity } = historyRecord;
        
        // Handle wallet deposits and withdrawals
        if (companyName === "Wallet") {
          // If we have pending buy transactions, add them first
          if (hasPendingBuys && pendingBuyRow) {
            // Store the individual buy transactions with this row ID
            pendingBuyRow.hasBuyTransactions = true;
            pendingBuyRow.buyTransactionCount = pendingBuyDetails.length;
            
            walletRows.push(pendingBuyRow);
            
            // Store buy transactions in our local object
            if (pendingBuyRow.id) {
              allBuyTransactions[pendingBuyRow.id] = [...pendingBuyDetails];
            }
            
            rowId++;
            hasPendingBuys = false;
            pendingBuyRow = null;
            pendingBuyDetails = [];
          }
          
          const transactionAmount = parseFloat(amount) || 0;
          
          if (type === "deposit" && transactionAmount > 0) {
            // Create note row for the deposit
            const noteRow = {
              id: `note-${rowId}`,
              note: `Added ₹${transactionAmount.toFixed(3)} to wallet`,
              isNote: true
            };
            
            // Update wallet amount
            currentWalletAmount += transactionAmount;
            
            // Create transaction row
            const depositRow = {
              id: rowId++,
              walletAmount: currentWalletAmount.toFixed(3),
              investments: {...currentInvestments},
              extraMoneyCaused: extraMoneyCaused.toFixed(3),
              isNote: false
            };
            
            // Add rows
            walletRows.push(noteRow, depositRow);
          } else if (type === "withdraw" && transactionAmount > 0) {
            // Create note row for the withdrawal
            const noteRow = {
              id: `note-${rowId}`,
              note: `Withdrew ₹${transactionAmount.toFixed(3)} from wallet`,
              isNote: true
            };
            
            // Update wallet amount
            currentWalletAmount -= transactionAmount;
            
            // Create transaction row
            const withdrawRow = {
              id: rowId++,
              walletAmount: currentWalletAmount.toFixed(3),
              investments: {...currentInvestments},
              extraMoneyCaused: extraMoneyCaused.toFixed(3),
              isNote: false
            };
            
            // Add rows
            walletRows.push(noteRow, withdrawRow);
          }
          continue;
        }
        
        // Handle buy/sell transactions
        const company = companies.find(c => c.name === companyName);
        if (!company || !Array.isArray(company.transactions)) {
          console.log(`Company ${companyName} not found or has no transactions`);
          continue;
        }
        
        // Find the specific transaction using the transaction number
        const tx = company.transactions.find(t => t.id === transactionNumber);
        if (!tx) {
          console.log(`Transaction #${transactionNumber} for ${companyName} not found`);
          continue;
        }
        
        const price = parseFloat(tx.price) || 0;
        const quantity = parseFloat(tx.quantity) || 0;
        
        if (price === 0 || quantity === 0) {
          console.log(`Skipping ${companyName} transaction with invalid price/quantity`);
          continue;
        }
        
        // Determine if this is a buy or sell transaction
        const isSellTransaction = transactionType === 'sell' || 
                                 (recordedQuantity && parseFloat(recordedQuantity) < 0) || 
                                 quantity < 0;
        
        if (!isSellTransaction) {
          // Buy transaction
          const charges = parseFloat(tx.extraCharges) || 0;
          
          // Add to FIFO tracking
          if (!fifoSharesByCompany[companyName]) {
            fifoSharesByCompany[companyName] = [];
          }
          
          fifoSharesByCompany[companyName].push({
            price: price,
            quantity: quantity,
            remaining: quantity,
            transactionId: transactionNumber
          });
          
          // Update investments and wallet
          const totalCost = (price * quantity) + charges;
          currentWalletAmount -= totalCost;
          currentInvestments[companyName] = (parseFloat(currentInvestments[companyName] || 0) + totalCost).toFixed(3);
          
          // Save individual buy transaction details
          pendingBuyDetails.push({
            id: `buy-${transactionNumber}`,
            companyName,
            price,
            quantity,
            charges,
            totalCost,
            transactionId: transactionNumber,
            timestamp: new Date().toISOString()
          });
          
          if (!hasPendingBuys) {
            // Create a new row if this is the first buy
            pendingBuyRow = {
              id: rowId,
              walletAmount: currentWalletAmount.toFixed(3),
              investments: {...currentInvestments},
              extraMoneyCaused: extraMoneyCaused.toFixed(3),
              isNote: false,
              hasBuyTransactions: true,
              buyTransactionCount: pendingBuyDetails.length
            };
            hasPendingBuys = true;
          } else {
            // Update the existing pending buy row with the latest values
            pendingBuyRow = {
              ...pendingBuyRow,
              walletAmount: currentWalletAmount.toFixed(3),
              investments: {...currentInvestments},
              extraMoneyCaused: extraMoneyCaused.toFixed(3),
              buyTransactionCount: pendingBuyDetails.length
            };
          }
        } else {
          // Sell transaction
          console.log(`Processing SELL transaction for ${companyName}`);
          
          // First, add any pending buy transactions as a single row
          if (hasPendingBuys && pendingBuyRow) {
            // Store the individual buy transactions with this row ID
            pendingBuyRow.hasBuyTransactions = true;
            pendingBuyRow.buyTransactionCount = pendingBuyDetails.length;
            
            walletRows.push(pendingBuyRow);
            
            // Store buy transactions in our local object
            if (pendingBuyRow.id) {
              allBuyTransactions[pendingBuyRow.id] = [...pendingBuyDetails];
            }
            
            rowId++;
            hasPendingBuys = false;
            pendingBuyRow = null;
            pendingBuyDetails = [];
          }
          
          // Note: Each sell transaction always creates a new row in the wallet tracker,
          // so sell transactions that follow a withdrawal will naturally appear on a new row
          
          const sellQuantity = Math.abs(quantity);
          const sellPrice = price;
          const sellValue = sellPrice * sellQuantity;
          
          // Calculate profit/loss using FIFO
          let costBasisOfSoldShares = 0;
          let remainingToSell = sellQuantity;
          let usedLots = []; // Track which lots we used for this sell transaction
          
          const fifoShares = fifoSharesByCompany[companyName] || [];
          for (let i = 0; i < fifoShares.length && remainingToSell > 0; i++) {
            const lot = fifoShares[i];
            if (lot.remaining > 0) {
              const sharesToSellFromLot = Math.min(lot.remaining, remainingToSell);
              costBasisOfSoldShares += (lot.price * sharesToSellFromLot);
              
              // Track this lot and how many shares we sold from it
              usedLots.push({
                index: i,
                sharesSold: sharesToSellFromLot,
                originalShares: lot.quantity,
                transactionId: lot.transactionId // Store the transaction ID
              });
              
              lot.remaining -= sharesToSellFromLot;
              remainingToSell -= sharesToSellFromLot;
            }
          }
          
          // Get buy transaction charges for the specific lots used
          let totalBuyCharges = 0;
          if (company.transactions.length > 0 && usedLots.length > 0) {
            // For each lot that was used in this sell
            for (const lot of usedLots) {
              // Find the corresponding buy transaction by ID
              const buyTx = company.transactions.find(t => t.id === lot.transactionId);
              
              if (buyTx) {
                // Calculate proportion of this buy transaction's charges to include
                const proportion = lot.sharesSold / lot.originalShares;
                const txCharges = parseFloat(buyTx.extraCharges) || 0;
                totalBuyCharges += txCharges * proportion;
              }
            }
          }
          
          // Get ONLY the sell transaction's extra charges
          const sellExtraCharges = parseFloat(tx.extraCharges) || 0;
          
          // Calculate profit/loss with correct precision - using cost basis + all charges
          // Using original purchase price of sold shares + all buy charges + sell transaction charges
          const profitLoss = sellValue - costBasisOfSoldShares - totalBuyCharges - sellExtraCharges;
          extraMoneyCaused += profitLoss;
          
          // Create note text
          const isProfitable = profitLoss >= 0;
          const profitLossText = isProfitable ? 
            `Profit: ₹${profitLoss.toFixed(3)}` : 
            `Loss: ₹${Math.abs(profitLoss).toFixed(3)}`;
          
          // MODIFIED: Subtract ONLY sell transaction charges from sell value
          const netSellProceeds = sellValue - sellExtraCharges;
          
          // Updated note row to include cost basis and all charges
          const noteRow = {
            id: `note-${rowId}`,
            note: `Sold ${sellQuantity} shares of ${companyName} for ₹${sellValue.toFixed(3)} (original cost: ₹${costBasisOfSoldShares.toFixed(3)}, FIFO buy charges: ₹${totalBuyCharges.toFixed(3)}, sell charges: ₹${sellExtraCharges.toFixed(3)}) - ${profitLossText}`,
            isNote: true
          };
          
          // Update wallet amount by subtracting ONLY the sell transaction charges
          currentWalletAmount += netSellProceeds;
          
          // Check if all shares are sold (no remaining shares in any lot)
          const allSharesSold = fifoShares.every(lot => lot.remaining === 0);
          
          // Update investments based on whether all shares were sold or not
          if (allSharesSold) {
            // If all shares are sold, set investment to 0
            currentInvestments[companyName] = '0.000';
          } else if (company.transactions.length > 0) {
            // If some shares remain, use the remaining investment value
            const sortedCompanyTxs = [...company.transactions].sort((a, b) => a.id - b.id);
            const lastTx = sortedCompanyTxs[sortedCompanyTxs.length - 1];
            
            if (lastTx.totalInvestment !== undefined) {
              currentInvestments[companyName] = lastTx.totalInvestment.toFixed(3);
            }
          }
          
          // Create transaction row
          const sellRow = {
            id: rowId++,
            walletAmount: currentWalletAmount.toFixed(3),
            investments: {...currentInvestments},
            extraMoneyCaused: extraMoneyCaused.toFixed(3),
            isNote: false
          };
          
          // Add rows
          walletRows.push(noteRow, sellRow);
          
          // Start a new row counter for the next set of buy transactions
          rowId++;
        }
      }
      
      // Add any pending buy transactions at the end
      if (hasPendingBuys && pendingBuyRow) {
        // Store the individual buy transactions with this row ID
        pendingBuyRow.hasBuyTransactions = true;
        pendingBuyRow.buyTransactionCount = pendingBuyDetails.length;
        
        walletRows.push(pendingBuyRow);
        
        // Store buy transactions in our local object
        if (pendingBuyRow.id) {
          allBuyTransactions[pendingBuyRow.id] = [...pendingBuyDetails];
        }
      }
      
      // If no transactions were processed, add a default row
      if (walletRows.length === 0) {
        walletRows.push({
          id: 1,
          walletAmount: '0.000',
          investments: initialInvestments,
          extraMoneyCaused: '0.000',
          isNote: false
        });
      }
      
      console.log(`Created ${walletRows.length} wallet rows from ${sortedTransactions.length} transactions`);
      
      // Set all state at once to avoid intermediate renders
      setWalletTransactions(walletRows);
      setIndividualBuyTransactions(allBuyTransactions);
      
    } catch (error) {
      console.error("Error processing company data:", error);
    }
  };

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

// Handle adding money to wallet
const handleAddMoneyToWallet = () => {
  try {
    // Validate input
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setSaveStatus('Please enter a valid positive amount');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }
    
      // Check if this is the first transaction or wallet is empty
      if (walletTransactions.length === 0) {
        // Create an initial wallet structure with empty investments
        const initialInvestments = {};
        companyNames.forEach(name => {
          if (name !== "_TransactionHistory") {
            initialInvestments[name] = '0';
          }
        });
        
        // Create a note row for the first deposit
        const noteRow = {
          id: `note-1`,
          note: `Added ₹${amount.toFixed(3)} to wallet`,
          isNote: true
        };
        
        // Create the transaction row
        const newTransaction = {
          id: 1,
          walletAmount: amount.toFixed(3),
          investments: initialInvestments,
          extraMoneyCaused: '0.000',
          isNote: false
        };
        
        // Set wallet transactions directly
        setWalletTransactions([noteRow, newTransaction]);
      } else {
        // Normal case - existing transactions
    const lastTransaction = walletTransactions[walletTransactions.length - 1];
        const newWalletAmount = (parseFloat(lastTransaction.walletAmount) + amount).toFixed(3);
    const nextId = lastTransaction.id + 1;
    
    // Create a note row
    const noteRow = {
      id: `note-${nextId}`,
          note: `Added ₹${amount.toFixed(3)} to wallet`,
      isNote: true
    };
    
    // Create the transaction row
    const newTransaction = {
      id: nextId,
      walletAmount: newWalletAmount,
      investments: {...lastTransaction.investments},
          extraMoneyCaused: lastTransaction.extraMoneyCaused || '0.000',
      isNote: false
    };
    
    // Update transaction rows
    setWalletTransactions([...walletTransactions, noteRow, newTransaction]);
      }
    
    // Create a wallet deposit transaction in the main transaction history
    const timestamp = Date.now();
    const allCompanies = JSON.parse(localStorage.getItem('companies')) || [];
    
    // Find or create the special _TransactionHistory record
    let transactionHistory = allCompanies.find(c => c.name === "_TransactionHistory");
    if (!transactionHistory) {
      transactionHistory = {
        name: "_TransactionHistory",
        transactions: []
      };
      allCompanies.push(transactionHistory);
    }
    
    // Add this wallet deposit to the transaction history
    const nextGlobalIndex = transactionHistory.transactions.length + 1;
    transactionHistory.transactions.push({
      globalIndex: nextGlobalIndex,
      companyName: "Wallet",
      transactionNumber: timestamp,
      type: "deposit",
        amount: amount.toFixed(3),
      date: new Date().toISOString()
    });
    
    // Save back to localStorage
    localStorage.setItem('companies', JSON.stringify(allCompanies));
    
    // Clear input
    setDepositAmount('');
    
    setSaveStatus('Money added to wallet successfully!');
    setTimeout(() => setSaveStatus(''), 3000);
  } catch (error) {
    console.error("Error adding money to wallet:", error);
    setSaveStatus('Error adding money. Please try again.');
  }
};

  // Handle withdrawing money from wallet
  const handleWithdrawMoneyFromWallet = () => {
    try {
      // Validate input
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        setSaveStatus('Please enter a valid positive amount');
        setTimeout(() => setSaveStatus(''), 3000);
        return;
      }
      
      // Check if wallet is empty or no transactions exist
      if (walletTransactions.length === 0) {
        setSaveStatus('No money in wallet. Please add money first.');
        setTimeout(() => setSaveStatus(''), 3000);
        return;
      }
      
      // Get current wallet balance
      const lastTransaction = walletTransactions[walletTransactions.length - 1];
      const currentBalance = parseFloat(lastTransaction.walletAmount);
      
      // Check if there's enough money in the wallet
      if (amount > currentBalance) {
        setSaveStatus('Not enough money in wallet');
        setTimeout(() => setSaveStatus(''), 3000);
        return;
      }
      
      // Calculate new wallet amount
      const newWalletAmount = (currentBalance - amount).toFixed(3);
      const nextId = lastTransaction.id + 1;
      
      // Create a note row
      const noteRow = {
        id: `note-${nextId}`,
        note: `Withdrew ₹${amount.toFixed(3)} from wallet`,
        isNote: true
      };
      
      // Create the transaction row
      const newTransaction = {
        id: nextId,
        walletAmount: newWalletAmount,
        investments: {...lastTransaction.investments},
        extraMoneyCaused: lastTransaction.extraMoneyCaused || '0.000',
        isNote: false
      };
      
      // Update transaction rows
      setWalletTransactions([...walletTransactions, noteRow, newTransaction]);
      
      // Create a wallet withdrawal transaction in the main transaction history
      const timestamp = Date.now();
      const allCompanies = JSON.parse(localStorage.getItem('companies')) || [];
      
      // Find or create the special _TransactionHistory record
      let transactionHistory = allCompanies.find(c => c.name === "_TransactionHistory");
      if (!transactionHistory) {
        transactionHistory = {
          name: "_TransactionHistory",
          transactions: []
        };
        allCompanies.push(transactionHistory);
      }
      
      // Add this wallet withdrawal to the transaction history
      const nextGlobalIndex = transactionHistory.transactions.length + 1;
      transactionHistory.transactions.push({
        globalIndex: nextGlobalIndex,
        companyName: "Wallet",
        transactionNumber: timestamp,
        type: "withdraw",
        amount: amount.toFixed(3),
        date: new Date().toISOString()
      });
      
      // Save back to localStorage
      localStorage.setItem('companies', JSON.stringify(allCompanies));
      
      // Clear input
      setWithdrawAmount('');
      
      setSaveStatus('Money withdrawn from wallet successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
      
      // Force refresh the data to ensure proper row display after withdrawal
      refreshData();
    } catch (error) {
      console.error("Error withdrawing money from wallet:", error);
      setSaveStatus('Error withdrawing money. Please try again.');
    }
  };

  // Add this function to record all transactions
  const recordTransaction = (companyName, transactionNumber) => {
    try {
      console.log(`WalletTracker: Attempting to record transaction for ${companyName}, transaction #${transactionNumber}`);
      
      // Get all companies data
      const savedCompanies = localStorage.getItem('companies');
      if (!savedCompanies) return;
      
      const companies = JSON.parse(savedCompanies);
      
      // Find the company to get transaction details
      const company = companies.find(c => c.name === companyName);
      if (!company || !Array.isArray(company.transactions)) {
        console.error(`Company ${companyName} not found or has no transactions`);
        return;
      }
      
      // Find the specific transaction
      const transaction = company.transactions.find(t => t.id === transactionNumber);
      if (!transaction) {
        console.error(`Transaction #${transactionNumber} for ${companyName} not found`);
        return;
      }
      
      // Check the transaction type (buy/sell) based on quantity
      const quantity = parseFloat(transaction.quantity) || 0;
      const transactionType = quantity < 0 ? "sell" : "buy";
      
      console.log(`Recording ${transactionType} transaction for ${companyName}, Price: ${transaction.price}, Quantity: ${quantity}`);
      
      // Find or create the special transactions record
      let transactionsRecord = companies.find(c => c.name === "_TransactionHistory");
      
      if (!transactionsRecord) {
        // Create new transaction history record if it doesn't exist
        transactionsRecord = {
          name: "_TransactionHistory",
          transactions: []
        };
        companies.push(transactionsRecord);
      }
      
      // Check if this exact transaction is already recorded
      const transactionExists = transactionsRecord.transactions.some(
        tx => tx.companyName === companyName && tx.transactionNumber === transactionNumber
      );
      
      // Only add if this transaction doesn't already exist in the history
      if (!transactionExists) {
        // Get the next global index
        const nextGlobalIndex = transactionsRecord.transactions.length + 1;
        
        // Add the new transaction with more details
        transactionsRecord.transactions.push({
          globalIndex: nextGlobalIndex,
          companyName: companyName,
          transactionNumber: transactionNumber,
          transactionType: transactionType,
          date: new Date().toISOString(),
          price: transaction.price,
          quantity: transaction.quantity
        });
        
        // Save back to localStorage
        localStorage.setItem('companies', JSON.stringify(companies));
        
        console.log(`Successfully recorded ${transactionType} transaction for ${companyName} with global index ${nextGlobalIndex}`);
      } else {
        console.log(`Transaction for ${companyName} #${transactionNumber} already recorded`);
      }
    } catch (error) {
      console.error("Error recording transaction:", error);
    }
  };

  // Update the getTableColumns function to sort zero-investment companies by most recently sold
  const getTableColumns = () => {
    if (!walletTransactions.length || !companyNames.length) {
      return {
        investedCompanies: [],
        zeroInvestmentCompanies: []
      };
    }
    
    // Use the last transaction to determine current investments
    const lastTransaction = walletTransactions[walletTransactions.length - 1];
    if (!lastTransaction || !lastTransaction.investments) {
      return {
        investedCompanies: [],
        zeroInvestmentCompanies: []
      };
    }
    
    // Filter out TransactionHistory
    const filteredCompanies = companyNames.filter(name => name !== "_TransactionHistory");
    
    // Separate companies into those with investments and those without
    const investedCompanies = [];
    const zeroInvestmentCompanies = [];
    
    filteredCompanies.forEach(company => {
      const investment = parseFloat(lastTransaction.investments[company] || '0');
      if (investment > 0) {
        investedCompanies.push(company);
      } else {
        zeroInvestmentCompanies.push(company);
      }
    });
    
    // Find companies with recent sell transactions by looking through wallet transactions
    // We'll track the last transaction ID where a company had investments
    const lastInvestmentIds = {};
    
    // Go through all transactions in reverse order to find the most recent transaction
    // where each zero-investment company had a non-zero investment
    for (let i = walletTransactions.length - 1; i >= 0; i--) {
      const tx = walletTransactions[i];
      if (tx.isNote) continue; // Skip note rows
      
      for (const company of zeroInvestmentCompanies) {
        if (!(company in lastInvestmentIds) && 
            tx.investments && 
            parseFloat(tx.investments[company] || '0') > 0) {
          // Found the most recent transaction with investment for this company
          lastInvestmentIds[company] = tx.id;
        }
      }
    }
    
    // Sort zero-investment companies by their most recent investment (higher ID = more recent)
    const sortedZeroInvestmentCompanies = [...zeroInvestmentCompanies].sort((a, b) => {
      const aId = lastInvestmentIds[a] || 0;
      const bId = lastInvestmentIds[b] || 0;
      return bId - aId; // Descending order - most recent first
    });
    
    return {
      investedCompanies,
      zeroInvestmentCompanies: sortedZeroInvestmentCompanies
    };
  };

  function allInvestmentsZero(investments, companies) {
    if (!investments) return true;
    return companies.every(company => !parseFloat(investments[company] || '0'));
  }

  // Add this function to add a company from dropdown to visible columns
  const moveCompanyToVisible = (company) => {
    // Move the selected company to visible and the last visible to dropdown
    setVisibleCompanies(prev => [...prev.filter(c => c !== company), company]);
    setDropdownCompanies(prev => {
      const lastVisible = visibleCompanies[visibleCompanies.length - 1];
      return [...prev.filter(c => c !== company), lastVisible];
    });
    setShowCompanyDropdown(false);
  };

  // Add a toggle function for expanding/collapsing buy transactions
  const toggleBuyTransactions = (rowId) => {
    setExpandedBuyRows(prev => {
      if (prev.includes(rowId)) {
        return prev.filter(id => id !== rowId);
      } else {
        return [...prev, rowId];
      }
    });
  };

  // Render active investments table
  const renderActiveInvestmentsTable = () => {
    // Get a fresh list of all companies
    const { investedCompanies } = getTableColumns();
    const allCompanies = investedCompanies;
    
    // Don't update state here - just use the current state values
    // (state is updated in the useEffect above)

    // Find the first row with any non-zero investment
    let firstNonZeroIndex = walletTransactions.findIndex(
      tx => !tx.isNote && !allInvestmentsZero(tx.investments, allCompanies)
    );
    if (firstNonZeroIndex === -1) firstNonZeroIndex = walletTransactions.length;

    return (
      <div className="wallet-table-container">
        {dropdownCompanies.length > 0 && (
          <div className="companies-dropdown-container">
            <button 
              className="companies-dropdown-button"
              onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
            >
              + {dropdownCompanies.length} More Companies
            </button>
            
            {showCompanyDropdown && (
              <div className="companies-dropdown-menu">
                {dropdownCompanies.map(company => (
                  <div 
                    key={company} 
                    className="company-dropdown-item"
                    onClick={() => moveCompanyToVisible(company)}
                  >
                    {company}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        <table className="wallet-table">
          <thead>
            <tr>
              <th className='tid'>tidNo.</th>
              <th>Amount in Wallet (₹)</th>
              {visibleCompanies.map(company => (
                <th key={company}>{company} (₹)</th>
              ))}
              <th>Extra Money Caused (₹)</th>
            </tr>
          </thead>
          <tbody>
            {walletTransactions
              .slice(firstNonZeroIndex)
              .map((transaction, index) => (
                <React.Fragment key={transaction.id}>
                  {transaction.isNote ? (
                    <tr className="note-row">
                      <td colSpan={3 + visibleCompanies.length} className="transaction-note">
                        {transaction.note}
                      </td>
                    </tr>
                  ) : (
                    <>
                      <tr className={`${parseFloat(transaction.walletAmount) < 0 ? "negative-balance" : ""} ${transaction.hasBuyTransactions ? "has-buy-transactions" : ""}`}>
                        <td>
                          {transaction.id}
                          {transaction.hasBuyTransactions && transaction.buyTransactionCount > 1 && (
                            <button 
                              className="toggle-buy-transactions"
                              onClick={() => toggleBuyTransactions(transaction.id)}
                              title={expandedBuyRows.includes(transaction.id) ? "Collapse buy transactions" : "Expand buy transactions"}
                            >
                              {expandedBuyRows.includes(transaction.id) ? "▼" : "▶"}
                            </button>
                          )}
                        </td>
                        <td className="value-display">
                          ₹{transaction.walletAmount}
                        </td>
                        {visibleCompanies.map(company => (
                          <td key={company} className="value-display">
                            ₹{transaction.investments[company] || '0.000'}
                          </td>
                        ))}
                        <td className={`value-display ${parseFloat(transaction.extraMoneyCaused) >= 0 ? "profit" : "loss"}`}>
                          ₹{transaction.extraMoneyCaused}
                        </td>
                      </tr>
                      {/* Add expandable rows for individual buy transactions */}
                      {transaction.hasBuyTransactions && 
                       expandedBuyRows.includes(transaction.id) && 
                       individualBuyTransactions[transaction.id] && 
                       individualBuyTransactions[transaction.id].map((buyTx, idx) => (
                        <tr key={`${transaction.id}-buy-${idx}`} className="individual-buy-transaction">
                          <td className="buy-tx-id">{buyTx.transactionId}</td>
                          <td colSpan={visibleCompanies.length + 2} className="buy-tx-details">
                            Bought {buyTx.quantity} shares of {buyTx.companyName} at ₹{buyTx.price} 
                            (Total: ₹{buyTx.totalCost.toFixed(2)}, Charges: ₹{buyTx.charges.toFixed(2)})
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </React.Fragment>
              ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render zero investments table
  const renderZeroInvestmentsTable = () => {
    const { zeroInvestmentCompanies } = getTableColumns();

    // Find the last row with any non-zero investment
    let lastNonZeroIndex = -1;
    for (let i = walletTransactions.length - 1; i >= 0; i--) {
      const tx = walletTransactions[i];
      if (!tx.isNote && !allInvestmentsZero(tx.investments, zeroInvestmentCompanies)) {
        lastNonZeroIndex = i;
        break;
      }
    }
    const endIndex = lastNonZeroIndex === -1 ? 0 : lastNonZeroIndex + 1;

    return (
      <div className="wallet-table-container">
        <table className="wallet-table">
          <thead>
            <tr>
              <th className='tid'>Transaction #</th>
              <th>Amount in Wallet (₹)</th>
              <th>Extra Money Caused (₹)</th>
              {zeroInvestmentCompanies.map(company => (
                <th key={company}>{company} (₹)</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {walletTransactions
              .slice(0, endIndex)
              .map((transaction, index) => (
                transaction.isNote ? (
                  <tr key={transaction.id} className="note-row">
                    <td colSpan={3 + zeroInvestmentCompanies.length} className="transaction-note">
                      {transaction.note}
                    </td>
                  </tr>
                ) : (
                  <tr key={transaction.id} className={parseFloat(transaction.walletAmount) < 0 ? "negative-balance" : ""}>
                    <td>{transaction.id}</td>
                    <td className="value-display">
                      ₹{transaction.walletAmount}
                    </td>
                    <td className={`value-display ${parseFloat(transaction.extraMoneyCaused) >= 0 ? "profit" : "loss"}`}>
                      ₹{transaction.extraMoneyCaused}
                    </td>
                    {zeroInvestmentCompanies.map(company => (
                      <td key={company} className="value-display zero-investment-cell">
                        ₹{transaction.investments[company] || '0.000'}
                      </td>
                    ))}
                  </tr>
                )
              ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Add a function to handle adding a reminder
  const handleAddReminder = () => {
    if (!reminderStock || !reminderPrice) {
      alert("Please enter both stock name and target price");
      return;
    }

    const newReminder = {
      id: Date.now(),
      stock: reminderStock,
      price: reminderPrice,
      note: reminderNote || "",
      createdAt: new Date().toISOString()
    };

    const updatedReminders = [...reminders, newReminder];
    setReminders(updatedReminders);
    
    // Save to localStorage
    localStorage.setItem('stockReminders', JSON.stringify(updatedReminders));
    
    // Clear the inputs
    setReminderStock('');
    setReminderPrice('');
    setReminderNote('');
    
    setSaveStatus('Reminder added successfully');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  // Add a function to delete a reminder
  const handleDeleteReminder = (id) => {
    const updatedReminders = reminders.filter(reminder => reminder.id !== id);
    setReminders(updatedReminders);
    
    // Save to localStorage
    localStorage.setItem('stockReminders', JSON.stringify(updatedReminders));
    
    setSaveStatus('Reminder deleted');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  return (
    <div className="wallet-tracker-container">
      <div className="wallet-header">
        <h1>Wallet and Investment Tracker</h1>
        <div className="header-actions">
          <button 
            className="reminder-button"
            onClick={() => setShowReminderModal(true)}
            title="Set reminders for stocks to buy"
          >
            🔔
          </button>
          <button 
            className="info-button"
            onClick={() => setShowInfoModal(true)}
            title="View information about wallet calculations"
          >
            ℹ️
          </button>
          <button className="refresh-button" onClick={refreshData}>
            Refresh Data
          </button>
          {saveStatus && (
            <span className={`save-status ${saveStatus.includes('Error') ? 'error' : 'success'}`}>
              {saveStatus}
            </span>
          )}
        </div>
      </div>
      
      <div className="wallet-actions-section">
      <div className="wallet-deposit-section">
        <input
          type="number"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          placeholder="Amount to add to wallet"
          className="deposit-input"
        />
        <button 
          className="deposit-button"
          onClick={handleAddMoneyToWallet}
        >
          Add Money to Wallet
        </button>
      </div>
      
        <div className="wallet-withdraw-section">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Amount to withdraw from wallet"
            className="withdraw-input"
          />
          <button 
            className="withdraw-button"
            onClick={handleWithdrawMoneyFromWallet}
          >
            Withdraw Money from Wallet
          </button>
        </div>
      </div>
      
      <div className="wallet-tabs">
        <button 
          className={`tab-button ${activeTab === 'active-investments' ? 'active' : ''}`}
          onClick={() => setActiveTab('active-investments')}
        >
          Active Investments ({getTableColumns().investedCompanies.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'zero-investments' ? 'active' : ''}`}
          onClick={() => setActiveTab('zero-investments')}
        >
          Zero Investments ({getTableColumns().zeroInvestmentCompanies.length})
        </button>
      </div>
      
      {activeTab === 'active-investments' ? renderActiveInvestmentsTable() : renderZeroInvestmentsTable()}
      
      {/* Add reminder modal */}
      {showReminderModal && (
        <div className="modal-overlay">
          <div className="modal-content reminder-modal">
            <div className="modal-header">
              <h2>Stock Buy Reminders</h2>
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
                  <label htmlFor="reminderStock">Stock Name:</label>
                  <input 
                    type="text" 
                    id="reminderStock"
                    value={reminderStock}
                    onChange={(e) => setReminderStock(e.target.value)}
                    placeholder="Enter stock name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reminderPrice">Target Price (₹):</label>
                  <input 
                    type="number" 
                    id="reminderPrice"
                    value={reminderPrice}
                    onChange={(e) => setReminderPrice(e.target.value)}
                    placeholder="Enter target price"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reminderNote">Note (optional):</label>
                  <textarea 
                    id="reminderNote"
                    value={reminderNote}
                    onChange={(e) => setReminderNote(e.target.value)}
                    placeholder="Add note about this reminder"
                    rows="2"
                  ></textarea>
                </div>
                <button 
                  className="add-reminder-button"
                  onClick={handleAddReminder}
                >
                  Add Reminder
                </button>
              </div>

              <div className="reminders-list">
                <h3>Your Reminders</h3>
                {reminders.length === 0 ? (
                  <p className="no-reminders">No reminders set</p>
                ) : (
                  <table className="reminders-table">
                    <thead>
                      <tr>
                        <th>Stock</th>
                        <th>Target Price (₹)</th>
                        <th>Note</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reminders.map(reminder => (
                        <tr key={reminder.id}>
                          <td>{reminder.stock}</td>
                          <td>₹{reminder.price}</td>
                          <td>{reminder.note}</td>
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
              <h2>Wallet Tracker Information</h2>
              <button 
                className="modal-close"
                onClick={() => setShowInfoModal(false)}
              >
                ×
      </button>
            </div>
            <div className="modal-body">
              <p><strong>Important Information about Calculations:</strong></p>
              <ul>
                <li>The total investment shown for each company includes both the stock purchase price and all extra charges.</li>
                <li>When a sell transaction occurs, the full sell value is added to the wallet amount (charges are not deducted from wallet).</li>
                <li>Extra charges on sell transactions are considered part of your investment in the company.</li>
                <li>Extra Money Caused column shows your cumulative profit/loss from all sell transactions.</li>
                <li>Profit/loss is calculated as: Sell Value - (Original Cost Basis + Buy Transaction Charges + Sell Transaction Charges).</li>
                <li>Original cost basis is determined using the FIFO (First In, First Out) method.</li>
                <li>Buy charges are calculated precisely based on the specific buy transactions used for the sold shares (FIFO method).</li>
              </ul>
              
              <p><strong>How Transactions Are Displayed:</strong></p>
              <ul>
                <li>Consecutive buy transactions for any company are combined into a single row to reduce clutter.</li>
                <li>A new row is created only after a sell transaction occurs or when money is added to wallet.</li>
                <li>Sell transactions are always shown with a detailed note explaining the profit or loss.</li>
                <li>Sale notes show both the selling value and the original cost basis of the shares.</li>
                <li>Selling extra charges are also displayed in the sale notes for complete transparency.</li>
                <li>Wallet deposits are always shown individually with their own descriptive notes.</li>
                <li>The row number shown in the "Transaction #" column refers to the result of combined transactions, not individual stock purchases.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletTracker; 