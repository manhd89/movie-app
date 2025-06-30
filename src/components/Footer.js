import React from 'react';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer-container">
      <div className="footer-content">
        <p className="footer-text">
          Khám phá thế giới điện ảnh không giới hạn với PhimAPI. <br /> Cập nhật liên tục, trải nghiệm đỉnh cao.
        </p>
        <p className="footer-designer">
          Thiết kế bởi: **Mạnh Dương**
        </p>
        <p className="footer-copyright">
          &copy; {new Date().getFullYear()} PhimAPI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
