// src/components/LoadingScreen.js
import React from 'react';

const LoadingScreen = () => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#fff',
      position: 'fixed',
      width: '100%',
      top: 0,
      left: 0,
      zIndex: 9999
    }}>
      <h2>Loading...</h2>
    </div>
  );
};

export default LoadingScreen;
