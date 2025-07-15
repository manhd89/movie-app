// src/components/Footer.js

import React from 'react';
import './Footer.css'; // Tạo file Footer.css nếu chưa có

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p>&copy; {new Date().getFullYear()} Phim Online. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default Footer;
