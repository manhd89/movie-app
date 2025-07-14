// src/components/Footer.js

import React from 'react';
import './Footer.css'; // Tạo file Footer.css nếu chưa có

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p>&copy; {new Date().getFullYear()} Phim Online. All rights reserved.</p>
        <div className="footer-links">
          <a href="/about">Về chúng tôi</a>
          <a href="/privacy">Chính sách bảo mật</a>
          <a href="/contact">Liên hệ</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
