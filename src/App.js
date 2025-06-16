import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Movie from './pages/Movie';
import Watch from './pages/Watch';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movie/:slug" element={<Movie />} />
          <Route path="/watch/:slug/:episodeSlug" element={<Watch />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
