import React, { useState, useEffect } from 'react';
import './InvestmentTable.css';

// Add this helper function before calculateExtraCharges
const roundSTT = (sttValue) => {
  // Get the whole rupee part
  const rupeePart = Math.floor(sttValue);
  
  // Get the paise part (the decimal portion)
  const paisePart = sttValue - rupeePart;
  
  // If paise is 50 or more, round up to the nearest rupee
  // If paise is less than 50, round down (keep just the rupee part)
  if (paisePart >= 0.5) {
    return Math.ceil(sttValue);
  } else {
    return rupeePart;
  }
};

// Add this helper function after the roundSTT function
const roundStampDuty = (stampDutyValue) => {
  // If stamp duty is less than 1, round to zero
  return stampDutyValue < 1 ? 0 : stampDutyValue;
};

const StockAnalysis = () => {
  const [companyName, setCompanyName] = useState('');
  const [companies, setCompanies] = useState([]);
  const [transactions, setTransactions] = useState([
    { id: 1, price: '', quantity: '', totalInvestment: 0, totalShares: 0, averagePrice: 0, extraCharges: 0, totalExtraCharges: 0 }
  ]);
  const [showChargesModal, setShowChargesModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [isNewCompanyMode, setIsNewCompanyMode] = useState(false);
  const [quickPrice, setQuickPrice] = useState('');
  const [quickQuantity, setQuickQuantity] = useState('');
  const [showProfitLossModal, setShowProfitLossModal] = useState(false);
  const [profitLossInfo, setProfitLossInfo] = useState({
    sellValue: 0,
    originalCost: 0,
    buyingCharges: 0,
    sellingCharges: 0,
    totalCharges: 0,
    profitLoss: 0,
    quantity: 0
  });
  const [visibleColumns, setVisibleColumns] = useState([
    'id', 'price', 'quantity', 'totalInvestment', 
    'extraCharges', 'averagePrice', 'totalExtraCharges', 'totalShares'
  ]);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showUtilityMenu, setShowUtilityMenu] = useState(false);
  const [showUtilityPanel, setShowUtilityPanel] = useState(false);
  const [lastSelectedCompany, setLastSelectedCompany] = useState('');
  const [gender, setGender] = useState('female'); // Add gender state with 'male' as default
  // First, add a new state for the live profit calculation
  const [liveProfit, setLiveProfit] = useState({ 
    calculated: false,
    sellValue: 0,
    originalCost: 0,
    buyingCharges: 0,
    sellingCharges: 0,
    totalCharges: 0,
    profitLoss: 0,
    quantity: 0
  });
  // Add this state near the other state declarations
  const [transactionType, setTransactionType] = useState('buy');
  // Add this state near your other useStates
  const [showSellPL, setShowSellPL] = useState(false);

  // Load companies from localStorage when component mounts
  useEffect(() => {
    const savedCompanies = localStorage.getItem('companies');
    if (savedCompanies) {
      try {
        const parsedCompanies = JSON.parse(savedCompanies);
        console.log("Loaded companies from localStorage:", parsedCompanies);
        setCompanies(parsedCompanies);
        
        // Load last selected company if available
        const lastCompany = localStorage.getItem('lastSelectedCompany');
        if (lastCompany) {
          const foundCompany = parsedCompanies.find(c => c.name === lastCompany);
          if (foundCompany) {
            console.log("Restoring last selected company:", lastCompany);
            loadCompanyData(foundCompany);
          } else {
            // If last company not found, clear the form without showing input
            clearForm(false);
          }
        } else {
          // No last company, start with empty form without showing input
          clearForm(false);
        }
      } catch (error) {
        console.error("Error parsing companies from localStorage:", error);
        clearForm(false);
      }
    } else {
      // No companies data, ensure form is clear without showing input
      clearForm(false);
    }
  }, []);

  const calculateExtraCharges = (totalStockPrice, quantity) => {
    // If quantity is negative, it's a selling transaction
    const isSelling = quantity < 0;
    const absoluteValue = Math.abs(totalStockPrice);

    // Calculate brokerage - updated calculation
    // Step 1: Calculate 0.1% of Total Order Value
    let brokerage = absoluteValue * 0.001;
    
    // Step 2: Compare with ₹20 (max cap)
    brokerage = Math.min(brokerage, 20);
    
    // Step 3: Apply minimum brokerage of ₹2
    brokerage = Math.max(brokerage, 2);
    
    // Step 4: Calculate 2.5% of Total Order Value
    const brokerageLimit = absoluteValue * 0.025;
    
    // Step 5: Ensure brokerage doesn't exceed 2.5% of Total Order Value
    brokerage = Math.min(brokerage, brokerageLimit);
    
    // STT is 0.1% for both buy and sell
    // Apply custom rounding rule: If paise is 50 or more, round up; if less than 50, round down
    const sttRaw = absoluteValue * 0.001;
    const stt = roundSTT(sttRaw);

    if (isSelling) {
      // Selling charges
      const exchangeCharge = absoluteValue * 0.0000297; // 0.00297%
      const sebiTurnover = absoluteValue * 0.000001;    // 0.0001%
      const ipf = absoluteValue * 0.000001;             // 0.0001%
      
      // Fixed DP charges based on gender
      const dpCharge = gender === 'female' ? 21.54 : 21.83;
      
      // Calculate GST (18% on brokerage + exchange + sebi)
      const gst = 0.18 * (brokerage + exchangeCharge + sebiTurnover);
      
      return stt + brokerage + exchangeCharge + sebiTurnover + ipf + dpCharge + gst;
    } else {
      // Buying charges
      let stampDuty = absoluteValue * 0.00015;   // 0.015%
      // Apply new rounding rule for stamp duty
      stampDuty = roundStampDuty(stampDuty);
      
      const exchangeCharge = absoluteValue * 0.0000297; // 0.00297%
      const sebiTurnover = absoluteValue * 0.000001;    // 0.0001%
      const ipf = absoluteValue * 0.000001;             // 0.0001%

      // Calculate GST (18% on brokerage + exchange + sebi)
      const gst = 0.18 * (brokerage + exchangeCharge + sebiTurnover);
      
      return stt + brokerage + stampDuty + exchangeCharge + sebiTurnover + ipf + gst;
    }
  };

  // Add a function to auto-save changes when a company is loaded
  const autoSaveChanges = () => {
    // Only save if there's a company name and transactions
    if (companyName && transactions.length > 0) {
      console.log("Auto-saving changes for:", companyName);
      
      try {
        // Create a clean copy of the transactions to save
        const transactionsToSave = JSON.parse(JSON.stringify(transactions));
        
        const companyData = {
          name: companyName,
          transactions: transactionsToSave,
          lastUpdated: new Date().toISOString()
        };
        
        // Find and update the company in the list
        const updatedCompanies = [...companies];
        const existingCompanyIndex = companies.findIndex(c => c.name === companyName);
        
        if (existingCompanyIndex >= 0) {
          // Update without changing reference to the current company
          updatedCompanies[existingCompanyIndex] = companyData;
          
          // Only update localStorage, don't trigger a re-render by updating state
          localStorage.setItem('companies', JSON.stringify(updatedCompanies));
          
          // Update companies state after localStorage is updated
          // Use a functional update to ensure we're working with the latest state
          setCompanies(prevCompanies => {
            const newCompanies = [...prevCompanies];
            const idx = newCompanies.findIndex(c => c.name === companyName);
            if (idx >= 0) {
              newCompanies[idx] = companyData;
            }
            return newCompanies;
          });
          
          console.log("Auto-saved changes for:", companyName);
        } else {
          console.warn("Company not found in list, can't auto-save");
        }
      } catch (error) {
        console.error("Error in autoSaveChanges:", error);
      }
    }
  };

  const updateTransactions = () => {
    console.log("Starting updateTransactions with", transactions.length, "transactions");
    
    // Skip updating if no transactions are available
    if (transactions.length === 0) {
      console.log("No transactions to update");
      return;
    }
    
    try {
      // Use the helper function to calculate updated transactions
      const updatedTransactions = calculateUpdatedTransactions(transactions);
      
      // Update state first and avoid auto-saving in normal update path
      // to reduce chance of multiple saves overwriting each other
      setTransactions(updatedTransactions);
      
      // Auto-save is now handled by the saveCompanyData function
      // and the dedicated Save Transactions button
    } catch (error) {
      console.error("Error updating transactions:", error);
    }
  };

  const handleInputChange = (index, field, value) => {
    // Update the transaction at the specified index
    const newTransactions = [...transactions];
    const oldTransaction = {...newTransactions[index]};
    newTransactions[index][field] = value;
    
    // Set the state directly without recalculating
    setTransactions(newTransactions);
    
    // Use debounce technique to avoid too many recalculations
    if (window.inputChangeTimeout) {
      clearTimeout(window.inputChangeTimeout);
    }
    
    // Recalculate after a short delay if the user stops typing
    window.inputChangeTimeout = setTimeout(() => {
      updateTransactions();
      
      // Check if this is a sell transaction (negative quantity)
      const tx = newTransactions[index];
      const isNowFilled = tx.price && tx.quantity;
      const wasSellBefore = oldTransaction.quantity && parseFloat(oldTransaction.quantity) < 0;
      const isSellNow = tx.quantity && parseFloat(tx.quantity) < 0;
      const wasEmpty = !oldTransaction.price || !oldTransaction.quantity;
      
      // Record transaction if:
      // 1. It's a newly valid transaction (previously had no price or quantity, now has both)
      // 2. OR it's a new sell transaction (wasn't a sell before, is a sell now)
      // 3. OR it changed from a buy to a sell
      if ((wasEmpty && isNowFilled) || 
          (!wasSellBefore && isSellNow) || 
          (oldTransaction.quantity && tx.quantity && 
           parseFloat(oldTransaction.quantity) > 0 && parseFloat(tx.quantity) < 0)) {
        console.log(`Recording transaction for ${companyName}, ID: ${index + 1}, Quantity: ${tx.quantity}`);
        recordTransaction(companyName, index + 1);
      }
    }, 300);
  };

  const addNewRow = () => {
    if (transactions.length === 0) {
      // If no transactions exist, create a new one with ID 1
      setTransactions([
        { id: 1, price: '', quantity: '', totalInvestment: 0, totalShares: 0, averagePrice: 0, extraCharges: 0, totalExtraCharges: 0 }
      ]);
    } else {
      // Get the last row's ID and increment it
      const lastRow = transactions[transactions.length - 1];
      const newId = lastRow.id + 1;
      
      setTransactions([
        ...transactions,
        { id: newId, price: '', quantity: '', totalInvestment: 0, totalShares: 0, averagePrice: 0, extraCharges: 0, totalExtraCharges: 0 }
      ]);
    }
  };
  
  const deleteTransaction = (index, event) => {
    console.log("Deleting transaction at index:", index);
    
    // Prevent event bubbling to parent elements
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Don't allow deletion of the last row
    if (transactions.length === 1) {
      alert("Cannot delete the last transaction row");
      return;
    }
    
    // Get transaction details for the warning message
    const transactionToDelete = transactions[index];
    const price = parseFloat(transactionToDelete.price) || 0;
    const quantity = parseFloat(transactionToDelete.quantity) || 0;
      const isSellTransaction = quantity < 0;
    const transactionType = isSellTransaction ? "SELL" : "BUY";
    const absQuantity = Math.abs(quantity);
    
    // Show a confirmation dialog with transaction details
    const confirmMessage = `Are you sure you want to delete this ${transactionType} transaction?\n\n` +
      `Transaction #: ${transactionToDelete.id}\n` +
      `Price: ₹${price.toFixed(2)}\n` +
      `Quantity: ${absQuantity} shares\n` +
      `Total Value: ₹${(price * absQuantity).toFixed(2)}\n\n` +
      `This action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      console.log("Transaction deletion cancelled");
      return;
    }
    
    try {
      // Capture the transaction being deleted
      const transactionIdToDelete = transactions[index].id;
      console.log(`Deleting transaction with ID: ${transactionIdToDelete} for company: ${companyName}`);
      
      // Create a deep copy of transactions to avoid reference issues
      const currentTransactions = JSON.parse(JSON.stringify(transactions));
      
      // Remove the transaction at the specified index
      const newTransactions = currentTransactions.filter((_, i) => i !== index);
      
      // Renumber IDs sequentially
      const renumberedTransactions = newTransactions.map((tx, i) => ({
        ...tx,
        id: i + 1
      }));
      
      // Calculate updated values for transactions
      const updatedTransactions = calculateUpdatedTransactions(renumberedTransactions);
      
      // First update the UI with the new transactions
      setTransactions(updatedTransactions);
      
      // Now update the localStorage and transaction history
      
      // Get current companies data from localStorage
      const savedData = localStorage.getItem('companies');
      if (savedData && companyName) {
        const allCompanies = JSON.parse(savedData);
        
        // Find the transaction history object
        const historyIndex = allCompanies.findIndex(c => c.name === "_TransactionHistory");
        
        if (historyIndex >= 0) {
          // Create a new array of transactions without the deleted one
          const updatedHistoryTransactions = allCompanies[historyIndex].transactions.filter(tx => {
            // Make sure we're not removing transactions from other companies
            if (tx.companyName !== companyName) {
              return true;
            }
            
            // For this company, remove the transaction with matching ID
            return tx.transactionNumber !== transactionIdToDelete;
          });
          
          // Update transaction numbers for all transactions of this company that had higher numbers
          updatedHistoryTransactions.forEach(tx => {
            if (tx.companyName === companyName && tx.transactionNumber > transactionIdToDelete) {
              tx.transactionNumber -= 1;
            }
          });
          
          // Replace the transactions array in the history
          allCompanies[historyIndex].transactions = updatedHistoryTransactions;
        }
        
        // Update the company's transaction data directly
        const companyIndex = allCompanies.findIndex(c => c.name === companyName);
        if (companyIndex >= 0) {
          // Create updated company data
          const updatedCompanyData = {
            name: companyName,
            transactions: updatedTransactions,
            lastUpdated: new Date().toISOString()
          };
          
          // Update the company data in the array
          allCompanies[companyIndex] = updatedCompanyData;
          
          // Save all updated data back to localStorage
          localStorage.setItem('companies', JSON.stringify(allCompanies));
        
          // Update the companies state
          setCompanies(allCompanies);
          
          console.log("Transaction deleted and changes saved automatically");
        } else {
          console.error(`Company ${companyName} not found in companies data`);
          alert("Error updating company data. Please save changes manually.");
        }
      } else {
        console.error("No companies data found in localStorage");
        alert("Error: Could not find companies data. Please save changes manually.");
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("An error occurred while deleting the transaction. Please try again.");
    }
    
    return false; // Prevent any default actions
  };
  
  // Helper function to calculate updated transactions without modifying state
  const calculateUpdatedTransactions = (transactionsToUpdate) => {
    console.log("Calculating updated transactions for", transactionsToUpdate.length, "items");
    
    if (!transactionsToUpdate || transactionsToUpdate.length === 0) {
      return transactionsToUpdate;
    }
    
    try {
      // Clone the transactions to avoid issues
      const newTransactions = JSON.parse(JSON.stringify(transactionsToUpdate));
      
      // Keep track of running totals
      let runningTotalShares = 0;
      let runningTotalInvestment = 0;
      let runningTotalExtraCharges = 0; // Add running total for extra charges
      let sharesForFifo = [];  // For FIFO tracking of shares
      
      // Process each transaction in order
      for (let i = 0; i < newTransactions.length; i++) {
        const tx = newTransactions[i];
        const price = parseFloat(tx.price) || 0;
        const quantity = parseFloat(tx.quantity) || 0;
        
        // Skip if price or quantity is not properly set
        if (price === 0 && quantity === 0) {
          // Still update the total extra charges for empty rows
          newTransactions[i] = {
            ...tx,
            totalExtraCharges: runningTotalExtraCharges
          };
          continue;
        }
        
        // Process based on transaction type
        if (quantity > 0) {
          // Buy transaction
          runningTotalShares += quantity;
          runningTotalInvestment += (price * quantity);
          
          // Add to FIFO tracking
          sharesForFifo.push({
            price: price,
            quantity: quantity,
            remaining: quantity
          });
          
          // Calculate extra charges with the rounded STT
          const extraCharges = calculateExtraCharges(price * quantity, quantity);
          runningTotalExtraCharges += extraCharges; // Add to running total
          
          // Update transaction data
          newTransactions[i] = {
            ...tx,
            totalShares: runningTotalShares,
            totalInvestment: runningTotalInvestment,
            averagePrice: runningTotalShares > 0 ? (runningTotalInvestment / runningTotalShares) : 0,
            extraCharges: extraCharges,
            totalExtraCharges: runningTotalExtraCharges // Add the running total
          };
        } else if (quantity < 0) {
          // Sell transaction
          const sellQuantity = Math.abs(quantity);
          let remainingToSell = sellQuantity;
          let costBasisOfSoldShares = 0;
          
          // Apply FIFO to determine which shares are sold
          for (let j = 0; j < sharesForFifo.length && remainingToSell > 0; j++) {
            const buyLot = sharesForFifo[j];
            
            if (buyLot.remaining > 0) {
              const used = Math.min(buyLot.remaining, remainingToSell);
              costBasisOfSoldShares += (buyLot.price * used);
              buyLot.remaining -= used;
              remainingToSell -= used;
            }
          }
          
          // Update running totals
          runningTotalShares -= sellQuantity;
          runningTotalInvestment -= costBasisOfSoldShares;
          
          // Calculate selling value and extra charges with rounded STT
          const sellingValue = price * sellQuantity;
          const extraCharges = calculateExtraCharges(sellingValue, quantity);
          runningTotalExtraCharges += extraCharges; // Add to running total
          
          // Update transaction data
          newTransactions[i] = {
            ...tx,
            totalShares: runningTotalShares,
            totalInvestment: runningTotalInvestment,
            averagePrice: runningTotalShares > 0 ? (runningTotalInvestment / runningTotalShares) : 0,
            extraCharges: extraCharges,
            totalExtraCharges: runningTotalExtraCharges // Add the running total
          };
        }
      }
      
      console.log("Calculated updated transactions:", newTransactions);
      return newTransactions;
    } catch (error) {
      console.error("Error calculating updated transactions:", error);
      return transactionsToUpdate;
    }
  };

  const saveCompanyData = () => {
    if (!companyName.trim()) {
      alert('Please enter a company name');
      return;
    }
  
    // Ensure we have the most current data
    const currentCompanies = JSON.parse(localStorage.getItem('companies') || '[]');
    
    const companyData = {
      name: companyName,
      transactions: transactions,
      lastUpdated: new Date().toISOString()
    };
  
    // Find if company already exists
    const existingCompanyIndex = currentCompanies.findIndex(c => c.name === companyName);
  
    // Create updated companies array
    let updatedCompanies;
    if (existingCompanyIndex >= 0) {
      updatedCompanies = [...currentCompanies];
      updatedCompanies[existingCompanyIndex] = companyData;
    } else {
      updatedCompanies = [...currentCompanies, companyData];
    }
  
    // Before saving, ensure transaction history is in sync with current transactions
    const historyIndex = updatedCompanies.findIndex(c => c.name === "_TransactionHistory");
    if (historyIndex >= 0) {
      // Get current transaction IDs
      const currentTransactionIds = transactions.map(tx => tx.id);
      
      // Filter out transactions for this company that no longer exist in the current set
      updatedCompanies[historyIndex].transactions = updatedCompanies[historyIndex].transactions.filter(tx => {
        // Keep transactions that are not for this company
        if (tx.companyName !== companyName) return true;
        
        // For this company, only keep transactions that exist in the current set
        return currentTransactionIds.includes(tx.transactionNumber);
      });
      
      console.log("Updated transaction history to match current transactions");
    }
  
    // Save to localStorage first
    localStorage.setItem('companies', JSON.stringify(updatedCompanies));
    
    // Update state after saving
    setCompanies(updatedCompanies);
    
    console.log(`Saving company data for ${companyName} with ${transactions.length} transactions`);
    
    // Record all transactions with valid data, making sure to always record sell transactions
    transactions.forEach((tx) => {
      if (tx.price && tx.quantity) {
        console.log(`Recording transaction #${tx.id} from saveCompanyData`);
        // Use setTimeout to ensure this executes after the localStorage update
        setTimeout(() => recordTransaction(companyName, tx.id), 50);
      }
    });
    
    alert(`Data saved for ${companyName}`);
  };

  const loadCompanyData = (selectedCompany, event) => {
    // Prevent event bubbling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    console.log("Loading company data for:", selectedCompany.name);
    
    try {
      // Close the calculator if it's open to prevent errors
      if (showCalculator) {
        setShowCalculator(false);
        setSelectedTransactions([]);
      }
      
      // Debug the company data from localStorage directly for verification
      const companyDataFromStorage = debugCompanyData(selectedCompany.name);
      
      // Validate the company data
      if (!selectedCompany.transactions || !Array.isArray(selectedCompany.transactions)) {
        console.error("Invalid transactions data", selectedCompany);
        alert(`Error: Invalid transaction data for ${selectedCompany.name}`);
        return;
      }
      
      // First update company name
      setCompanyName(selectedCompany.name);
      
      // Save the selected company to localStorage
      localStorage.setItem('lastSelectedCompany', selectedCompany.name);
      setLastSelectedCompany(selectedCompany.name);
      
      // Ensure we're working with the correct transaction structure
      const loadedTransactions = selectedCompany.transactions.map(tx => ({
        id: tx.id || 1,
        price: tx.price || '',
        quantity: tx.quantity || '',
        totalShares: tx.totalShares || 0,
        totalInvestment: tx.totalInvestment || 0,
        averagePrice: tx.averagePrice || 0,
        extraCharges: tx.extraCharges || 0,
        totalExtraCharges: tx.totalExtraCharges || 0
      }));
      
      console.log("Setting transactions:", loadedTransactions);
      
      // Use a safer approach to update state
      setTransactions(loadedTransactions);
      
      // Wait for state to update before recalculating
      setTimeout(() => {
        console.log("Updating transactions for:", selectedCompany.name, "Current company name:", companyName);
        // Check if the company name is still the same before updating
        if (companyName === selectedCompany.name) {
          updateTransactions();
        } else {
          console.warn("Company name changed before updating transactions!");
        }
      }, 100);
    } catch (error) {
      console.error("Error loading company data:", error);
      alert(`Error loading data for ${selectedCompany.name}. See console for details.`);
    }
  };

  const clearForm = (showNameInput = true) => {
    console.log("Clearing form explicitly called");
    
    // Close the calculator if it's open to prevent errors
    if (showCalculator) {
      setShowCalculator(false);
      setSelectedTransactions([]);
    }
    
    setCompanyName('');
    // Only set to true if we explicitly want to show the input
    setIsNewCompanyMode(showNameInput);
    // Set transactions to an empty array instead of creating a default row
    setTransactions([]);
    
    // Clear the last selected company
    localStorage.removeItem('lastSelectedCompany');
    setLastSelectedCompany('');
  };

  const deleteCompany = (companyNameToDelete, event) => {
    // Prevent event bubbling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (window.confirm(`Are you sure you want to delete ${companyNameToDelete}?`)) {
      const updatedCompanies = companies.filter(company => company.name !== companyNameToDelete);
      setCompanies(updatedCompanies);
      localStorage.setItem('companies', JSON.stringify(updatedCompanies));
      
      // If the deleted company was currently selected, clear the form
      if (companyNameToDelete === companyName) {
        clearForm();
      }
      
      // If the deleted company was the last selected one, remove it from localStorage
      if (companyNameToDelete === lastSelectedCompany) {
        localStorage.removeItem('lastSelectedCompany');
        setLastSelectedCompany('');
      }
      
      alert(`${companyNameToDelete} has been deleted`);
    }
  };

  // Calculate values on initial render
  useEffect(() => {
    if (transactions.some(tx => tx.price !== '' || tx.quantity !== '')) {
      updateTransactions();
    }
  }, []);

  // Add a new effect to handle company name changes and ensure transactions are properly updated
  useEffect(() => {
    // When company name changes (new company loaded), ensure transactions are updated
    if (companyName && transactions.length > 0) {
      console.log("Company name effect triggered for:", companyName);
      
      // Don't call updateTransactions here - we already do that in loadCompanyData
      // This avoids duplicate recalculations
    }
  }, [companyName]);

  // Function to debug company data
  const debugCompanyData = (companyName) => {
    const savedCompanies = localStorage.getItem('companies');
    if (savedCompanies) {
      try {
        const parsedCompanies = JSON.parse(savedCompanies);
        const company = parsedCompanies.find(c => c.name === companyName);
        console.log("DEBUG - Company data for", companyName, ":", company);
        return company;
      } catch (error) {
        console.error("Error debugging company data:", error);
        return null;
      }
    }
    return null;
  };

  // Function to export all companies data to a local file
  const exportCompaniesToFile = () => {
    try {
      // Get companies data from localStorage
      const savedCompanies = localStorage.getItem('companies');
      
      if (!savedCompanies || savedCompanies === '[]') {
        alert('No companies data to export');
        return;
      }
      
      // Get reminders data
      let remindersData = localStorage.getItem('stockReminders');
      if (!remindersData) {
        remindersData = '[]';
      }
      
      // Create a combined data object with both companies and reminders
      const exportData = {
        companies: JSON.parse(savedCompanies),
        reminders: JSON.parse(remindersData)
      };
      
      // Create a Blob with the data
      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      
      // Create a temporary URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a link element
      const link = document.createElement('a');
      link.href = url;
      
      // Set the filename with current date
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      link.download = `investment-data-${date}.json`;
      
      // Append link to body, click it, and remove it
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Release the URL object
      URL.revokeObjectURL(url);
      
      console.log('Companies and reminders data exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data. Please try again.');
    }
  };
  
  // Function to import companies data from a local file
  const importCompaniesFromFile = (event) => {
    try {
      const file = event.target.files[0];
      if (!file) {
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const contents = e.target.result;
          const parsedData = JSON.parse(contents);
          
          let importedCompanies;
          let importedReminders;
          
          // Check if this is the new format with companies and reminders
          if (parsedData.companies && Array.isArray(parsedData.companies)) {
            importedCompanies = parsedData.companies;
            importedReminders = parsedData.reminders || [];
            console.log("Imported data in new format with reminders:", importedReminders);
          } 
          // Legacy format (just an array of companies)
          else if (Array.isArray(parsedData)) {
            importedCompanies = parsedData;
            importedReminders = [];
            console.log("Imported data in legacy format, no reminders");
          }
          else {
            throw new Error('Invalid data format');
          }
          
          // Ask for confirmation
          if (window.confirm(`This will import ${importedCompanies.length} companies and ${importedReminders.length} reminders. Continue?`)) {
            // Save companies to localStorage
            localStorage.setItem('companies', JSON.stringify(importedCompanies));
            
            // Save reminders to localStorage
            localStorage.setItem('stockReminders', JSON.stringify(importedReminders));
            console.log("Saved reminders to localStorage:", importedReminders);
            
            // Update companies state
            setCompanies(importedCompanies);
            
            // Dispatch a custom event with the reminder data to notify WalletTracker
            const reminderEvent = new CustomEvent('reminders-imported', { 
              detail: { reminders: importedReminders } 
            });
            window.dispatchEvent(reminderEvent);
            console.log("Dispatched reminders-imported event with data");
            
            // Clear current form
            clearForm();
            
            alert('Companies and reminders data imported successfully');
          }
        } catch (error) {
          console.error('Error parsing imported file:', error);
          alert('Invalid file format. Please select a valid JSON file.');
        }
      };
      
      reader.onerror = () => {
        alert('Error reading file');
      };
      
      reader.readAsText(file);
      
      // Reset the input element so the same file can be selected again
      event.target.value = '';
    } catch (error) {
      console.error('Error importing data:', error);
      alert('Error importing data. Please try again.');
    }
  };

  // Completely revised recordTransaction function
  const recordTransaction = (companyName, transactionNumber, amount = null) => {
    try {
      console.log(`Attempting to record transaction for ${companyName}, transaction #${transactionNumber}`);
      
      // Get companies data directly from localStorage to ensure latest data
      const savedCompanies = localStorage.getItem('companies');
      if (!savedCompanies) {
        console.error("No companies data found in localStorage");
        return;
      }
      
      let companiesData = JSON.parse(savedCompanies);
      
      // Find or create the special transactions record company
      let transactionsRecord = companiesData.find(c => c.name === "_TransactionHistory");
      
      if (!transactionsRecord) {
        // Create new transaction history record if it doesn't exist
        transactionsRecord = {
          name: "_TransactionHistory",
          transactions: []
        };
        companiesData.push(transactionsRecord);
      }
      
      // For wallet deposits, we'll use the timestamp as identifier instead of transactionNumber
      const identifier = companyName === "Wallet" ? `wallet_deposit_${Date.now()}` : transactionNumber;
      
      // Check if this exact transaction is already recorded
      const existingIndex = transactionsRecord.transactions.findIndex(
        tx => tx.companyName === companyName && 
             (companyName === "Wallet" ? tx.depositTime === identifier : tx.transactionNumber === transactionNumber)
      );
      
      if (existingIndex === -1) {
        // This is a new transaction - add it with next global index
        
        // Find the highest globalIndex to ensure we always increment properly
        // even if transactions have been deleted
        const highestGlobalIndex = transactionsRecord.transactions.length > 0 
          ? Math.max(...transactionsRecord.transactions.map(tx => tx.globalIndex || 0))
          : 0;
        
        const nextGlobalIndex = highestGlobalIndex + 1;
        
        // Prepare transaction data
        const transactionData = {
          globalIndex: nextGlobalIndex,
          companyName: companyName,
          date: new Date().toISOString()
        };
        
        // If it's a wallet deposit, add deposit amount
        if (companyName === "Wallet") {
          transactionData.type = "deposit";
          transactionData.depositAmount = amount;
          transactionData.depositTime = identifier; // Use timestamp as identifier
        } else {
          // For normal company transactions
          transactionData.transactionNumber = transactionNumber;
        }
        
        // Add the new transaction
        transactionsRecord.transactions.push(transactionData);
        
        // Update the transactions record in the companies array
        const recordIndex = companiesData.findIndex(c => c.name === "_TransactionHistory");
        if (recordIndex !== -1) {
          companiesData[recordIndex] = transactionsRecord;
        }
        
        // Save directly back to localStorage
        localStorage.setItem('companies', JSON.stringify(companiesData));
        
        console.log(`Successfully recorded transaction for ${companyName}, global index ${nextGlobalIndex}`);
        
        // Update the companies state
        setCompanies(companiesData);
      } else {
        console.log(`Transaction for ${companyName} already recorded`);
      }
    } catch (error) {
      console.error("Error recording transaction:", error);
    }
  };

  // Add the clearLocalStorage function
  const clearLocalStorage = () => {
    if (window.confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      // Clear companies data
      localStorage.removeItem('companies');
      
      // Also clear reminders data
      localStorage.removeItem('stockReminders');
      
      // Clear last selected company
      localStorage.removeItem('lastSelectedCompany');
      
      // Update state
      setCompanies([]);
      setLastSelectedCompany('');
      
      // Clear the form
      clearForm(false);
      
      // Dispatch an event to notify WalletTracker that reminders have been cleared
      const reminderEvent = new CustomEvent('reminders-cleared');
      window.dispatchEvent(reminderEvent);
      
      alert('All data has been cleared from localStorage.');
    }
  };

  // Replace the saveCompanyData function with this combined function
