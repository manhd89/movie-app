import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import Select from 'react-select';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { FaAngleRight, FaTimes, FaHistory, FaTrash } from 'react-icons/fa'; // Import thêm FaHistory, FaTrash

import './Home.css';

// --- Constants ---
const BASE_API_URL = process.env.REACT_APP_API_URL;
const V1_API_URL = `${process.env.REACT_APP_API_URL}/v1/api`;
const CDN_IMAGE_URL = process.env.REACT_APP_API_CDN_IMAGE;
const ITEMS_PER_PAGE = 24; // Số lượng phim trên mỗi trang
const DEFAULT_PAGE_LIMIT = 12; // Giới hạn số phim hiển thị trong mỗi section trên trang chủ
const PLAYBACK_SAVE_THRESHOLD_SECONDS = 5; // Ngưỡng thời gian xem tối thiểu để lưu vị trí (ví dụ 5 giây)
const HISTORY_KEY = 'watchHistory'; // Key cho lịch sử xem
const MAX_HISTORY_ITEMS = 20; // Giới hạn số lượng phim trong lịch sử

// --- Helper Functions ---
const getImageUrl = (url) => {
  if (url && url.startsWith('https://')) {
    return url;
  }
  return url ? `${CDN_IMAGE_URL}/${url}` : '/placeholder.jpg';
};

const movieApi = axios.create({
  baseURL: BASE_API_URL,
  timeout: 8000,
});

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

