import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Header from './components/Header';
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail';
import Footer from './components/Footer'; // Import Footer
import './App.css';

function App() {
  const [showFilterModal, setShowFilterModal] = useState(false);

  const handleOpenFilterModal = () => {
    setShowFilterModal(true);
  };

  const handleCloseFilterModal = () => {
    setShowFilterModal(false);
  };

  return (
    <BrowserRouter>
      <div className="app">
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
        <Footer /> {/* Add the Footer component here */}
      </div>
    </BrowserRouter>
  );
}

export default App;
