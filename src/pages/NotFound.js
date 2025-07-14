// src/pages/NotFound.js

import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import './NotFound.css'; // Tạo file NotFound.css

function NotFound() {
  return (
    <div className="not-found-container">
      <Helmet>
        <title>404 - Trang Không Tìm Thấy</title>
        <meta name="description" content="Trang bạn đang tìm kiếm không tồn tại." />
      </Helmet>
      <h1>404</h1>
      <h2>Trang không tìm thấy</h2>
      <p>Rất tiếc, trang bạn đang tìm kiếm không tồn tại.</p>
      <Link to="/" className="back-home-button">
        Về trang chủ
      </Link>
    </div>
  );
}

export default NotFound;
