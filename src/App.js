import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movie/:slug" element={<MovieDetail />} />
          <Route path="/movie/:slug/:episodeSlug" element={<MovieDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