const saveAllData = () => {
  if (!companyName.trim()) {
    alert('Please enter a company name');
    return;
  }

  try {
    // First, calculate updated transactions
    const updatedTransactions = calculateUpdatedTransactions(transactions);
    
    // Update state with calculated transactions
    setTransactions(updatedTransactions);
    
    // Ensure we have the most current data
    const currentCompanies = JSON.parse(localStorage.getItem('companies') || '[]');
    
    const companyData = {
      name: companyName,
      transactions: updatedTransactions,
      lastUpdated: new Date().toISOString()
    };
  
    // Find if company already exists
    const existingCompanyIndex = currentCompanies.findIndex(c => c.name === companyName);
  
    // Create updated companies array
    let updatedCompanies;
    if (existingCompanyIndex >= 0) {
      updatedCompanies = [...currentCompanies];
      updatedCompanies[existingCompanyIndex] = companyData;
    } else {
      updatedCompanies = [...currentCompanies, companyData];
    }
  
    // Before saving, ensure transaction history is in sync with current transactions
    const historyIndex = updatedCompanies.findIndex(c => c.name === "_TransactionHistory");
    if (historyIndex >= 0) {
      // Get current transaction IDs
      const currentTransactionIds = updatedTransactions.map(tx => tx.id);
      
      // Filter out transactions for this company that no longer exist in the current set
      updatedCompanies[historyIndex].transactions = updatedCompanies[historyIndex].transactions.filter(tx => {
        // Keep transactions that are not for this company
        if (tx.companyName !== companyName) return true;
        
        // For this company, only keep transactions that exist in the current set
        return currentTransactionIds.includes(tx.transactionNumber);
      });
      
      console.log("Updated transaction history to match current transactions");
    }
  
    // Save to localStorage first
    localStorage.setItem('companies', JSON.stringify(updatedCompanies));
    
    // Update state after saving
    setCompanies(updatedCompanies);
    
    console.log(`Saving company data for ${companyName} with ${updatedTransactions.length} transactions`);
    
    // Record all transactions with valid data, making sure to always record sell transactions
    updatedTransactions.forEach((tx) => {
      if (tx.price && tx.quantity) {
        console.log(`Recording transaction #${tx.id} from saveAllData`);
        // Use setTimeout to ensure this executes after the localStorage update
        setTimeout(() => recordTransaction(companyName, tx.id), 50);
      }
    });
    
    alert(`Data saved for ${companyName}`);
  } catch (error) {
    console.error("Error saving data:", error);
    alert("Error saving data. Please try again.");
  }
};

  // Add a function to toggle transaction selection for calculator
  const toggleTransactionSelection = (id) => {
    const txIndex = transactions.findIndex(tx => tx.id === id);
    const tx = transactions[txIndex];
    const isSell = tx && parseFloat(tx.quantity) < 0;

    if (selectedTransactions.includes(id)) {
      // Deselecting: remove sell and its FIFO buys
      setSelectedTransactions(selectedTransactions.filter(txId => txId !== id));
      if (isSell) {
        const fifoIds = getFifoBuyTransactionIds(txIndex);
        setSelectedTransactions(prev => prev.filter(txId => !fifoIds.includes(txId)));
      }
    } else {
      if (isSell) {
        // --- New logic for "in-chain" previous sells ---
        // 1. Simulate FIFO up to this sell, tracking which sells are "in the chain"
        let buyLots = [];
        let neededSellIndexes = [];
        let remainingToSell = Math.abs(parseFloat(tx.quantity));

        // Build buy lots and process sells up to and including this sell
        for (let i = 0; i <= txIndex; i++) {
          const t = transactions[i];
          const price = parseFloat(t.price) || 0;
          const quantity = parseFloat(t.quantity) || 0;
          if (price > 0 && quantity > 0) {
            buyLots.push({ id: t.id, remaining: quantity });
          } else if (quantity < 0) {
            // For each sell, simulate FIFO
            let toSell = Math.abs(quantity);
            let usedAny = false;
            for (let lot of buyLots) {
              if (lot.remaining > 0 && toSell > 0) {
                const used = Math.min(lot.remaining, toSell);
                lot.remaining -= used;
                toSell -= used;
                usedAny = true;
              }
            }
            // If this is the current sell, break after processing
            if (i === txIndex) break;
            // If after this sell, there are still buy shares left, mark this sell as "in chain"
            const totalRemaining = buyLots.reduce((sum, lot) => sum + lot.remaining, 0);
            if (usedAny && totalRemaining > 0) {
              neededSellIndexes.push(i);
            }
          }
        }

        // 2. Collect all their IDs and their FIFO buy IDs
        let allIdsToSelect = [];
        // Add all "in-chain" previous sells
        neededSellIndexes.forEach(sellIdx => {
          allIdsToSelect.push(transactions[sellIdx].id);
          const fifoIds = getFifoBuyTransactionIds(sellIdx);
          allIdsToSelect.push(...fifoIds);
        });
        // Add the current sell and its FIFO buys
        allIdsToSelect.push(transactions[txIndex].id);
        const fifoIds = getFifoBuyTransactionIds(txIndex);
        allIdsToSelect.push(...fifoIds);

        setSelectedTransactions([...new Set([...selectedTransactions, ...allIdsToSelect])]);
      } else {
        setSelectedTransactions([...selectedTransactions, id]);
      }
    }
  };

  // Add a function to calculate the sum of selected transactions
  const calculateSelectedSum = () => {
    if (selectedTransactions.length === 0) return { totalInvestment: 0, totalShares: 0, totalExtraCharges: 0 };
  
    // Get selected transactions, sorted by their order in the table
    const selectedTxs = transactions
      .filter(tx => selectedTransactions.includes(tx.id))
      .sort((a, b) => transactions.findIndex(t => t.id === a.id) - transactions.findIndex(t => t.id === b.id));
  
    let totalInvestment = 0;
    let totalShares = 0;
    let totalExtraCharges = 0;
  
    // For FIFO tracking
    let fifoBuyLots = [];
    // Build up FIFO buy lots with their charges
    transactions.forEach((tx, idx) => {
      const price = parseFloat(tx.price) || 0;
      const quantity = parseFloat(tx.quantity) || 0;
      const extraCharges = parseFloat(tx.extraCharges) || 0;
      if (price > 0 && quantity > 0) {
        fifoBuyLots.push({
          id: tx.id,
          price,
          quantity,
          remaining: quantity,
          extraCharges,
          extraChargesPerShare: extraCharges / quantity
        });
      }
      // Don't process sells here, only use for FIFO
    });
  
    // Now process selected transactions
    selectedTxs.forEach((tx) => {
      const price = parseFloat(tx.price) || 0;
      const quantity = parseFloat(tx.quantity) || 0;
      const extraCharges = parseFloat(tx.extraCharges) || 0;
  
      if (price === 0 || quantity === 0) return;
  
      if (quantity > 0) {
        // Buy transaction: include only if selected
        totalInvestment -= (price * quantity + extraCharges);
        totalShares += quantity;
        totalExtraCharges += extraCharges;
      } else if (quantity < 0) {
        // Sell transaction: need to calculate proportional buy charges for shares sold
        const sellQuantity = Math.abs(quantity);
        let remainingToSell = sellQuantity;
        let costBasisOfSoldShares = 0;
        let proportionalBuyCharges = 0;
  
        // For each buy lot, in FIFO order, use up shares
        for (let lot of fifoBuyLots) {
          if (lot.remaining > 0 && remainingToSell > 0) {
            const sharesToSellFromLot = Math.min(lot.remaining, remainingToSell);
            costBasisOfSoldShares += lot.price * sharesToSellFromLot;
            proportionalBuyCharges += lot.extraChargesPerShare * sharesToSellFromLot;
            lot.remaining -= sharesToSellFromLot;
            remainingToSell -= sharesToSellFromLot;
          }
          if (remainingToSell <= 0) break;
        }
  
        // Sell charges for this transaction
        const sellCharges = extraCharges;
  
        // Total charges = proportional buy charges + sell charges
        const totalCharges = proportionalBuyCharges + sellCharges;
  
        // Profit/loss for this sell
        const sellValue = price * sellQuantity;
        const profitLoss = sellValue - costBasisOfSoldShares - totalCharges;
  
        // For summary, treat as "money in" (positive) for sells
        totalInvestment += profitLoss + totalCharges; // This is equivalent to sellValue - costBasisOfSoldShares
        totalShares += quantity; // quantity is negative
        totalExtraCharges += totalCharges;
      }
    });
  
    return {
      totalInvestment,
      totalShares,
      totalExtraCharges
    };
  };
  // Check if any selected transactions are sell transactions
  const hasSellTransactionsSelected = () => {
    if (selectedTransactions.length === 0) return false;
    
    return transactions
      .filter(tx => selectedTransactions.includes(tx.id))
      .some(tx => 
        tx.type === 'SELL' || 
        (tx.quantity && parseFloat(tx.quantity) < 0)
      );
  };

  // Add a function to clear all selected transactions
  const clearSelectedTransactions = () => {
    setSelectedTransactions([]);
  };

  // Modify the handleSaveTransactions function to include buying charges in profit/loss calculation
  const handleSaveTransactions = () => {
    if (!companyName.trim()) {
      alert('Please select or enter a company name first');
      return;
    }
    
    // First check if we should add a new transaction
    if (quickPrice && quickQuantity) {
      const price = parseFloat(quickPrice);
      const quantity = parseFloat(quickQuantity);
      
      // Check if this is a sell transaction (negative quantity)
      const isSellTransaction = quantity < 0;
      
      // Get the next ID - handle the case when transactions array is empty
      let newId = 1;
      if (transactions.length > 0) {
        const lastRow = transactions[transactions.length - 1];
        newId = lastRow.id + 1;
      }
      
      // Create a new transaction object
      const newTransaction = {
        id: newId,
        price: quickPrice,
        quantity: quickQuantity,
        totalInvestment: 0,
        totalShares: 0,
        averagePrice: 0,
        extraCharges: 0,
        totalExtraCharges: 0
      };
      
      // Add this transaction to our array
      const updatedTransactions = [...transactions, newTransaction];
      
      // Calculate the values
      const calculatedTransactions = calculateUpdatedTransactions(updatedTransactions);
      
      // If it's a sell transaction, prepare the profit/loss info
      if (isSellTransaction) {
        const sellQuantityAbs = Math.abs(quantity);
        const sellValue = price * sellQuantityAbs;

        // Use the helper to get FIFO cost and charges
        const { costBasisOfSoldShares, buyingChargesTotal } = getFifoCostAndCharges(transactions, sellQuantityAbs);

        // Calculate extra charges for the sell transaction (use negative quantity for sell)
        const sellCharges = calculateExtraCharges(sellValue, -sellQuantityAbs);

        // Calculate total charges (buying + selling)
        const totalCharges = buyingChargesTotal + sellCharges;

        // Calculate profit/loss (includes both buying and selling charges)
        const profitLoss = sellValue - costBasisOfSoldShares - totalCharges;

        setProfitLossInfo({
          sellValue: sellValue.toFixed(2),
          originalCost: costBasisOfSoldShares.toFixed(2),
          buyingCharges: buyingChargesTotal.toFixed(2),
          sellingCharges: sellCharges.toFixed(2),
          totalCharges: totalCharges.toFixed(2),
          profitLoss: profitLoss.toFixed(2),
          quantity: sellQuantityAbs
        });

        setShowProfitLossModal(true);
      }
      
      // Save directly using a modified version of saveAllData that uses our calculated transactions
      try {
        // Use our already calculated transactions
        const companyData = {
          name: companyName,
          transactions: calculatedTransactions,
          lastUpdated: new Date().toISOString()
        };
        
        // Get current companies
        const currentCompanies = JSON.parse(localStorage.getItem('companies') || '[]');
        
        // Find if company already exists
        const existingCompanyIndex = currentCompanies.findIndex(c => c.name === companyName);
        
        // Create updated companies array
        let updatedCompanies;
        if (existingCompanyIndex >= 0) {
          updatedCompanies = [...currentCompanies];
          updatedCompanies[existingCompanyIndex] = companyData;
        } else {
          updatedCompanies = [...currentCompanies, companyData];
        }
        
        // Before saving, ensure transaction history is in sync with current transactions
        const historyIndex = updatedCompanies.findIndex(c => c.name === "_TransactionHistory");
        if (historyIndex >= 0) {
          // Get current transaction IDs
          const currentTransactionIds = calculatedTransactions.map(tx => tx.id);
          
          // Filter out transactions for this company that no longer exist in the current set
          updatedCompanies[historyIndex].transactions = updatedCompanies[historyIndex].transactions.filter(tx => {
            // Keep transactions that are not for this company
            if (tx.companyName !== companyName) return true;
            
            // For this company, only keep transactions that exist in the current set
            return currentTransactionIds.includes(tx.transactionNumber);
          });
        }
        
        // Save to localStorage
        localStorage.setItem('companies', JSON.stringify(updatedCompanies));
        
        // Update state
        setTransactions(calculatedTransactions);
        setCompanies(updatedCompanies);
        
        // If this was a new company, close the new company mode
        if (isNewCompanyMode) {
          setIsNewCompanyMode(false);
          // Save the company name to localStorage for future reference
          localStorage.setItem('lastSelectedCompany', companyName);
          setLastSelectedCompany(companyName);
        }
        
        // Record the new transaction
        recordTransaction(companyName, newId);
        
        // Clear the inputs
        setQuickPrice('');
        setQuickQuantity('');
        
        // For sell transactions, the alert will show from the modal
        if (!isSellTransaction) {
          alert(`Transaction added and data saved for ${companyName}`);
        }
      } catch (error) {
        console.error("Error saving data:", error);
        alert("Error saving data. Please try again.");
      }
    } else {
      // Just save the existing data
      saveAllData();
      
      // If this was a new company, close the new company mode
      if (isNewCompanyMode) {
        setIsNewCompanyMode(false);
        // Save the company name to localStorage for future reference
        localStorage.setItem('lastSelectedCompany', companyName);
        setLastSelectedCompany(companyName);
      }
    }
  };

  // Then add a function to calculate the live profit (place this after other function definitions)
