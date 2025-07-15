// src/pages/HistoryPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { FaArrowLeft, FaTrashAlt } from 'react-icons/fa';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './HistoryPage.css'; // Sẽ tạo file CSS này

const WATCH_HISTORY_KEY = 'watchHistory';

const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
        return url;
    }
    return url ? `${process.env.REACT_APP_API_CDN_IMAGE}/${url}` : '/placeholder.jpg';
};

function HistoryPage() {
    const [historyMovies, setHistoryMovies] = useState([]);

    useEffect(() => {
        const history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
        // Sắp xếp lịch sử theo thời gian mới nhất trước
        setHistoryMovies(history.sort((a, b) => b.timestamp - a.timestamp));
    }, []);

    const handleDeleteHistoryItem = useCallback((slugToRemove) => {
        setHistoryMovies(prevHistory => {
            const updatedHistory = prevHistory.filter(item => item.slug !== slugToRemove);
            localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    }, []);

    const handleClearAllHistory = useCallback(() => {
        if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử đã xem?')) {
            localStorage.removeItem(WATCH_HISTORY_KEY);
            setHistoryMovies([]);
        }
    }, []);

    return (
        <div className="container history-page-container">
            <Helmet>
                <title>Lịch Sử Đã Xem - PhimAPI</title>
                <meta name="description" content="Xem lại toàn bộ lịch sử xem phim của bạn." />
            </Helmet>

            <Link to="/" className="back-to-home-button">
                <FaArrowLeft className="icon" /> Quay lại Trang chủ
            </Link>

            <div className="history-page-header">
                <h1 className="history-page-title">Lịch Sử Đã Xem</h1>
                {historyMovies.length > 0 && (
                    <button onClick={handleClearAllHistory} className="clear-all-history-button">
                        <FaTrashAlt /> Xóa Tất Cả
                    </button>
                )}
            </div>

            {historyMovies.length === 0 ? (
                <p className="no-history-message">Bạn chưa xem bộ phim nào.</p>
            ) : (
                <div className="history-grid">
                    {historyMovies.map((movie) => (
                        <div key={`${movie.slug}-${movie.episode?.slug || 'no-episode'}`} className="history-movie-card-full">
                            <Link to={`/movie/${movie.slug}${movie.episode?.slug ? `/${movie.episode.slug}` : ''}`} className="history-card-link">
                                <LazyLoadImage
                                    src={getImageUrl(movie.poster_url)}
                                    alt={movie.name}
                                    className="history-movie-poster"
                                    effect="blur"
                                    onError={(e) => (e.target.src = '/placeholder.jpg')}
                                />
                                <div className="history-card-info">
                                    <h3>{movie.name}</h3>
                                    {movie.episode?.name && (
                                        <p>Tập: {movie.episode.name} ({movie.episode.server_name || 'N/A'})</p>
                                    )}
                                    {movie.year && <p>Năm: {movie.year}</p>}
                                    {movie.episode_current && <p>Tình trạng: {movie.episode_current}</p>}
                                    {movie.position && (
                                        <p>Xem đến: {Math.floor(movie.position / 60)} phút {Math.floor(movie.position % 60)} giây</p>
                                    )}
                                    <p className="last-watched-time">Lần cuối xem: {new Date(movie.timestamp).toLocaleString()}</p>
                                </div>
                            </Link>
                            <button
                                onClick={() => handleDeleteHistoryItem(movie.slug)}
                                className="delete-history-item-button-full"
                                title="Xóa khỏi lịch sử"
                            >
                                <FaTrashAlt />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default HistoryPage;
