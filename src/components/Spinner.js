// src/components/Spinner.js

import React from 'react';
import './Spinner.css'; // Tạo Spinner.css

function Spinner() {
  return (
    <div className="spinner-overlay">
      <div className="spinner-loader"></div>
    </div>
  );
}

export default Spinner;
