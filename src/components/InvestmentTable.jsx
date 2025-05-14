import React, { useState, useEffect } from 'react';
import './InvestmentTable.css';


const StockAnalysis = () => {
  const [companyName, setCompanyName] = useState('');
  const [companies, setCompanies] = useState([]);
  const [transactions, setTransactions] = useState([
    { id: 1, price: '', quantity: '', totalInvestment: 0, totalShares: 0, averagePrice: 0, extraCharges: 0, totalExtraCharges: 0 }
  ]);
  const [showChargesModal, setShowChargesModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState([]);

  // Load companies from localStorage when component mounts
  useEffect(() => {
    const savedCompanies = localStorage.getItem('companies');
    if (savedCompanies) {
      try {
        const parsedCompanies = JSON.parse(savedCompanies);
        console.log("Loaded companies from localStorage:", parsedCompanies);
        setCompanies(parsedCompanies);
      } catch (error) {
        console.error("Error parsing companies from localStorage:", error);
      }
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
    const stt = absoluteValue * 0.001;

    if (isSelling) {
      // Selling charges
      const exchangeCharge = absoluteValue * 0.0000297; // 0.00297%
      const sebiTurnover = absoluteValue * 0.000001;    // 0.0001%
      const ipf = absoluteValue * 0.000001;             // 0.0001%
      const depository = 3.5;  // Fixed charge
      const growwFee = absoluteValue >= 100 ? 15 : 0;   // ₹15 if value >= ₹100

      // Calculate GST (18% on brokerage + exchange + sebi)
      const gst = 0.18 * (brokerage + exchangeCharge + sebiTurnover);
      
      return stt + brokerage + exchangeCharge + sebiTurnover + ipf + depository + growwFee + gst;
    } else {
      // Buying charges
      const stampDuty = absoluteValue * 0.00015;   // 0.015%
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
    const lastRow = transactions[transactions.length - 1];
    const newId = lastRow.id + 1;
    
    setTransactions([
      ...transactions,
      { id: newId, price: '', quantity: '', totalInvestment: 0, totalShares: 0, averagePrice: 0, extraCharges: 0, totalExtraCharges: 0 }
    ]);
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
      
      // First update the UI with the new transactions
      const updatedTransactions = calculateUpdatedTransactions(renumberedTransactions);
      setTransactions(updatedTransactions);
      
      // Now update the transaction history in localStorage AND the JSON file
      const savedData = localStorage.getItem('companies');
      if (savedData && companyName) {
        const allCompanies = JSON.parse(savedData);
        
        // Find the transaction history object
        const historyIndex = allCompanies.findIndex(c => c.name === "_TransactionHistory");
        
        if (historyIndex >= 0) {
          // Log for debugging
          console.log("Found _TransactionHistory in companies data");
          
          // Create a new array of transactions without the deleted one
          // This is the critical part that needs fixing
          const updatedHistoryTransactions = allCompanies[historyIndex].transactions.filter(tx => {
            // Make sure we're not removing transactions from other companies
            if (tx.companyName !== companyName) {
              return true;
            }
            
            // For this company, remove the transaction with matching ID
            return tx.transactionNumber !== transactionIdToDelete;
          });
          
          console.log(`Before filtering: ${allCompanies[historyIndex].transactions.length}, After: ${updatedHistoryTransactions.length}`);
          
          // Update transaction numbers for all transactions of this company that had higher numbers
          updatedHistoryTransactions.forEach(tx => {
            if (tx.companyName === companyName && tx.transactionNumber > transactionIdToDelete) {
              tx.transactionNumber -= 1;
            }
          });
          
          // Replace the transactions array
          allCompanies[historyIndex].transactions = updatedHistoryTransactions;
          
          // Save back to localStorage
          localStorage.setItem('companies', JSON.stringify(allCompanies));
          
          // Update companies state
          setCompanies(allCompanies);
          
          console.log("Transaction history updated in localStorage and JSON file");
        }
      }
      
      // Auto-save the changes to update the company data
      setTimeout(() => autoSaveChanges(), 100);
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
          
          // Calculate extra charges
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
              const sharesToSellFromLot = Math.min(buyLot.remaining, remainingToSell);
              
              // Calculate cost basis of these shares
              costBasisOfSoldShares += (buyLot.price * sharesToSellFromLot);
              
              // Reduce remaining shares in this lot
              buyLot.remaining -= sharesToSellFromLot;
              
              // Reduce remaining shares to sell
              remainingToSell -= sharesToSellFromLot;
            }
          }
          
          // Update running totals
          runningTotalShares -= sellQuantity;
          runningTotalInvestment -= costBasisOfSoldShares;
          
          // Calculate selling value and extra charges
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

  const clearForm = () => {
    console.log("Clearing form explicitly called");
    
    // Close the calculator if it's open to prevent errors
    if (showCalculator) {
      setShowCalculator(false);
      setSelectedTransactions([]);
    }
    
    setCompanyName('');
    setTransactions([
      { id: 1, price: '', quantity: '', totalInvestment: 0, totalShares: 0, averagePrice: 0, extraCharges: 0, totalExtraCharges: 0 }
    ]);
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
      
      // Create a Blob with the data
      const blob = new Blob([savedCompanies], { type: 'application/json' });
      
      // Create a temporary URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a link element
      const link = document.createElement('a');
      link.href = url;
      
      // Set the filename with current date
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      link.download = `investment-companies-${date}.json`;
      
      // Append link to body, click it, and remove it
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Release the URL object
      URL.revokeObjectURL(url);
      
      console.log('Companies data exported successfully');
    } catch (error) {
      console.error('Error exporting companies data:', error);
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
          const importedCompanies = JSON.parse(contents);
          
          // Validate that it's an array
          if (!Array.isArray(importedCompanies)) {
            throw new Error('Invalid data format');
          }
          
          // Ask for confirmation
          if (window.confirm(`This will import ${importedCompanies.length} companies. Continue?`)) {
            // Save to localStorage
            localStorage.setItem('companies', contents);
            
            // Update state
            setCompanies(importedCompanies);
            
            // Clear current form
            clearForm();
            
            alert('Companies data imported successfully');
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
      console.error('Error importing companies data:', error);
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
      localStorage.removeItem('companies');
      setCompanies([]);
      clearForm();
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
    if (selectedTransactions.includes(id)) {
      setSelectedTransactions(selectedTransactions.filter(txId => txId !== id));
    } else {
      setSelectedTransactions([...selectedTransactions, id]);
    }
  };

  // Add a function to calculate the sum of selected transactions
  const calculateSelectedSum = () => {
    if (selectedTransactions.length === 0) return { totalInvestment: 0, totalShares: 0, totalExtraCharges: 0 };
    
    // Get selected transactions
    const selectedTxs = transactions.filter(tx => selectedTransactions.includes(tx.id));
    
    // Calculate direct sum of selected transactions
    let totalInvestment = 0;
    let totalShares = 0;
    let totalExtraCharges = 0;
    
    // For each selected transaction, calculate its individual contribution
    selectedTxs.forEach(tx => {
      const price = parseFloat(tx.price) || 0;
      const quantity = parseFloat(tx.quantity) || 0;
      
      // Skip invalid transactions
      if (price === 0 || quantity === 0) return;
      
      // For buy transactions (positive quantity)
      if (quantity > 0) {
        totalInvestment += price * quantity;
        totalShares += quantity;
        totalExtraCharges += parseFloat(tx.extraCharges) || 0;
      } 
      // For sell transactions (negative quantity)
      else if (quantity < 0) {
        // For sells, we need to use FIFO to determine the correct cost basis
        // This is complex to implement here, so we'll show a warning instead
        // and use the transaction's direct values
        totalShares += quantity; // Will reduce the total (quantity is negative)
        totalExtraCharges += parseFloat(tx.extraCharges) || 0;
        
        // For sell transactions, we'll use the absolute value of quantity * price
        // as a negative investment value
        totalInvestment -= Math.abs(price * quantity);
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

  return (
    <div className="stock-analysis-container">
      <h1>Stock Investment Analysis</h1>
      <p>Aim for investing in stock market is not to make living out of it but rather to overcome the inflation so i dont need to worry on medium changes in stock price</p>
      <div className="top-controls">
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
      </div>

      {showCalculator && (
        <div className="calculator-container">
          <div className="calculator-header">
            <h3>Transaction Calculator</h3>
            <div className="calculator-actions">
              <button onClick={clearSelectedTransactions}>Clear Selection</button>
              <button onClick={() => setShowCalculator(false)}>Close</button>
            </div>
          </div>
          <div className="calculator-body">
            <p>Select transactions from the table to calculate their sum.</p>
            {selectedTransactions.length > 0 ? (
              <div className="calculator-results">
                <div className="result-item">
                  <span>Selected Transactions:</span>
                  <span>{selectedTransactions.length}</span>
                </div>
                <div className="result-item">
                  <span>Total Shares:</span>
                  <span>{calculateSelectedSum().totalShares.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="result-item">
                  <span>Total Extra Charges:</span>
                  <span>₹{calculateSelectedSum().totalExtraCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="result-item total">
                  <span>Total Investment:</span>
                  <span>₹{calculateSelectedSum().totalInvestment.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                <span className="charge-value">0.0001%</span>
              </div>
              <div className="charge-item">
                <span className="charge-name">Depository:</span>
                <span className="charge-value">₹3.5 (Fixed)</span>
              </div>
              <div className="charge-item">
                <span className="charge-name">Groww Fee:</span>
                <span className="charge-value">₹15 (only if transaction value ≥ ₹100)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="navigation-header">
        <button 
          className="new-company-button"
          onClick={clearForm}
        >
          New Company
        </button>
        <div className="current-company">
          {companyName && <span>Current Company: {companyName}</span>}
        </div>
        
        {/* Simplified data backup/restore controls */}
        <div className="data-controls">
          <button 
            className="data-button"
            onClick={exportCompaniesToFile}
            title="Download your companies data as a file"
          >
            Export Data
          </button>
          
          {/* Hidden file input for import */}
          <input
            type="file"
            id="import-companies-input"
            accept=".json"
            style={{ display: 'none' }}
            onChange={importCompaniesFromFile}
          />
          <button 
            className="data-button"
            onClick={() => document.getElementById('import-companies-input').click()}
            title="Replace all companies with data from a file"
          >
            Import Data
          </button>
          
          {/* Add the clear localStorage button */}
          <button 
            className="data-button"
            onClick={clearLocalStorage}
            title="Clear all data from localStorage"
            style={{ backgroundColor: '#dc3545', color: 'white' }}
          >
            Clear All Data
          </button>
        </div>
      </div>

      <div className="company-controls">
        <div className="company-input">
          <select
            value={companyName ? companyName : "__new__"}
            onChange={e => {
              const selectedName = e.target.value;
              if (selectedName === "__new__") {
                // Just clear the company name and reset transactions
                setCompanyName('');
                setTransactions([
                  { id: 1, price: '', quantity: '', totalInvestment: 0, totalShares: 0, averagePrice: 0, extraCharges: 0, totalExtraCharges: 0 }
                ]);
              } else {
                // Load existing company
                setCompanyName(selectedName);
                const selectedCompany = companies.find(c => c.name === selectedName);
                if (selectedCompany) {
                  loadCompanyData(selectedCompany, null);
                }
              }
            }}
            className="company-select"
          >
            <option value="__new__">+ New Company</option>
            {companies
              .filter(company => company.name !== "_TransactionHistory")
              .map((company, index) => (
                <option key={index} value={company.name}>
                  {company.name}
                </option>
              ))}
          </select>
          
          {/* Show input only when new company mode is active */}
          {!companies.some(c => c.name === companyName) && (
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Enter New Company Name"
              className="company-name-input"
            />
          )}
          
          <button className="save-button" onClick={saveAllData}>
            Save Transactions
          </button>
          
          {/* Add delete button that shows only when an existing company is selected */}
          {companies.some(c => c.name === companyName) && (
            <button
              className="delete-company-button"
              onClick={e => deleteCompany(companyName, e)}
              title="Delete this company"
            >
              Delete Company
            </button>
          )}
        </div>
      </div>

      <table className="investment-table">
        <thead>
          <tr>
            {showCalculator && <th className="select-column">Select</th>}
            <th>Transaction #</th>
            <th>Price (₹)</th>
            <th>Quantity</th>
            <th>Total Shares</th>
            <th>Extra Charges (₹)</th>
            <th>Total Extra Charges (₹)</th>
            <th>Total Investment (₹)</th>
            <th>Average Price (₹)</th>
            <th></th>
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
              <td>{transaction.id}</td>
              <td>
                <input
                  type="number"
                  value={transaction.price}
                  onChange={(e) => handleInputChange(index, 'price', e.target.value)}
                  placeholder="Enter price"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={transaction.quantity}
                  onChange={(e) => handleInputChange(index, 'quantity', e.target.value)}
                  placeholder="Enter quantity"
                />
              </td>
              <td>{transaction.totalShares?.toFixed(2) || '0.00'}</td>
              <td>{transaction.extraCharges?.toFixed(2) || '0.00'}</td>
              <td>{transaction.totalExtraCharges?.toFixed(2) || '0.00'}</td>
              <td>{transaction.totalInvestment?.toFixed(2) || '0.00'}</td>
              <td>{transaction.averagePrice?.toFixed(2) || '0.00'}</td>
              <td className="delete-transaction-cell">
                <button 
                  className="delete-transaction-button"
                  onClick={(e) => {
                    // Ensure the event doesn't propagate to other handlers
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Call the delete transaction function
                    deleteTransaction(index, e);
                    
                    return false; // Extra prevention of default behavior
                  }}
                  title="Delete transaction"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            {showCalculator && <td></td>}
            <td colSpan="3">Total</td>
            <td>{transactions[transactions.length - 1]?.totalShares?.toFixed(2) || '0.00'}</td>
            <td>
              {transactions.reduce((sum, t) => sum + (t.extraCharges || 0), 0).toFixed(2)}
            </td>
            <td>
              {transactions[transactions.length - 1]?.totalExtraCharges?.toFixed(2) || '0.00'}
            </td>
            <td>
              {transactions[transactions.length - 1]?.totalInvestment?.toFixed(2) || '0.00'}
            </td>
            <td>-</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <button className="add-row-button" onClick={addNewRow}>
        Add Transaction
      </button>
    </div>
  );
};

export default StockAnalysis;