// --- Reusable Components ---
function HomePageSection({ title, movies, linkToAll, isLoading }) {
  if (isLoading) {
    return (
      <div className="homepage-section">
        <h2>{title}</h2>
        <div className="section-loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!movies || movies.length === 0) {
    return null; // Không render section nếu không có phim
  }

  return (
    <div className="homepage-section">
      <div className="section-header">
        <h2>{title}</h2>
        {linkToAll && (
          <Link to={linkToAll} className="see-all-link">
            Xem tất cả <FaAngleRight />
          </Link>
        )}
      </div>
      <div className="movie-horizontal-scroll">
        {movies.map((movie) => (
          <div key={movie._id} className="movie-card-horizontal">
            <Link to={`/movie/${movie.slug}`}>
              <LazyLoadImage
                src={getImageUrl(movie.poster_url)}
                alt={movie.name}
                className="movie-poster-horizontal"
                effect="blur"
                onError={(e) => (e.target.src = '/placeholder.jpg')}
              />
              <h3>{movie.name}</h3>
              <p>{movie.year}</p>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

// NEW: Helper Component for History Section
function HistorySection({ movies, linkToAll, isLoading, onClearHistory, onRemoveItem }) {
    if (isLoading) {
        return (
            <div className="homepage-section">
                <h2>Lịch sử xem</h2>
                <div className="section-loading-spinner">
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    if (!movies || movies.length === 0) {
        return null; // Don't render if no movies in history
    }

    return (
        <div className="homepage-section">
            <div className="section-header">
                <h2>Lịch sử xem</h2>
                <div className="history-actions">
                    {onClearHistory && (
                        <button onClick={onClearHistory} className="clear-history-button" aria-label="Xóa toàn bộ lịch sử">
                            <FaTrash /> Xóa tất cả
                        </button>
                    )}
                    {linkToAll && (
                        <Link to={linkToAll} className="see-all-link">
                            Xem tất cả <FaAngleRight />
                        </Link>
                    )}
                </div>
            </div>
            <div className="movie-horizontal-scroll">
                {movies.map((movie) => (
                    <div key={`${movie.movieSlug}-${movie.episodeSlug}`} className="movie-card-horizontal history-card">
                        <Link to={`/movie/${movie.movieSlug}/${movie.episodeSlug}`} className="history-link">
                            <LazyLoadImage
                                src={getImageUrl(movie.poster_url)}
                                alt={movie.name}
                                className="movie-poster-horizontal"
                                effect="blur"
                                onError={(e) => (e.target.src = '/placeholder.jpg')}
                            />
                            <h3>{movie.name}</h3>
                            <p>{movie.episodeName || 'Tập phim'}</p>
                            {/* Nút tiếp tục xem */}
                            {movie.playbackPosition > 0 && (
                                <span className="continue-watching-label">
                                    <FaHistory /> {formatTime(movie.playbackPosition)}
                                </span>
                            )}
                        </Link>
                        {onRemoveItem && (
                            <button
                                className="remove-history-item-button"
                                onClick={(e) => {
                                    e.preventDefault(); // Ngăn chặn sự kiện click lan ra Link
                                    e.stopPropagation(); // Ngăn chặn sự kiện click lan ra Link
                                    onRemoveItem(movie.movieSlug, movie.episodeSlug);
                                }}
                                aria-label={`Xóa ${movie.name} khỏi lịch sử`}
                            >
                                <FaTimes />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Main Home Component ---
function Home({ showFilterModal, onCloseFilterModal }) {
  const [newlyUpdatedMovies, setNewlyUpdatedMovies] = useState([]);
  const [seriesMovies, setSeriesMovies] = useState([]);
  const [singleMovies, setSingleMovies] = useState([]);
  const [trailerMovies, setTrailerMovies] = useState([]);
  const [asianMovies, setAsianMovies] = useState([]);
  const [cartoonMovies, setCartoonMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [currentMovies, setCurrentMovies] = useState([]); // State để lưu trữ phim hiển thị trong lưới chính
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [listTitle, setListTitle] = useState('Phim mới cập nhật');
  const [showMainMovieGrid, setShowMainMovieGrid] = useState(false); // State để kiểm soát hiển thị lưới phim chính

  const [genres, setGenres] = useState([]);
  const [countries, setCountries] = useState([]);
  const [years, setYears] = useState([]);

  // States for filter selection
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);

  const [seoData, setSeoData] = useState({ titleHead: 'PhimAPI', descriptionHead: 'Xem phim online miễn phí' });

  // NEW: State for watch history
  const [watchHistory, setWatchHistory] = useState([]);
  const [showFullHistory, setShowFullHistory] = useState(false); // State để kiểm soát xem tất cả lịch sử

  // Effect để tải lịch sử xem từ localStorage khi component mount
  useEffect(() => {
    const loadHistory = () => {
        try {
            const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            // Sắp xếp lại theo thời gian xem gần nhất để đảm bảo mới nhất lên đầu
            history.sort((a, b) => b.lastWatched - a.lastWatched);
            setWatchHistory(history);
        } catch (error) {
            console.error("Failed to parse watch history from localStorage:", error);
            setWatchHistory([]);
        }
    };
    loadHistory();
    // Thêm listener cho storage event nếu muốn cập nhật real-time giữa các tab
    window.addEventListener('storage', loadHistory);
    return () => window.removeEventListener('storage', loadHistory);
  }, []);

  // Hàm để xóa một mục phim khỏi lịch sử
  const handleRemoveHistoryItem = useCallback((movieSlugToRemove, episodeSlugToRemove) => {
    setWatchHistory(prevHistory => {
        const updatedHistory = prevHistory.filter(item =>
            !(item.movieSlug === movieSlugToRemove && item.episodeSlug === episodeSlugToRemove)
        );
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
        return updatedHistory;
    });
  }, []);

  // Hàm để xóa toàn bộ lịch sử
  const handleClearHistory = useCallback(() => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem?')) {
        localStorage.removeItem(HISTORY_KEY);
        setWatchHistory([]);
    }
  }, []);


  const fetchData = useCallback(async () => {
    setLoading(true);
    const keyword = searchParams.get('keyword');
    const page = parseInt(searchParams.get('page')) || 1;
    const categorySlug = searchParams.get('the-loai');
    const countrySlug = searchParams.get('quoc-gia');
    const year = searchParams.get('nam');

    setShowMainMovieGrid(!!(keyword || categorySlug || countrySlug || year));

    let apiUrl = `${V1_API_URL}/danh-sach/phim-moi-cap-nhat`;
    let title = 'Phim mới cập nhật';
    let newSeoData = { titleHead: 'PhimAPI', descriptionHead: 'Xem phim online miễn phí' };

    if (keyword) {
      apiUrl = `${V1_API_URL}/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`;
      title = `Kết quả tìm kiếm cho "${keyword}"`;
      newSeoData = {
        titleHead: `Tìm kiếm "${keyword}" - PhimAPI`,
        descriptionHead: `Kết quả tìm kiếm phim "${keyword}" trên PhimAPI.`,
      };
    } else if (categorySlug) {
      apiUrl = `${V1_API_URL}/the-loai/${categorySlug}?page=${page}`;
      const genre = genres.find(g => g.slug === categorySlug);
      title = genre ? `Thể loại: ${genre.name}` : 'Thể loại phim';
      newSeoData = {
        titleHead: `${title} - PhimAPI`,
        descriptionHead: `Danh sách các bộ phim thuộc thể loại ${title} trên PhimAPI.`,
      };
    } else if (countrySlug) {
      apiUrl = `${V1_API_URL}/quoc-gia/${countrySlug}?page=${page}`;
      const country = countries.find(c => c.slug === countrySlug);
      title = country ? `Quốc gia: ${country.name}` : 'Phim theo quốc gia';
      newSeoData = {
        titleHead: `${title} - PhimAPI`,
        descriptionHead: `Danh sách các bộ phim từ quốc gia ${title} trên PhimAPI.`,
      };
    } else if (year) {
      apiUrl = `${V1_API_URL}/nam/${year}?page=${page}`;
      title = `Phim năm ${year}`;
      newSeoData = {
        titleHead: `Phim năm ${year} - PhimAPI`,
        descriptionHead: `Danh sách các bộ phim phát hành năm ${year} trên PhimAPI.`,
      };
    }

    setListTitle(title);
    setSeoData(newSeoData);

    try {
      if (showMainMovieGrid) {
        const response = await movieApi.get(apiUrl);
        setCurrentMovies(response.data.data?.items || []);
        setTotalPages(response.data.data?.params?.pagination?.totalPages || 1);
        setCurrentPage(response.data.data?.params?.pagination?.currentPage || 1);
      } else {
        // Fetch all home sections concurrently
        const [
          newlyUpdatedRes,
          seriesRes,
          singleRes,
          trailerRes,
          asianRes,
          cartoonRes,
        ] = await Promise.all([
          movieApi.get(`${V1_API_URL}/danh-sach/phim-moi-cap-nhat?limit=${DEFAULT_PAGE_LIMIT}`),
          movieApi.get(`${V1_API_URL}/danh-sach/phim-bo?limit=${DEFAULT_PAGE_LIMIT}`),
          movieApi.get(`${V1_API_URL}/danh-sach/phim-le?limit=${DEFAULT_PAGE_LIMIT}`),
          movieApi.get(`${V1_API_URL}/danh-sach/trailer?limit=${DEFAULT_PAGE_LIMIT}`),
          movieApi.get(`${V1_API_URL}/danh-sach/phim-hoat-hinh?limit=${DEFAULT_PAGE_LIMIT}`), // Lấy phim hoạt hình cho phần phim châu Á (có thể đổi)
          movieApi.get(`${V1_API_URL}/danh-sach/phim-hoat-hinh?limit=${DEFAULT_PAGE_LIMIT}`), // Placeholder nếu chưa có API riêng
        ]);

        setNewlyUpdatedMovies(newlyUpdatedRes.data.data?.items || []);
        setSeriesMovies(seriesRes.data.data?.items || []);
        setSingleMovies(singleRes.data.data?.items || []);
        setTrailerMovies(trailerRes.data.data?.items || []);
        setAsianMovies(asianRes.data.data?.items || []); // Cập nhật phim châu Á
        setCartoonMovies(cartoonRes.data.data?.items || []); // Cập nhật phim hoạt hình
      }
    } catch (error) {
      console.error('Error fetching movies:', error);
      setCurrentMovies([]);
      setNewlyUpdatedMovies([]);
      setSeriesMovies([]);
      setSingleMovies([]);
      setTrailerMovies([]);
      setAsianMovies([]);
      setCartoonMovies([]);
    } finally {
      setLoading(false);
    }
  }, [searchParams, showMainMovieGrid, genres, countries]);

  const fetchFilters = useCallback(async () => {
    try {
      const [genresRes, countriesRes, yearsRes] = await Promise.all([
        movieApi.get(`${V1_API_URL}/the-loai`),
        movieApi.get(`${V1_API_URL}/quoc-gia`),
        movieApi.get(`${V1_API_URL}/nam`),
      ]);

      setGenres(
        genresRes.data.data.map((item) => ({ value: item.slug, label: item.name, _id: item._id }))
      );
      setCountries(
        countriesRes.data.data.map((item) => ({
          value: item.slug,
          label: item.name,
          _id: item._id,
        }))
      );
      setYears(
        yearsRes.data.data.map((item) => ({ value: item.name, label: item.name, _id: item._id }))
      );
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  }, []);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchData();
    window.scrollTo(0, 0); // Scroll to top on page change or filter change
  }, [fetchData, searchParams]); // Rerun when searchParams change

  const handlePageChange = (page) => {
    const currentParams = Object.fromEntries([...searchParams]);
    navigate(`/?${new URLSearchParams({ ...currentParams, page }).toString()}`);
  };

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    if (selectedGenre) params.set('the-loai', selectedGenre.value);
    if (selectedCountry) params.set('quoc-gia', selectedCountry.value);
    if (selectedYear) params.set('nam', selectedYear.value);
    params.set('page', '1'); // Reset to first page when applying filters
    navigate(`/?${params.toString()}`);
    onCloseFilterModal(); // Close the modal after applying
  };

  const handleResetFilters = () => {
    setSelectedGenre(null);
    setSelectedCountry(null);
    setSelectedYear(null);
    navigate('/'); // Navigate to home page to clear all filters
    onCloseFilterModal(); // Close the modal
  };

  const getMainListTitle = () => {
    const keyword = searchParams.get('keyword');
    const categorySlug = searchParams.get('the-loai');
    const countrySlug = searchParams.get('quoc-gia');
    const year = searchParams.get('nam');

    if (keyword) return `Kết quả tìm kiếm cho "${keyword}"`;
    if (categorySlug) {
      const genre = genres.find(g => g.slug === categorySlug);
      return genre ? `Thể loại: ${genre.name}` : 'Thể loại phim';
    }
    if (countrySlug) {
      const country = countries.find(c => c.slug === countrySlug);
      return country ? `Quốc gia: ${country.name}` : 'Phim theo quốc gia';
    }
    if (year) return `Phim năm ${year}`;
    return 'Phim mới cập nhật';
  };

  return (
    <div className="container">
      <Helmet>
        <title>{seoData.titleHead}</title>
        <meta name="description" content={seoData.descriptionHead} />
      </Helmet>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="filter-modal-overlay" onClick={onCloseFilterModal}>
          <div className="filter-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Bộ lọc phim</h2>
            <div className="filter-group">
              <label>Thể loại:</label>
              <Select
                options={genres}
                value={selectedGenre}
                onChange={setSelectedGenre}
                placeholder="Chọn thể loại..."
                isClearable
                classNamePrefix="react-select"
              />
            </div>
            <div className="filter-group">
              <label>Quốc gia:</label>
              <Select
                options={countries}
                value={selectedCountry}
                onChange={setSelectedCountry}
                placeholder="Chọn quốc gia..."
                isClearable
                classNamePrefix="react-select"
              />
            </div>
            <div className="filter-group">
              <label>Năm phát hành:</label>
              <Select
                options={years}
                value={selectedYear}
                onChange={setSelectedYear}
                placeholder="Chọn năm..."
                isClearable
                classNamePrefix="react-select"
              />
            </div>
            <div className="filter-buttons">
              <button onClick={handleApplyFilters} className="apply-filters-button">
                Áp dụng
              </button>
              <button onClick={handleResetFilters} className="reset-filters-button">
                Đặt lại
              </button>
            </div>
            <button className="close-modal-button" onClick={onCloseFilterModal}>
              <FaTimes />
            </button>
          </div>
        </div>
      )}

      {/* Main Title of the current movie list or section */}
      {showMainMovieGrid && (
        <h1 className="main-list-title">
          {getMainListTitle()}
        </h1>
      )}

      {/* Main Movie Grid (for search results or category/country/year list pages) */}
      {showMainMovieGrid && (
        <>
          {loading ? (
            <div className="loading-spinner">
              <div className="spinner"></div>
            </div>
          ) : currentMovies.length > 0 ? (
            <div className="movie-grid">
              {currentMovies.map((movie) => (
                <div key={movie._id} className="movie-card">
                  <Link to={`/movie/${movie.slug}`}>
                    <LazyLoadImage
                      src={getImageUrl(movie.poster_url)}
                      alt={movie.name}
                      className="movie-poster"
                      effect="blur"
                      onError={(e) => (e.target.src = '/placeholder.jpg')}
                    />
                    <div className="movie-info">
                      <h3>{movie.name}</h3>
                      <p>{movie.year}</p>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-results">Không tìm thấy phim nào.</p>
          )}

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Trước
              </button>
              <span>
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Tiếp
              </button>
            </div>
          )}
        </>
      )}

      {/* Home Page Sections (only visible if not showing the main movie grid) */}
      {!showMainMovieGrid && (
        <div className="home-sections-container">
          {/* NEW: History Section */}
          {watchHistory.length > 0 && ( // Chỉ hiển thị nếu có lịch sử
            <HistorySection
              movies={watchHistory.slice(0, DEFAULT_PAGE_LIMIT)} // Giới hạn số lượng hiển thị ban đầu
              linkToAll={watchHistory.length > DEFAULT_PAGE_LIMIT ? "/history" : null} // Link đến trang lịch sử chi tiết nếu có nhiều
              isLoading={false}
              onClearHistory={handleClearHistory}
              onRemoveItem={handleRemoveHistoryItem}
            />
          )}

          <HomePageSection
            title="Phim mới cập nhật"
            movies={newlyUpdatedMovies}
            linkToAll="/?the-loai=phim-moi-cap-nhat"
            isLoading={loading}
          />
          <HomePageSection
            title="Phim Bộ"
            movies={seriesMovies}
            linkToAll="/?the-loai=phim-bo"
            isLoading={loading}
          />
          <HomePageSection
            title="Phim Lẻ"
            movies={singleMovies}
            linkToAll="/?the-loai=phim-le"
            isLoading={loading}
          />
          <HomePageSection
            title="Phim hoạt hình"
            movies={cartoonMovies}
            linkToAll="/?the-loai=phim-hoat-hinh"
            isLoading={loading}
          />
          <HomePageSection
            title="Phim Trailers"
            movies={trailerMovies}
            linkToAll="/?the-loai=trailer"
            isLoading={loading}
          />
        </div>
      )}
    </div>
  );
}

export default Home;
