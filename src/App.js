import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { FaSearch, FaFilter, FaHome, FaHistory } from 'react-icons/fa'; // Import FaHistory
import Header from './components/Header'; // Sử dụng lại Header cũ
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail';
import HistoryPage from './pages/HistoryPage'; // Import trang lịch sử mới
import './App.css'; // Global App CSS

function Footer() {
  return (
    <footer className="footer">
      <p>&copy; {new Date().getFullYear()} PhimAPI. Tất cả quyền được bảo lưu.</p>
      <p>Dữ liệu được cung cấp bởi API bên thứ ba.</p>
    </footer>
  );
}

function App() {
  const [showFilterModal, setShowFilterModal] = useState(false);

  const handleOpenFilterModal = useCallback(() => {
    setShowFilterModal(true);
  }, []);

  const handleCloseFilterModal = useCallback(() => {
    setShowFilterModal(false);
  }, []);

  return (
    <Router>
      <div className="app">
        {/* Truyền hàm mở modal xuống Header */}
        <Header onOpenFilters={handleOpenFilterModal} />
        <main className="main-content">
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  showFilterModal={showFilterModal}
                  onCloseFilterModal={handleCloseFilterModal}
                />
              }
            />
            <Route path="/movie/:slug" element={<MovieDetail />} />
            <Route path="/movie/:slug/:episodeSlug" element={<MovieDetail />} />
            {/* NEW: Route cho trang lịch sử */}
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
