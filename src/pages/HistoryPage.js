// src/pages/HistoryPage.js
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { Link } from 'react-router-dom';
import { FaTrashAlt } from 'react-icons/fa';
import './HistoryPage.css'; // Tạo file CSS này nếu cần

const WATCH_HISTORY_KEY = 'watchHistory';

const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
        return url;
    }
    return url ? `${process.env.REACT_APP_API_CDN_IMAGE}/${url}` : '/placeholder.jpg';
};

function HistoryPage() {
    const [fullWatchHistory, setFullWatchHistory] = useState([]);

    useEffect(() => {
        const history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
        setFullWatchHistory(history.sort((a, b) => b.timestamp - a.timestamp));
    }, []);

    const handleDeleteHistoryItem = (slugToRemove) => {
        setFullWatchHistory(prevHistory => {
            const updatedHistory = prevHistory.filter(item => item.slug !== slugToRemove);
            localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    };

    const handleClearAllHistory = () => {
        if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem?")) {
            localStorage.removeItem(WATCH_HISTORY_KEY);
            setFullWatchHistory([]);
        }
    };

    return (
        <div className="container history-full-page">
            <Helmet>
                <title>Lịch Sử Xem - PhimAPI</title>
                <meta name="description" content="Xem lại toàn bộ lịch sử các bộ phim bạn đã xem." />
            </Helmet>
            <div className="history-header">
                <h1>Lịch Sử Đã Xem</h1>
                {fullWatchHistory.length > 0 && (
                    <button onClick={handleClearAllHistory} className="clear-all-history-button">
                        <FaTrashAlt /> Xóa Tất Cả
                    </button>
                )}
            </div>

            {fullWatchHistory.length === 0 ? (
                <p className="no-history-message">Bạn chưa xem phim nào gần đây.</p>
            ) : (
                <div className="history-grid movie-grid"> {/* Sử dụng movie-grid để dàn phim */}
                    {fullWatchHistory.map((movie) => (
                        <div key={movie.slug + (movie.episode?.slug || '')} className="movie-card history-card-item">
                            <Link to={`/movie/${movie.slug}/${movie.episode?.slug || ''}`}>
                                <LazyLoadImage
                                    src={getImageUrl(movie.poster_url)}
                                    alt={movie.name}
                                    className="movie-poster"
                                    effect="blur"
                                    onError={(e) => (e.target.src = '/placeholder.jpg')}
                                />
                                <h3>{movie.name}</h3>
                                {movie.episode?.name && (
                                    <p className="episode-info">Tập: {movie.episode.name}</p>
                                )}
                                <p className="movie-year">Năm: {movie.year || 'N/A'}</p>
                            </Link>
                            <div className="history-item-actions">
                                <button
                                    onClick={() => handleDeleteHistoryItem(movie.slug)}
                                    className="delete-history-item-button"
                                    title="Xóa khỏi lịch sử"
                                >
                                    <FaTrashAlt /> Xóa
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default HistoryPage;
