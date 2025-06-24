// src/pages/HistoryPage.js

import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { FaTimes, FaTrash, FaHistory } from 'react-icons/fa'; // Import icons

import './HistoryPage.css'; // Sẽ tạo file này
// Đảm bảo các hằng số và hàm tiện ích trùng khớp với Home.js và MovieDetail.js
const HISTORY_KEY = 'watchHistory';
const CDN_IMAGE_URL = process.env.REACT_APP_API_CDN_IMAGE;

const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
        return url;
    }
    return url ? `${CDN_IMAGE_URL}/${url}` : '/placeholder.jpg';
};

// Hàm định dạng thời gian từ giây sang HH:MM:SS
const formatTime = (seconds) => {
    if (!seconds) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [m, s]
      .map(v => v < 10 ? '0' + v : v);
    if (h > 0) {
      parts.unshift(h < 10 ? '0' + h : h);
    }
    return parts.join(':');
};

function HistoryPage() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadHistory = () => {
            try {
                const storedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
                // Sắp xếp lại theo thời gian xem gần nhất để đảm bảo mới nhất lên đầu
                storedHistory.sort((a, b) => b.lastWatched - a.lastWatched);
                setHistory(storedHistory);
            } catch (error) {
                console.error("Failed to parse watch history from localStorage:", error);
                setHistory([]);
            } finally {
                setLoading(false);
            }
        };
        loadHistory();
        window.addEventListener('storage', loadHistory); // Cập nhật khi có thay đổi từ tab khác
        return () => window.removeEventListener('storage', loadHistory);
    }, []);

    const handleRemoveItem = useCallback((movieSlug, episodeSlug) => {
        setHistory(prevHistory => {
            const updatedHistory = prevHistory.filter(item =>
                !(item.movieSlug === movieSlug && item.episodeSlug === episodeSlug)
            );
            localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    }, []);

    const handleClearAllHistory = useCallback(() => {
        if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem?')) {
            localStorage.removeItem(HISTORY_KEY);
            setHistory([]);
        }
    }, []);

    if (loading) {
        return (
            <div className="container history-page-loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="container">
            <Helmet>
                <title>Lịch sử xem - PhimAPI</title>
                <meta name="description" content="Danh sách phim bạn đã xem gần đây." />
            </Helmet>

            <h1 className="history-page-title">
                <FaHistory className="icon" /> Lịch sử xem của bạn
            </h1>

            {history.length === 0 ? (
                <p className="no-history-message">Bạn chưa xem phim nào gần đây.</p>
            ) : (
                <>
                    <button onClick={handleClearAllHistory} className="clear-all-history-button">
                        <FaTrash /> Xóa toàn bộ lịch sử
                    </button>
                    <div className="history-grid">
                        {history.map((item) => (
                            <div key={`${item.movieSlug}-${item.episodeSlug}`} className="history-card-item">
                                <Link to={`/movie/${item.movieSlug}/${item.episodeSlug}`} className="history-card-link">
                                    <LazyLoadImage
                                        src={getImageUrl(item.poster_url)}
                                        alt={item.name}
                                        className="history-card-poster"
                                        effect="blur"
                                        onError={(e) => (e.target.src = '/placeholder.jpg')}
                                    />
                                    <div className="history-card-info">
                                        <h3 className="history-card-title">{item.name}</h3>
                                        <p className="history-card-episode">{item.episodeName || 'Tập phim'}</p>
                                        <p className="history-card-year">{item.year}</p>
                                        {item.playbackPosition > 0 && (
                                            <span className="history-card-time">
                                                <FaHistory /> Xem đến: {formatTime(item.playbackPosition)}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault(); // Ngăn chặn chuyển hướng của Link
                                        e.stopPropagation(); // Ngăn chặn sự kiện click lan ra Link
                                        handleRemoveItem(item.movieSlug, item.episodeSlug);
                                    }}
                                    className="history-card-remove-button"
                                    aria-label={`Xóa ${item.name} khỏi lịch sử`}
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default HistoryPage;
