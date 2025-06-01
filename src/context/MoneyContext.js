import React, { createContext, useState, useContext } from 'react';

// Create context with default value
const MoneyContext = createContext({
  extraMoneyCaused: '0.000',
  setExtraMoneyCaused: () => {},
  extraMoneyClass: 'profit'
});

// Create provider component
export const MoneyProvider = ({ children }) => {
  const [extraMoneyCaused, setExtraMoneyCaused] = useState('0.000');
  const [extraMoneyClass, setExtraMoneyClass] = useState('profit');

  // Function to update both the value and class
  const updateExtraMoneyCaused = (value) => {
    setExtraMoneyCaused(value);
    // Set the class based on whether the value is positive or negative
    setExtraMoneyClass(parseFloat(value) >= 0 ? 'profit' : 'loss');
  };

  return (
    <MoneyContext.Provider
      value={{
        extraMoneyCaused,
        setExtraMoneyCaused: updateExtraMoneyCaused,
        extraMoneyClass
      }}
    >
      {children}
    </MoneyContext.Provider>
  );
};

// Custom hook to use the context
export const useMoney = () => useContext(MoneyContext);

export default MoneyContext; 