// ... existing code ...

const calculateLiveProfit = () => {
  // Only calculate if we have price and a company
  if (!quickPrice || !companyName) {
    setLiveProfit({ calculated: false });
    return;
  }

  const price = parseFloat(quickPrice);

  // Skip invalid price
  if (isNaN(price) || price <= 0) {
    setLiveProfit({ calculated: false });
    return;
  }

  // Get quantity or use default 1 for calculation
  let quantity = parseFloat(quickQuantity) || 1;

  // Apply sign based on transaction type
  if (transactionType === 'sell' && quantity > 0) {
    quantity = -quantity;
  } else if (transactionType === 'buy' && quantity < 0) {
    quantity = Math.abs(quantity);
  }

  // Check if this is a sell transaction
  const isSellTransaction = transactionType === 'sell';

  if (!isSellTransaction) {
    // For buy transactions, just show the charges
    const totalStockPrice = price * Math.abs(quantity);
    const extraCharges = calculateExtraCharges(totalStockPrice, Math.abs(quantity));

    setLiveProfit({
      calculated: true,
      sellValue: 0,
      originalCost: totalStockPrice,
      buyingCharges: extraCharges,
      sellingCharges: 0,
      totalCharges: extraCharges,
      profitLoss: 0,
      quantity: Math.abs(quantity),
      isBuy: true
    });
  } else {
    // For sell transactions, calculate potential profit/loss using true FIFO
    const sellQuantity = Math.abs(quantity);
    const sellValue = price * sellQuantity;

    // 1. Build up FIFO buy lots, accounting for previous sells (do NOT include any in-progress sell)
    let fifoBuyLots = [];
    transactions.forEach((tx) => {
      const txPrice = parseFloat(tx.price) || 0;
      const txQuantity = parseFloat(tx.quantity) || 0;
      const txExtraCharges = parseFloat(tx.extraCharges) || 0;
      if (txPrice > 0 && txQuantity > 0) {
        fifoBuyLots.push({
          price: txPrice,
          quantity: txQuantity,
          remaining: txQuantity,
          extraCharges: txExtraCharges,
          extraChargesPerShare: txExtraCharges / txQuantity
        });
      } else if (txQuantity < 0) {
        // For each sell, reduce from FIFO lots
        let toSell = Math.abs(txQuantity);
        for (let lot of fifoBuyLots) {
          if (lot.remaining > 0 && toSell > 0) {
            const used = Math.min(lot.remaining, toSell);
            lot.remaining -= used;
            toSell -= used;
            if (toSell <= 0) break;
          }
        }
      }
    });

    // 2. For the current live sell, use the remaining FIFO buy lots (do NOT mutate .remaining)
    let remainingToSell = sellQuantity;
    let costBasisOfSoldShares = 0;
    let buyingChargesTotal = 0;
    for (let lot of fifoBuyLots) {
      if (lot.remaining > 0 && remainingToSell > 0) {
        const sharesToSellFromLot = Math.min(lot.remaining, remainingToSell);
        costBasisOfSoldShares += lot.price * sharesToSellFromLot;
        buyingChargesTotal += lot.extraChargesPerShare * sharesToSellFromLot;
        remainingToSell -= sharesToSellFromLot;
      }
      if (remainingToSell <= 0) break;
    }

    // Calculate extra charges for the sell transaction
    const sellCharges = calculateExtraCharges(sellValue, -sellQuantity); // use negative for sell

    // Calculate total charges (buying + selling)
    const totalCharges = buyingChargesTotal + sellCharges;

    // Calculate profit/loss (includes both buying and selling charges)
    const profitLoss = sellValue - costBasisOfSoldShares - totalCharges;

    setLiveProfit({
      calculated: true,
      sellValue: sellValue,
      originalCost: costBasisOfSoldShares,
      buyingCharges: buyingChargesTotal,
      sellingCharges: sellCharges,
      totalCharges: totalCharges,
      profitLoss: profitLoss,
      quantity: sellQuantity,
      isBuy: false
    });
  }
};

