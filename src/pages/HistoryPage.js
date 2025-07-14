// src/pages/HistoryPage.js

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { FaTrashAlt, FaPlayCircle } from 'react-icons/fa';
import './HistoryPage.css'; // Tạo file HistoryPage.css

const WATCH_HISTORY_KEY = 'watchHistory';
const CDN_IMAGE_URL = process.env.REACT_APP_API_CDN_IMAGE;

function HistoryPage() {
  const [history, setHistory] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const storedHistory = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
    setHistory(storedHistory);
  }, []);

  const handleClearHistory = useCallback(() => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem?')) {
      localStorage.removeItem(WATCH_HISTORY_KEY);
      setHistory([]);
    }
  }, []);

  const handleRemoveItem = useCallback((slugToRemove, e) => {
    e.stopPropagation(); // Ngăn chặn sự kiện click lan ra movie card
    if (window.confirm('Bạn có chắc chắn muốn xóa mục này khỏi lịch sử?')) {
      const updatedHistory = history.filter(item => item.slug !== slugToRemove);
      localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(updatedHistory));
      setHistory(updatedHistory);
    }
  }, [history]);

  const handleMovieClick = useCallback((item) => {
    // Điều hướng đến trang chi tiết phim hoặc tập phim cụ thể nếu có episodeSlug
    if (item.episode && item.episode.slug) {
      navigate(`/movie/${item.slug}/${item.episode.slug}`);
    } else {
      navigate(`/movie/${item.slug}`);
    }
  }, [navigate]);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getImageUrl = (url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      return url;
    }
    return url ? `${CDN_IMAGE_URL}/${url}` : '/placeholder.jpg';
  };

  return (
    <div className="history-page container">
      <Helmet>
        <title>Lịch Sử Xem Phim - Phim Online</title>
        <meta name="description" content="Xem lại lịch sử các bộ phim và tập phim bạn đã xem gần đây." />
      </Helmet>

      <div className="history-header">
        <h1 className="history-title">Lịch Sử Xem</h1>
        {history.length > 0 && (
          <button className="clear-history-button" onClick={handleClearHistory}>
            <FaTrashAlt /> Xóa Tất Cả
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="no-history-message">Bạn chưa xem phim nào gần đây.</p>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <div key={`${item.slug}-${item.episode?.slug || ''}-${item.timestamp}`} className="history-item-card" onClick={() => handleMovieClick(item)}>
              <LazyLoadImage
                src={getImageUrl(item.poster_url)}
                alt={item.name}
                effect="blur"
                className="history-item-thumbnail"
                width="150"
                height="225"
              />
              <div className="history-item-info">
                <h3 className="history-item-title">{item.name}</h3>
                <p className="history-item-origin-name">{item.origin_name}</p>
                <p className="history-item-episode">
                  {item.episode ? `Tập: ${item.episode.name} (${item.episode.server_name})` : 'Thông tin tập không khả dụng'}
                </p>
                <p className="history-item-position">
                  Đã xem: {Math.floor(item.position / 60)} phút {Math.floor(item.position % 60)} giây
                </p>
                <p className="history-item-timestamp">Xem lúc: {formatTimestamp(item.timestamp)}</p>
                <div className="history-item-actions">
                  <button
                    className="history-play-button"
                    onClick={(e) => { e.stopPropagation(); handleMovieClick(item); }}
                  >
                    <FaPlayCircle /> Xem tiếp
                  </button>
                  <button
                    className="history-remove-button"
                    onClick={(e) => handleRemoveItem(item.slug, e)}
                  >
                    <FaTrashAlt /> Xóa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
