import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const InvestmentCharts = ({ transactions }) => {
  // --- STATE FOR MODAL ---
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Data for Plot 1: Average Price per Transaction
  const averagePriceData = transactions
    .filter(tx => tx.averagePrice > 0)
    .map(tx => ({
      id: tx.id,
      'Average Price': tx.averagePrice
    }));

  // Data for Plot 2: Trade Improvement Ratio
  const ratioData = useMemo(() => {
    const data = [];
    for (let i = 1; i < transactions.length; i++) {
      const currentPrice = parseFloat(transactions[i].price) || 0;
      const currentQuantity = parseFloat(transactions[i].quantity) || 0;
      const prevPrice = parseFloat(transactions[i-1].price) || 0;
      const extraCharges = parseFloat(transactions[i].extraCharges) || 0;

      if (currentPrice === 0 || prevPrice === 0 || currentQuantity === 0) {
        continue;
      }
      
      const paperProfit = (prevPrice - currentPrice) * currentQuantity;
      const ratio = (extraCharges === 0) ? 0 : paperProfit / extraCharges;

      if (!isNaN(ratio)) {
         data.push({
           id: transactions[i].id,
           'Improvement Ratio': ratio
         });
      }
    }
    return data;
  }, [transactions]);

  // --- STYLES FOR MODAL ---
  const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000,
    display: 'flex', justifyContent: 'center', alignItems: 'center'
  };

  const modalContentStyle = {
    backgroundColor: '#333', padding: '25px', borderRadius: '8px', 
    maxWidth: '500px', width: '90%', 
    color: '#eee', border: '1px solid #555'
  };

  const infoIconStyle = {
    display: 'inline-block', marginLeft: '8px', width: '20px',
    height: '20px', borderRadius: '50%', backgroundColor: '#888',
    color: '#222', textAlign: 'center', lineHeight: '20px',
    cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
  };
  
  // --- END OF STYLES ---

  return (
    <div className="charts-container" style={{ padding: '20px' }}>
      
      {/* --- INFO MODAL --- */}
      {showInfoModal && (
        <div style={modalOverlayStyle} onClick={() => setShowInfoModal(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{marginTop: 0, borderBottom: '1px solid #555', paddingBottom: '10px'}}>
              Trade Improvement Ratio
            </h2>
            <p>
              Shows how much "improvement" you got (vs. the last trade) for every 1 rupee spent on fees.
            </p>
            <p>
              A positive value means you bought lower or sold higher than the previous transaction.
            </p>
            <div style={{
              fontFamily: 'monospace', fontSize: '1.1em',
              backgroundColor: '#222', padding: '10px', borderRadius: '4px'
            }}>
              (Previous Price - Current Price) * Current Quantity / Extra Charges
            </div>
            <button 
              onClick={() => setShowInfoModal(false)}
              style={{
                marginTop: '20px', padding: '8px 16px',
                backgroundColor: '#007bff', color: 'white',
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                float: 'right'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* --- END OF MODAL --- */}

      {/* Parent Flex Container */}
      <div style={{ display: 'flex', flexWrap: 'wrap', width: '100%', height: '300px' }}>

        {/* --- CHART 1 WRAPPER --- */}
        <div style={{ flex: 1, minWidth: '300px', height: '100%' }}>
          <h3>Average Price per Transaction</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={averagePriceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="id" allowDecimals={false} />
              <YAxis 
                label={{ value: 'Avg. Price (₹)', angle: -90, position: 'insideLeft' }} 
                domain={[dataMin => (Math.floor(dataMin * 0.99)), 'auto']}
              />
              
              {/* --- THIS IS THE FIX --- */}
              <Tooltip 
                formatter={(value, name, props) => {
                  // Get the value from the payload, which is more reliable
                  const val = props.payload[name];
                  if (typeof val === 'number') {
                    return [`₹${val.toFixed(2)}`, name];
                  }
                  return [value, name]; // Fallback
                }}
              />
              
              <Legend />
              <Line type="linear" dataKey="Average Price" stroke="#8884d8" dot={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* --- CHART 2 WRAPPER --- */}
        <div style={{ flex: 1, minWidth: '300px', height: '100%' }}>
          
          <h3 style={{ marginTop: '0px', display: 'flex', alignItems: 'center' }}>
            Trade Improvement Ratio
            <span 
              onClick={() => setShowInfoModal(true)}
              style={infoIconStyle}
              title="What is this?"
            >
              ?
            </span>
          </h3>
          
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ratioData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="id" allowDecimals={false} />
              <YAxis label={{ value: 'Ratio', angle: -90, position: 'insideLeft' }} />
              
              {/* --- THIS IS THE FIX --- */}
              <Tooltip 
                formatter={(value, name, props) => {
                  // Get the value from the payload, which is more reliable
                  const val = props.payload[name];
                  if (typeof val === 'number') {
                    return [val.toFixed(2), name];
                  }
                  return [value, name]; // Fallback
                }}
              />
              
              <Legend />
              <Line type="linear" dataKey="Improvement Ratio" stroke="#82ca9d" dot={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div> {/* CLOSE THE PARENT FLEX CONTAINER */}
      
    </div>
  );
};

export default InvestmentCharts;