// ... existing code ...
  // Update the useEffect to include transactionType in the dependencies
  useEffect(() => {
    calculateLiveProfit();
  }, [quickPrice, quickQuantity, companyName, transactionType]);

  // Find and modify the useEffect that handles page unload events
  useEffect(() => {
    let exitNotification = null;
    
    // Show notification only when user is navigating away from the site
    const handleBeforeUnload = (event) => {
      // Don't clear localStorage, just show the export notification
      if (!exitNotification) {
        exitNotification = document.createElement('div');
        exitNotification.className = 'exit-notification';
        exitNotification.innerHTML = 'Please export your data before leaving!';
        document.body.appendChild(exitNotification);
        
        // Remove the notification after a short delay
        setTimeout(() => {
          if (exitNotification && exitNotification.parentNode) {
            exitNotification.parentNode.removeChild(exitNotification);
            exitNotification = null;
          }
        }, 3000);
      }
      
      // Standard method for modern browsers to show a confirmation dialog
      event.preventDefault();
      event.returnValue = ''; // Required for Chrome
    };
    
    // Add event listener for beforeunload
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (exitNotification && exitNotification.parentNode) {
        exitNotification.parentNode.removeChild(exitNotification);
      }
    };
  }, []);

  // If there's a handleVisibilityChange function that clears localStorage, modify it:
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // Only show notification, don't clear localStorage
      const notification = document.createElement('div');
      notification.className = 'exit-notification';
      notification.innerHTML = 'Please export your data before leaving!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);
    }
  };

  // Add this useEffect to handle responsive columns
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      
      // Adjust visible columns based on screen width with your priority order
       if (window.innerWidth < 700) {
        setVisibleColumns(['id', 'price', 'quantity', 'totalInvestment', 'extraCharges']);
      } else if (window.innerWidth < 900) {
        setVisibleColumns(['id', 'price', 'quantity', 'totalInvestment', 'extraCharges', 'averagePrice']);
      } else {
        setVisibleColumns(['id', 'price', 'quantity', 'totalInvestment', 'extraCharges', 'averagePrice', 'totalExtraCharges', 'totalShares']);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial state
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Add this function to replace a column
  const replaceColumn = (columnToAdd) => {
    if (visibleColumns.includes(columnToAdd)) return;
    
    // Define the full priority order - updated with your specified order
    const priorityOrder = [
      'id', 'price', 'quantity', 'totalInvestment',
      'extraCharges', 'averagePrice', 'totalExtraCharges', 'totalShares'
    ];
    
    // Find the lowest priority visible column
    const lowestPriorityColumn = [...visibleColumns].sort((a, b) => {
      return priorityOrder.indexOf(a) - priorityOrder.indexOf(b);
    }).pop();
    
    // Replace it with the column to add
    setVisibleColumns(prev => 
      prev.map(col => col === lowestPriorityColumn ? columnToAdd : col)
    );
    
    setShowColumnSelector(false);
  };

  // Add this function to toggle the menu
  const toggleUtilityMenu = () => {
    setShowUtilityMenu(!showUtilityMenu);
  };

  // Add this function to toggle the panel
  const toggleUtilityPanel = () => {
    setShowUtilityPanel(!showUtilityPanel);
  };

  // Add a function to calculate detailed breakdown of charges for selected transactions
  const calculateDetailedCharges = () => {
    if (selectedTransactions.length === 0) {
      return {
        brokerage: 0,
        stt: 0,
        exchangeCharge: 0,
        sebiTurnover: 0,
        stampDuty: 0,
        ipf: 0,
        dpCharge: 0,
        gst: 0
      };
    }
    
    // Get selected transactions
    const selectedTxs = transactions.filter(tx => selectedTransactions.includes(tx.id));
    
    // Initialize charge totals
    let totalBrokerage = 0;
    let totalStt = 0;
    let totalExchangeCharge = 0;
    let totalSebiTurnover = 0;
    let totalStampDuty = 0;
    let totalIpf = 0;
    let totalDpCharge = 0;
    let totalGst = 0;
    
    // For each selected transaction, calculate its individual charges
    selectedTxs.forEach(tx => {
      const price = parseFloat(tx.price) || 0;
      const quantity = parseFloat(tx.quantity) || 0;
      const isSelling = quantity < 0;
      const absoluteValue = Math.abs(price * quantity);
      
      // Skip invalid transactions
      if (price === 0 || quantity === 0) return;
      
      // Calculate brokerage
      let brokerage = absoluteValue * 0.001; // 0.1%
      brokerage = Math.min(brokerage, 20); // Max cap
      brokerage = Math.max(brokerage, 2); // Min floor
      const brokerageLimit = absoluteValue * 0.025; // 2.5% limit
      brokerage = Math.min(brokerage, brokerageLimit);
      
      // STT is 0.1% for both buy and sell
      // Apply the custom rounding rule for STT
      const sttRaw = absoluteValue * 0.001;
      const stt = roundSTT(sttRaw);
      
      // Exchange charge is 0.00297% for both
      const exchangeCharge = absoluteValue * 0.0000297;
      
      // SEBI turnover is 0.0001% for both
      const sebiTurnover = absoluteValue * 0.000001;
      
      // IPF is 0.0001% for both
      const ipf = absoluteValue * 0.000001;
      
      // GST calculation
      const gst = 0.18 * (brokerage + exchangeCharge + sebiTurnover);
      
      // Add to running totals
      totalBrokerage += brokerage;
      totalStt += stt;
      totalExchangeCharge += exchangeCharge;
      totalSebiTurnover += sebiTurnover;
      totalIpf += ipf;
      totalGst += gst;
      
      if (isSelling) {
        // Selling specific charges - updated with fixed DP charge
        const dpCharge = gender === 'female' ? 21.54 : 21.83;
        totalDpCharge += dpCharge;
      } else {
        // Buying specific charge - Stamp Duty
        const stampDuty = absoluteValue * 0.00015; // 0.015%
        totalStampDuty += stampDuty;
      }
    });
    
    return {
      brokerage: totalBrokerage,
      stt: totalStt,
      exchangeCharge: totalExchangeCharge,
      sebiTurnover: totalSebiTurnover,
      stampDuty: totalStampDuty,
      ipf: totalIpf,
      dpCharge: totalDpCharge,
      gst: totalGst
    };
  };

  // Helper function to recalculate the sum with properly rounded STT values
  const calculateTotalWithRoundedSTT = () => {
    // Skip if no transactions selected
    if (selectedTransactions.length === 0) {
      return { totalInvestment: 0, totalShares: 0, totalExtraCharges: 0 };
    }
    
    // Get selected transactions
    const selectedTxs = transactions.filter(tx => selectedTransactions.includes(tx.id));
    
    // Calculate direct sum of selected transactions
    let totalInvestment = 0;
    let totalShares = 0;
    let totalExtraCharges = 0;
    
    // For each selected transaction
    selectedTxs.forEach(tx => {
      const price = parseFloat(tx.price) || 0;
      const quantity = parseFloat(tx.quantity) || 0;
      
      // Skip invalid transactions
      if (price === 0 || quantity === 0) return;
      
      // Use proper STT rounding when calculating total extra charges
      const transactionValue = price * Math.abs(quantity);
      const extraChargesWithRoundedSTT = calculateExtraCharges(transactionValue, quantity);
      
      totalInvestment += price * quantity;
      totalShares += quantity;
      totalExtraCharges += extraChargesWithRoundedSTT;
    });
    
    return {
      totalInvestment,
      totalShares,
      totalExtraCharges
    };
  };

  // Add this handler function near your other handlers
  const handleRefresh = () => {
    updateTransactions();
    setTimeout(() => {
      saveAllData();
    }, 100);
  };

  // Helper: Get FIFO buy transaction IDs for a sell transaction, considering previous sells
  const getFifoBuyTransactionIds = (sellTxIndex) => {
    const sellTx = transactions[sellTxIndex];
    if (!sellTx || parseFloat(sellTx.quantity) >= 0) return [];

    let sellQuantity = Math.abs(parseFloat(sellTx.quantity));
    let fifoIds = [];
    let remainingToSell = sellQuantity;

    // Step 1: Build up the FIFO buy lots with remaining shares
    let buyLots = [];
    for (let i = 0; i < sellTxIndex; i++) {
      const tx = transactions[i];
      const price = parseFloat(tx.price) || 0;
      const quantity = parseFloat(tx.quantity) || 0;
      if (price > 0 && quantity > 0) {
        // Buy transaction: add to FIFO pool
        buyLots.push({ id: tx.id, remaining: quantity });
      } else if (quantity < 0) {
        // Sell transaction: reduce from FIFO pool
        let toSell = Math.abs(quantity);
        for (let lot of buyLots) {
          if (lot.remaining > 0) {
            const used = Math.min(lot.remaining, toSell);
            lot.remaining -= used;
            toSell -= used;
            if (toSell <= 0) break;
          }
        }
      }
    }

    // Step 2: For this sell, pick from FIFO buy lots with remaining shares
    for (let lot of buyLots) {
      if (lot.remaining > 0 && remainingToSell > 0) {
        fifoIds.push(lot.id);
        const used = Math.min(lot.remaining, remainingToSell);
        remainingToSell -= used;
      }
      if (remainingToSell <= 0) break;
    }

    return fifoIds;
  };

  // Helper: Calculate realized P/L for selected sell transactions only
  const calculateSellPL = () => {
    // Get selected sell transactions, sorted by table order
    const selectedSellTxs = transactions
      .filter(tx => selectedTransactions.includes(tx.id) && parseFloat(tx.quantity) < 0)
      .sort((a, b) => transactions.findIndex(t => t.id === a.id) - transactions.findIndex(t => t.id === b.id));

    if (selectedSellTxs.length === 0) return 0;

    // Build FIFO buy lots for all transactions up to each sell
    let fifoBuyLots = [];
    let totalSellPL = 0;

    transactions.forEach((tx, idx) => {
      const price = parseFloat(tx.price) || 0;
      const quantity = parseFloat(tx.quantity) || 0;
      const extraCharges = parseFloat(tx.extraCharges) || 0;

      if (price > 0 && quantity > 0) {
        fifoBuyLots.push({
          id: tx.id,
          price,
          quantity,
          remaining: quantity,
          extraCharges,
          extraChargesPerShare: extraCharges / quantity
        });
      }

      // If this is a selected sell, calculate its realized P/L
      if (selectedSellTxs.some(sellTx => sellTx.id === tx.id) && quantity < 0) {
        let sellQuantity = Math.abs(quantity);
        let remainingToSell = sellQuantity;
        let costBasis = 0;
        let buyCharges = 0;

        // FIFO: Use up buy lots
        for (let lot of fifoBuyLots) {
          if (lot.remaining > 0 && remainingToSell > 0) {
            const used = Math.min(lot.remaining, remainingToSell);
            costBasis += lot.price * used;
            buyCharges += lot.extraChargesPerShare * used;
            lot.remaining -= used;
            remainingToSell -= used;
          }
          if (remainingToSell <= 0) break;
        }

        const sellValue = price * sellQuantity;
        const sellCharges = extraCharges;
        const totalCharges = buyCharges + sellCharges;
        const profitLoss = sellValue - costBasis - totalCharges;

        totalSellPL += profitLoss;
      }

      // For sells, reduce from FIFO buy lots
      if (quantity < 0) {
        let toSell = Math.abs(quantity);
        for (let lot of fifoBuyLots) {
          if (lot.remaining > 0) {
            const used = Math.min(lot.remaining, toSell);
            lot.remaining -= used;
            toSell -= used;
            if (toSell <= 0) break;
          }
        }
      }
    });

    return totalSellPL;
  };

  // Helper to calculate FIFO cost basis and proportional buy charges for a sell
  const getFifoCostAndCharges = (transactions, sellQuantity) => {
    // Build up FIFO buy lots, accounting for previous sells
    let fifoBuyLots = [];
    transactions.forEach((tx) => {
      const txPrice = parseFloat(tx.price) || 0;
      const txQuantity = parseFloat(tx.quantity) || 0;
      const txExtraCharges = parseFloat(tx.extraCharges) || 0;
      if (txPrice > 0 && txQuantity > 0) {
        fifoBuyLots.push({
          price: txPrice,
          quantity: txQuantity,
          remaining: txQuantity,
          extraCharges: txExtraCharges,
          extraChargesPerShare: txExtraCharges / txQuantity
        });
      } else if (txQuantity < 0) {
        // For each sell, reduce from FIFO lots
        let toSell = Math.abs(txQuantity);
        for (let lot of fifoBuyLots) {
          if (lot.remaining > 0 && toSell > 0) {
            const used = Math.min(lot.remaining, toSell);
            lot.remaining -= used;
            toSell -= used;
            if (toSell <= 0) break;
          }
        }
      }
    });

    // For the new sell, use the remaining FIFO buy lots (do NOT mutate .remaining)
    let remainingToSell = sellQuantity;
    let costBasisOfSoldShares = 0;
    let buyingChargesTotal = 0;
    for (let lot of fifoBuyLots) {
      if (lot.remaining > 0 && remainingToSell > 0) {
        const sharesToSellFromLot = Math.min(lot.remaining, remainingToSell);
        costBasisOfSoldShares += lot.price * sharesToSellFromLot;
        buyingChargesTotal += lot.extraChargesPerShare * sharesToSellFromLot;
        remainingToSell -= sharesToSellFromLot;
      }
      if (remainingToSell <= 0) break;
    }
    return { costBasisOfSoldShares, buyingChargesTotal };
  };

  // Returns an array of { id, profitLoss, sellValue, costBasis, buyCharges, sellCharges, totalCharges }
  const calculateIndividualSellPLs = () => {
    // Get selected sell transactions, sorted by table order
    const selectedSellTxs = transactions
      .filter(tx => selectedTransactions.includes(tx.id) && parseFloat(tx.quantity) < 0)
      .sort((a, b) => transactions.findIndex(t => t.id === a.id) - transactions.findIndex(t => t.id === b.id));

    if (selectedSellTxs.length === 0) return [];

    let results = [];

    selectedSellTxs.forEach(sellTx => {
      // Find the index of this sell in the transaction list
      const sellIdx = transactions.findIndex(t => t.id === sellTx.id);

      // Build FIFO buy lots up to but NOT including this sell
      let fifoBuyLots = [];
      for (let i = 0; i < sellIdx; i++) {
        const tx = transactions[i];
        const price = parseFloat(tx.price) || 0;
        const quantity = parseFloat(tx.quantity) || 0;
        if (price > 0 && quantity > 0) {
          // Always recalculate buy extra charges
          const buyExtraCharges = calculateExtraCharges(price * quantity, quantity);
          fifoBuyLots.push({
            price,
            quantity,
            remaining: quantity,
            extraCharges: buyExtraCharges,
            extraChargesPerShare: buyExtraCharges / quantity
          });
        } else if (quantity < 0) {
          // For each sell, reduce from FIFO lots
          let toSell = Math.abs(quantity);
          for (let lot of fifoBuyLots) {
            if (lot.remaining > 0 && toSell > 0) {
              const used = Math.min(lot.remaining, toSell);
              lot.remaining -= used;
              toSell -= used;
              if (toSell <= 0) break;
            }
          }
        }
      }

      // Now, for this sell, calculate P/L using the FIFO lots as of this point
      const sellQuantity = Math.abs(parseFloat(sellTx.quantity) || 0);
      let remainingToSell = sellQuantity;
      let costBasis = 0;
      let buyCharges = 0;
      for (let lot of fifoBuyLots) {
        if (lot.remaining > 0 && remainingToSell > 0) {
          const used = Math.min(lot.remaining, remainingToSell);
          costBasis += lot.price * used;
          buyCharges += lot.extraChargesPerShare * used;
          remainingToSell -= used;
        }
        if (remainingToSell <= 0) break;
      }

      const sellValue = (parseFloat(sellTx.price) || 0) * sellQuantity;
      const sellCharges = calculateExtraCharges(sellValue, -sellQuantity);
      const totalCharges = buyCharges + sellCharges;
      const profitLoss = sellValue - costBasis - totalCharges;

      results.push({
        id: sellTx.id,
        profitLoss,
        sellValue,
        costBasis,
        buyCharges,
        sellCharges,
        totalCharges
      });
    });

    return results;
  };

  return (
    <div className="stock-analysis-container">
      {/* <p>dont knwo why grow have placed female dp charges on a male acc</p>
      <p>why stamp duty charges are not applide to every buy transaction i maek or is there any criteria to be satisfied for stamp charges to be apllied</p> */}
      
      {/* <h1>Stock Investment Analysis</h1> */}
      {/* <div className="top-controls">
        <button 
          className="charges-info-button"
          onClick={() => setShowChargesModal(true)}
        >
          View Charges Info
        </button>
        
        <button 
          className="calculator-button"
          onClick={() => setShowCalculator(!showCalculator)}
        >
          {showCalculator ? 'Hide Calculator' : 'Selected Transaction Sum Calculator'}
        </button>
      </div> */}

      {showCalculator && (
        <div className="calculator-container">
          <div className="calculator-header">
            <h3>Selected Transaction Summary</h3>
            <div className="calculator-actions">
              <button onClick={clearSelectedTransactions}>Clear Selection</button>
              <button onClick={() => setShowCalculator(false)}>Close</button>
            </div>
          </div>
          <div className="calculator-body">
            {/* Gender selection buttons */}
            
            
            <p>Select transactions from the table to calculate their sum.</p>
            {selectedTransactions.length > 0 ? (
              <div className="calculator-results">
                <div className="result-item">
                  <span>Selected Transactions:</span>
                  <span>{selectedTransactions.length}</span>
                </div>
                <div className="result-item">
                  <span>selected Total Shares left:</span>
                  <span>{calculateSelectedSum().totalShares.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                
                {/* Add detailed charges breakdown section */}
                <div className="charges-breakdown">
                  <h4>Charges Breakdown:</h4>
                  {/* Common charges */}
                  <div className="charge-item">
                    <span className="charge-name">Brokerage:</span>
                    <span className="charge-value">₹{calculateDetailedCharges().brokerage.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="charge-item">
                    <span className="charge-name">STT:</span>
                    <span className="charge-value">₹{calculateDetailedCharges().stt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="charge-item">
                    <span className="charge-name">Exchange Charge:</span>
                    <span className="charge-value">₹{calculateDetailedCharges().exchangeCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="charge-item">
                    <span className="charge-name">SEBI Turnover:</span>
                    <span className="charge-value">₹{calculateDetailedCharges().sebiTurnover.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="charge-item">
                    <span className="charge-name">IPF:</span>
                    <span className="charge-value">₹{calculateDetailedCharges().ipf.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="charge-item">
                    <span className="charge-name">GST:</span>
                    <span className="charge-value">₹{calculateDetailedCharges().gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  
                  {/* Buy specific charges */}
                  {calculateDetailedCharges().stampDuty > 0 && (
                    <div className="charge-item">
                      <span className="charge-name">Stamp Duty:</span>
                      <span className="charge-value">0.015% (rounded to 0 if less than ₹1)</span>
                    </div>
                  )}
                  
                  {calculateDetailedCharges().dpCharge > 0 && (
                    <div className="charge-item">
                      <span className="charge-name">DP Charges:</span>
                      <span className="charge-value">₹{calculateDetailedCharges().dpCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
                
                <div className="result-item">
                  <span>Total Extra Charges:</span>
                  <span>₹{calculateTotalWithRoundedSTT().totalExtraCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="result-item total">
                  <span>
                    {showSellPL ? "Profit/Loss of Sell:" : "Total profit/loss:"}
                  </span>
                  <span>
                    {showSellPL && calculateIndividualSellPLs().length > 1 ? (
                      // Show each sell's P/L side by side
                      calculateIndividualSellPLs().map((pl, idx) => (
                        <span key={pl.id} style={{ marginRight: 12 }}>
                          Tx#{pl.id}: {pl.profitLoss >= 0 ? '+' : '-'}₹
                          {Math.abs(pl.profitLoss).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ))
                    ) : showSellPL ? (
                      // Fallback: show total sell P/L if only one sell or not multiple
                      calculateSellPL() >= 0
                        ? `+₹${calculateSellPL().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `-₹${Math.abs(calculateSellPL()).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ) : (
                      calculateSelectedSum().totalInvestment >= 0
                        ? `+₹${calculateSelectedSum().totalInvestment.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `-₹${Math.abs(calculateSelectedSum().totalInvestment).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </span>
                  <button
                    className="swap-pl-button"
                    style={{ marginLeft: '10px', fontSize: '0.9em', padding: '2px 8px' }}
                    onClick={() => setShowSellPL(pl => !pl)}
                    title="Swap between total and sell-only profit/loss"
                  >
                    Swap
                  </button>
                </div>
                {hasSellTransactionsSelected() && (
                  <div className="calculator-warning">
                    Note: Selection includes sell transactions. The calculation shows the direct sum of buy minus sell transactions.
                  </div>
                )}
                <div className="calculator-info">
                  This calculator shows the sum of only the checked rows, not cumulative totals.
                </div>
              </div>
            ) : (
              <p className="no-selection">No transactions selected</p>
            )}
          </div>
        </div>
      )}

      {showChargesModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Extra Charges Breakdown</h2>
              <button 
                className="modal-close"
                onClick={() => setShowChargesModal(false)}
              >
                ×
              </button>
            </div>
            <p>All charges are included in extra charges calculation</p>
            <div className="charges-list">
              <h3>Charges for Buy and Sell:</h3>
              <div className="charge-item">
                <span className="charge-name">Brokerage:</span>
                <span className="charge-value">0.1% (min ₹2, max ₹20)</span>
              </div>
              <div className="charge-item">
                <span className="charge-name">STT:</span>
                <span className="charge-value">0.1%</span>
              </div>
              <div className="charge-item">
                <span className="charge-name">GST:</span>
                <span className="charge-value">18% on (Brokerage + Exchange + SEBI fees)</span>
              </div>

              <h3>Buy Specific Charges:</h3>
              <div className="charge-item">
                <span className="charge-name">Stamp Duty:</span>
                <span className="charge-value">0.015%</span>
              </div>
              <div className="charge-item">
                <span className="charge-name">Exchange Transaction Charge:</span>
                <span className="charge-value">0.00297%</span>
              </div>
              <div className="charge-item">
                <span className="charge-name">SEBI Turnover:</span>
                <span className="charge-value">0.0001%</span>
              </div>
              <div className="charge-item">
                <span className="charge-name">IPF:</span>
                <span className="charge-value">0.0001%</span>
              </div>

              <h3 className="sell-charges-header">Sell Specific Charges:</h3>
              <div className="charge-item">
                <span className="charge-name">Exchange Transaction Charge:</span>
                <span className="charge-value">0.00297%</span>
              </div>
              <div className="charge-item">
                <span className="charge-name">SEBI Turnover:</span>
                <span className="charge-value">0.0001%</span>
              </div>
              <div className="charge-item">
                <span className="charge-name">IPF:</span>
                <span className="charge-name">0.0001%</span>
              </div>
              <div className="charge-item">
                <span className="charge-name">DP Charges:</span>
                <span className="charge-value">₹21.83 (Male), ₹21.54 (Female)</span>
              </div>
              <div className="charge-item">
                <span className="charge-name">Groww Charges:</span>
                <span className="charge-value">Rs15 per scrip per day (Rs0 if debit value {'<'} Rs50)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProfitLossModal && (
        <div className="modal-overlay">
          <div className="modal-content profit-loss-modal">
            <div className="modal-header">
              <h2>Transaction Summary</h2>
              <button 
                className="modal-close"
                onClick={() => setShowProfitLossModal(false)}
              >
                ×
              </button>
            </div>
            <div className="profit-loss-details">
              <h3>Sell Transaction for {companyName}</h3>
              
              <div className="transaction-summary">
                <div className="summary-item">
                  <span className="summary-label">Sold Quantity:</span>
                  <span className="summary-value">{profitLossInfo.quantity} shares</span>
                </div>
                
                <div className="summary-item">
                  <span className="summary-label">Selling Value:</span>
                  <span className="summary-value">₹{profitLossInfo.sellValue}</span>
                </div>
                
                <div className="summary-item">
                  <span className="summary-label">Original Cost:</span>
                  <span className="summary-value">₹{profitLossInfo.originalCost}</span>
                </div>
                
                <div className="summary-item">
                  <span className="summary-label">Buying Charges:</span>
                  <span className="summary-value">₹{profitLossInfo.buyingCharges}</span>
                </div>
                
                <div className="summary-item">
                  <span className="summary-label">Selling Charges:</span>
                  <span className="summary-value">₹{profitLossInfo.sellingCharges}</span>
                </div>
                
                <div className="summary-item">
                  <span className="summary-label">Total Charges:</span>
                  <span className="summary-value">₹{profitLossInfo.totalCharges}</span>
                </div>
                
                <div className="summary-item result">
                  <span className="summary-label">Profit/Loss:</span>
                  <span className={`summary-value ${parseFloat(profitLossInfo.profitLoss) >= 0 ? "profit" : "loss"}`}>
                    {parseFloat(profitLossInfo.profitLoss) >= 0 ? 
                      `Profit: ₹${profitLossInfo.profitLoss}` : 
                      `Loss: ₹${Math.abs(parseFloat(profitLossInfo.profitLoss)).toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`utility-panel-container ${showUtilityPanel ? 'open' : ''}`}>
          <span className="arrow-icon" onClick={toggleUtilityPanel}>{showUtilityPanel ? '▲' : '▼'}</span>
        
        <div className="utility-panel">
          <div className="utility-section">
          <div className="gender-selection">
              <span>Investor Gender:</span>
              <div className="gender-buttons">
                <button 
                  className={gender === 'male' ? 'active' : ''}
                  onClick={() => {
                    setGender('male');
                    // Recalculate all transactions with updated gender setting
                    setTimeout(updateTransactions, 50);
                  }}
                >
                  Male
                </button>
                <button 
                  className={gender === 'female' ? 'active' : ''}
                  onClick={() => {
                    setGender('female');
                    // Recalculate all transactions with updated gender setting
                    setTimeout(updateTransactions, 50);
                  }}
                >
                  Female
                </button>
              </div>
            </div>
            <h3>Data Management</h3>
            <div className="utility-buttons">
              <button 
                className="utility-button"
                onClick={()=>{exportCompaniesToFile();toggleUtilityPanel();}}
                title="Download your companies data as a file"
              >
                Export Data
              </button>
              
              <button 
                className="utility-button"
                onClick={() => {document.getElementById('import-companies-input').click();toggleUtilityPanel();}}
                title="Replace all companies with data from a file"
              >
                Import Data
              </button>
              
              <button 
                className="utility-button danger"
                onClick={()=>{clearLocalStorage();}}
                title="Clear all data from localStorage"
              >
                Clear All Data
              </button>
            </div>
          </div>
          
          <div className="utility-section">
            <h3>Company Management</h3>
            <div className="utility-buttons">
              <button 
                className="utility-button"
                onClick={()=>{clearForm(true);toggleUtilityPanel();}}
                title="Create a new company"
              >
                New Company
              </button>
              
              {companies.some(c => c.name === companyName) && !isNewCompanyMode && (
                <button
                  className="utility-button danger"
                  onClick={e => deleteCompany(companyName, e)}
                  title="Delete this company"
                >
                  Delete Company
                </button>
              )}
            </div>
          </div>
          
          <div className="utility-section">
            <h3>Transaction Tools</h3>
            <div className="utility-buttons">
              <button
                className="utility-button"
                onClick={() => {setShowCalculator(!showCalculator);toggleUtilityPanel();}}
                title="Toggle transaction calculator"
              >
                {!showCalculator&& 'Selected transaction Summary'}
              </button>
              
              
            </div>
            
           
          </div>
        </div>
      </div>

      {/* Keep the hidden file input for import */}
      <input
        type="file"
        id="import-companies-input"
        accept=".json"
        style={{ display: 'none' }}
        onChange={importCompaniesFromFile}
      />

 

      <div className="company-controls">
        <div className="company-input">
          <div className="company-select-container">
            <select
              value={companyName || ""}
              onChange={e => {
                const selectedName = e.target.value;
                if (selectedName === "") {
                  clearForm(false); // Clear form without showing input
                } else {
                  setCompanyName(selectedName);
                  setIsNewCompanyMode(false);
                  const selectedCompany = companies.find(c => c.name === selectedName);
                  if (selectedCompany) {
                    loadCompanyData(selectedCompany, null);
                  }
                }
              }}
              className="company-select"
            >
              <option value="">Select Company</option>
              {companies
                .filter(company => company.name !== "_TransactionHistory")
                .map((company, index) => (
                  <option key={index} value={company.name}>
                    {company.name}
                  </option>
                ))}
            </select>
            
            {!isNewCompanyMode && transactions.length > 0 && (
              <div className="total-shares-display">
                <span className="total-shares-label">Total Shares:</span>
                <span className="total-shares-value">
                  {transactions[transactions.length - 1]?.totalShares?.toFixed(2) || '0.00'}
                </span>
              </div>
            )}
          </div>
          
          {isNewCompanyMode && (
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Enter New Company Name"
              className="company-name-input"
            />
          )}
          
          {/* Quick Transaction Form with Save Button and Total Cost/Profit Display */}
          <div className="quick-transaction">
            <div className="quick-transaction-inputs">
              <select 
                className="transaction-type-select"
                value={transactionType}
                onChange={e => {
                  const isSellSelected = e.target.value === 'sell';
                  setTransactionType(e.target.value);
                  
                  if (quickQuantity) {
                    // If there's an existing quantity, make it negative for sell or positive for buy
                    const absQuantity = Math.abs(parseFloat(quickQuantity)).toString();
                    setQuickQuantity(isSellSelected ? '-' + absQuantity : absQuantity);
                  }
                  
                  // Force recalculation of profit/loss immediately
                  setTimeout(calculateLiveProfit, 0);
                }}
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
              <input
                type="number"
                value={quickPrice}
                onChange={e => setQuickPrice(e.target.value)}
                placeholder="Price"
                className="quick-input"
                step="0.01"
              />
              <input
                type="text"
                value={quickQuantity ? Math.abs(parseFloat(quickQuantity)).toString() : ''}
                onChange={e => {
                  // Only allow positive numbers
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  
                  // Apply sign based on transaction type
                  setQuickQuantity(transactionType === 'sell' ? '-' + value : value);
                }}
                placeholder="Quantity"
                className="quick-input"
                inputMode="decimal"
              />
            </div>
            
            <div className="save-button-container">
              <button 
                className="save-button"
                onClick={handleSaveTransactions}
                title="Save Transactions"
              >
                Save Transactions
              </button>
              
              {/* Inline Total Cost/Profit Display */}
              {liveProfit.calculated && (
                <div className="inline-profit-display">
                  {liveProfit.isBuy ? (
                    <span className="total-cost">
                      Total Cost: ₹{(liveProfit.originalCost + liveProfit.buyingCharges).toFixed(2)}
                    </span>
                  ) : (
                    <span className={`total-profit ${liveProfit.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                      {liveProfit.profitLoss >= 0 ? 'Profit: ' : 'Loss: '}
                      ₹{Math.abs(liveProfit.profitLoss).toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Remove the original live profit display that was below the inputs */}
        </div>
        <button 
          className="refresh-button"
          onClick={handleRefresh}
          title="Recalculate and Save All Data"
          style={{ marginLeft: '10px', background: '#4caf50', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
        >
          Refresh ♻️
        </button>
      </div>

      <table className="investment-table">
        <thead>
          <tr>
            {showCalculator && <th className="select-column">Select</th>}
            {visibleColumns.includes('id') && <th>id</th>}
            {visibleColumns.includes('price') && <th>Price (₹)</th>}
            {visibleColumns.includes('quantity') && <th>Qtn</th>}
            {visibleColumns.includes('totalShares') && <th>Total Shares</th>}
            {visibleColumns.includes('extraCharges') && <th>Extra Charges (₹)</th>}
            {visibleColumns.includes('totalExtraCharges') && <th>Total Extra Charges (₹)</th>}
            {visibleColumns.includes('totalInvestment') && <th>Total Investment(no extra charges) (₹)</th>}
            {visibleColumns.includes('averagePrice') && <th>Average Price (₹)</th>}
            <th>
              <button 
                className="column-selector-button" 
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                title="Select columns"
              >
                ⋮
              </button>
              {showColumnSelector && (
                <div className="column-selector-dropdown">
                  <h4>Select column to show:</h4>
                  {['id', 'price', 'quantity', 'totalShares', 'totalInvestment', 
                    'extraCharges', 'averagePrice', 'totalExtraCharges'].map(col => (
                    <div 
                      key={col} 
                      className={`column-option ${visibleColumns.includes(col) ? 'active' : ''}`}
                      onClick={() => replaceColumn(col)}
                    >
                      {col === 'id' ? 'Transaction #' : 
                      col === 'price' ? 'Price' :
                      col === 'quantity' ? 'Quantity' :
                      col === 'totalShares' ? 'Total Shares' :
                      col === 'extraCharges' ? 'Extra Charges' :
                      col === 'totalExtraCharges' ? 'Total Extra Charges' :
                      col === 'totalInvestment' ? 'Total Investment' :
                      'Average Price'}
                    </div>
                  ))}
                </div>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => (
            <tr key={transaction.id} className={transaction.quantity < 0 ? "sell-transaction" : ""}>
              {showCalculator && (
                <td className="select-column">
                  <input
                    type="checkbox"
                    checked={selectedTransactions.includes(transaction.id)}
                    onChange={() => toggleTransactionSelection(transaction.id)}
                  />
                </td>
              )}
              {visibleColumns.includes('id') && <td>{transaction.id}</td>}
              {visibleColumns.includes('price') && (
                <td>
                  <input
                    type="text"
                    value={transaction.price}
                    onChange={(e) => handleInputChange(index, 'price', e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="Enter price"
                    inputMode="decimal"
                  />
                </td>
              )}
              {visibleColumns.includes('quantity') && (
                <td>
                  <input
                    type="text"
                    value={transaction.quantity}
                    onChange={(e) => handleInputChange(index, 'quantity', e.target.value.replace(/[^0-9.\-]/g, ''))}
                    placeholder="Enter quantity"
                    inputMode="decimal"
                  />
                </td>
              )}
              {visibleColumns.includes('totalShares') && <td>{transaction.totalShares?.toFixed(2) || '0.00'}</td>}
              {visibleColumns.includes('extraCharges') && <td>{transaction.extraCharges?.toFixed(2) || '0.00'}</td>}
              {visibleColumns.includes('totalExtraCharges') && <td>{transaction.totalExtraCharges?.toFixed(2) || '0.00'}</td>}
              {visibleColumns.includes('totalInvestment') && <td>{transaction.totalInvestment?.toFixed(2) || '0.00'}</td>}
              {visibleColumns.includes('averagePrice') && <td>{transaction.averagePrice?.toFixed(2) || '0.00'}</td>}
              <td className="delete-transaction-cell">
                <button 
                  className="delete-transaction-button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteTransaction(index, e);
                    return false;
                  }}
                  title="Delete transaction"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        {transactions.length > 0 && (
          <tfoot>
            <tr>
              {showCalculator && <td></td>}
              {visibleColumns.includes('id') && <td>Total</td>}
              {visibleColumns.includes('price') && <td></td>}
              {visibleColumns.includes('quantity') && <td></td>}
              {visibleColumns.includes('totalShares') && <td>{transactions[transactions.length - 1]?.totalShares?.toFixed(2) || '0.00'}</td>}
              {visibleColumns.includes('extraCharges') && <td>{transactions.reduce((sum, t) => sum + (t.extraCharges || 0), 0).toFixed(2)}</td>}
              {visibleColumns.includes('totalExtraCharges') && <td>{transactions[transactions.length - 1]?.totalExtraCharges?.toFixed(2) || '0.00'}</td>}
              {visibleColumns.includes('totalInvestment') && <td>{transactions[transactions.length - 1]?.totalInvestment?.toFixed(2) || '0.00'}</td>}
              {visibleColumns.includes('averagePrice') && <td>-</td>}
              <td></td>
            </tr>
          </tfoot>
        )}
      </table>
      
      {/* Show the add row button only when a company is selected */}
     
    </div>
  );
};

export default StockAnalysis;