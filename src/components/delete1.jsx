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
      let remainingToSell = sellQuantity;s
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
}

const toggleTransactionSelection = (clickedId) => {
    const tx = transactions.find(t => t.id === clickedId);
    if (!tx) return;
  
    // Find the index, which your helper function needs
    const txIndex = transactions.findIndex(t => t.id === clickedId);
    const quantity = parseFloat(tx.quantity) || 0;
    const isSelected = selectedTransactions.includes(clickedId);
  
    if (isSelected) {
      // UN-CHECKING
      // Your old logic was complex and could be buggy.
      // This is simpler and more predictable: just remove the one you clicked.
      setSelectedTransactions(prev => prev.filter(id => id !== clickedId));
  
    } else {
      // CHECKING
      let idsToAdd = [clickedId];
      
      // If it's a SELL transaction, find its corresponding BUYS
      if (quantity < 0) {
        // Use your existing helper function
        const buyIds = getFifoBuyTransactionIds(txIndex); 
        idsToAdd = [...idsToAdd, ...buyIds];
      }
      
      // Add all new IDs (the clicked one + its buys)
      // Using a Set prevents duplicates if a buy was already selected
      setSelectedTransactions(prev => [...new Set([...prev, ...idsToAdd])]);
    }
  };

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
              )}}
            