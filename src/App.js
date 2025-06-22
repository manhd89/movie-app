import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react'; // Import useState
import Header from './components/Header';
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail'; // Đảm bảo tên file MovieDetail.js
import './App.css';

function App() {
  const [showFilterModal, setShowFilterModal] = useState(false); // State để quản lý hiển thị modal lọc

  const handleOpenFilterModal = () => {
    setShowFilterModal(true);
  };

  const handleCloseFilterModal = () => {
    setShowFilterModal(false);
  };

  return (
    <BrowserRouter>
      <div className="app">
        {/* Truyền hàm mở modal xuống Header */}
        <Header onOpenFilters={handleOpenFilterModal} />
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
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
