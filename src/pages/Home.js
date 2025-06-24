import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import Select from 'react-select';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { FaAngleRight, FaTimes, FaPlay, FaTrash } from 'react-icons/fa';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './Home.css';

const BASE_API_URL = process.env.REACT_APP_API_URL;
const V1_API_URL = `${process.env.REACT_APP_API_URL}/v1/api`;
const DEFAULT_PAGE_LIMIT = 12;
const HISTORY_KEY = 'movieHistory';

const getImageUrl = (url) => {
  if (url && url.startsWith('https://')) {
    return url;
  }
  return url ? `${process.env.REACT_APP_API_CDN_IMAGE}/${url}` : '/placeholder.jpg';
};

const movieApi = {
  fetchGenres: () => axios.get(`${BASE_API_URL}/the-loai`),
  fetchCountries: () => axios.get(`${BASE_API_URL}/quoc-gia`),
  fetchRecentUpdates: (page = 1) => axios.get(`${BASE_API_URL}/danh-sach/phim-moi-cap-nhat?page=${page}`),
  fetchMoviesBySlug: (type, slug, page = 1, limit = DEFAULT_PAGE_LIMIT, filters = {}) => {
    let url;
    if (type === 'category') url = `${V1_API_URL}/danh-sach/${slug}`;
    else if (type === 'genre') url = `${V1_API_URL}/the-loai/${slug}`;
    else if (type === 'country') url = `${V1_API_URL}/quoc-gia/${slug}`;
    else if (type === 'year') url = `${V1_API_URL}/nam/${slug}`;
    else if (type === 'search') url = `${V1_API_URL}/tim-kiem`;
    else if (type === 'history') {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      const start = (page - 1) * limit;
      const paginatedHistory = history.slice(start, start + limit);
      return Promise.resolve({
        data: {
          data: {
            items: paginatedHistory,
            params: { pagination: { totalItems: history.length, totalPages: Math.ceil(history.length / limit) } }
          }
        }
      });
    }
    return axios.get(url, { params: { page, limit, ...filters } });
  }
};

function HomePageSection({ title, movies, linkToAll, isLoading, isHistory, onDelete }) {
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
    return null;
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
            <Link to={`/movie/${movie.slug}${isHistory ? `/${movie.episode_slug}` : ''}`}>
              <LazyLoadImage
                src={getImageUrl(movie.poster_url)}
                alt={movie.name}
                className="movie-poster-horizontal"
                effect="blur"
                onError={(e) => (e.target.src = '/placeholder.jpg')}
              />
              <h3>{movie.name}</h3>
              <p>{isHistory ? movie.episode_name : movie.year}</p>
            </Link>
            {isHistory && (
              <div className="history-actions">
                <button
                  onClick={() => navigate(`/movie/${movie.slug}/${movie.episode_slug}`)}
                  className="continue-watching-button"
                  aria-label={`Tiếp tục xem ${movie.name} - ${movie.episode_name}`}
                >
                  <FaPlay className="icon" aria-hidden="true" /> Tiếp tục xem
                </button>
                <button
                  onClick={() => onDelete(movie.slug, movie.episode_slug)}
                  className="delete-history-button"
                  aria-label={`Xóa ${movie.name} khỏi lịch sử xem`}
                >
                  <FaTrash className="icon" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Home({ showFilterModal, onCloseFilterModal }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [loadingMain, setLoadingMain] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [genres, setGenres] = useState([]);
  const [countries, setCountries] = useState([]);
  const [seoData, setSeoData] = useState({
    titleHead: 'PhimAPI - Trang Chủ',
    descriptionHead: 'Xem phim mới cập nhật nhanh nhất, tổng hợp phim bộ, phim lẻ, TV Shows.'
  });
  const [homeSectionsData, setHomeSectionsData] = useState({
    recentMovies: [], seriesMovies: [], singleMovies: [], tvShows: [],
    dubbedMovies: [], cartoonMovies: [], longTiengMovies: [],
    vietnamMovies: [], chinaMovies: [], usEuMovies: [], japanMovies: [], koreaMovies: [],
    history: [],
  });
  const [loadingSections, setLoadingSections] = useState(true);

  const urlCategorySlug = searchParams.get('category');
  const urlCountrySlug = searchParams.get('country');
  const urlYear = searchParams.get('year');
  const urlKeyword = searchParams.get('keyword');
  const showMainMovieGrid = !!urlKeyword || !!urlCategorySlug || !!urlCountrySlug || !!urlYear;

  // Load history from localStorage
  const loadHistory = useCallback(() => {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return history.sort((a, b) => b.timestamp - a.timestamp); // Sort by most recent
  }, []);

  // Delete a movie from history
  const handleDeleteHistory = useCallback((slug, episodeSlug) => {
    const history = loadHistory();
    const updatedHistory = history.filter(item => item.slug !== slug || item.episode_slug !== episodeSlug);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    setHomeSectionsData(prev => ({
      ...prev,
      history: updatedHistory.slice(0, 6), // Limit to 6 items for homepage
    }));
  }, [loadHistory]);

  useEffect(() => {
    setKeyword(urlKeyword || '');
    setFilterCategory(urlCategorySlug || '');
    setFilterCountry(urlCountrySlug || '');
    setFilterYear(urlYear || '');
    setCurrentPage(parseInt(searchParams.get('page')) || 1);
  }, [searchParams, urlCategorySlug, urlCountrySlug, urlYear, urlKeyword]);

  const CATEGORIES_MAPPING = [
    { slug: 'phim-moi-cap-nhat', name: 'Phim Mới Cập Nhật' },
    { slug: 'phim-bo', name: 'Phim Bộ' },
    { slug: 'phim-le', name: 'Phim Lẻ' },
    { slug: 'tv-shows', name: 'TV Shows' },
    { slug: 'hoat-hinh', name: 'Hoạt Hình' },
    { slug: 'phim-vietsub', name: 'Phim Vietsub' },
    { slug: 'phim-thuyet-minh', name: 'Phim Thuyết Minh' },
    { slug: 'phim-long-tieng', name: 'Phim Lồng Tiếng' },
    { slug: 'history', name: 'Lịch Sử Xem' },
  ];

  const COUNTRIES_MAPPING = [
    { slug: 'viet-nam', name: 'Việt Nam' },
    { slug: 'trung-quoc', name: 'Trung Quốc' },
    { slug: 'au-my', name: 'Âu Mỹ' },
    { slug: 'nhat-ban', name: 'Nhật Bản' },
    { slug: 'han-quoc', name: 'Hàn Quốc' },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1970 + 2 }, (_, i) => ({
    value: (currentYear + 1 - i).toString(),
    label: (currentYear + 1 - i).toString()
  }));

  const customSelectStyles = {
    control: (provided) => ({
      ...provided,
      backgroundColor: '#333',
      borderColor: '#555',
      color: '#fff',
      boxShadow: 'none',
      '&:hover': { borderColor: '#007bff' }
    }),
    input: (provided) => ({ ...provided, color: '#fff' }),
    placeholder: (provided) => ({ ...provided, color: '#ccc' }),
    singleValue: (provided) => ({ ...provided, color: '#fff' }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isFocused ? '#007bff' : '#333',
      color: '#fff',
      '&:active': { backgroundColor: '#0056b3' }
    }),
    menu: (provided) => ({ ...provided, backgroundColor: '#333' }),
    multiValue: (provided) => ({ ...provided, backgroundColor: '#007bff' }),
    multiValueLabel: (provided) => ({ ...provided, color: '#fff' }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: '#fff',
      '&:hover': { backgroundColor: '#0056b3', color: '#fff' }
    })
  };

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [genreRes, countryRes] = await Promise.all([
          movieApi.fetchGenres(),
          movieApi.fetchCountries()
        ]);
        setGenres(genreRes.data);
        setCountries(countryRes.data);
        localStorage.setItem('genres', JSON.stringify(genreRes.data));
        localStorage.setItem('countries', JSON.stringify(countryRes.data));
      } catch (error) {
        console.error('Error fetching filters:', error);
      }
    };

    const cachedGenres = localStorage.getItem('genres');
    const cachedCountries = localStorage.getItem('countries');
    if (cachedGenres && cachedCountries) {
      setGenres(JSON.parse(cachedGenres));
      setCountries(JSON.parse(cachedCountries));
    } else {
      fetchFilters();
    }
  }, []);

  useEffect(() => {
    if (showMainMovieGrid && urlCategorySlug !== 'history') {
      setLoadingSections(false);
      return;
    }

    const fetchHomePageSections = async () => {
      setLoadingSections(true);

      const sectionPromises = [
        movieApi.fetchRecentUpdates().then(res => ({ key: 'recentMovies', data: res.data.items || [] })),
        movieApi.fetchMoviesBySlug('category', 'phim-bo').then(res => ({ key: 'seriesMovies', data: res.data.data?.items || [] })),
        movieApi.fetchMoviesBySlug('category', 'phim-le').then(res => ({ key: 'singleMovies', data: res.data.data?.items || [] })),
        movieApi.fetchMoviesBySlug('category', 'tv-shows').then(res => ({ key: 'tvShows', data: res.data.data?.items || [] })),
        movieApi.fetchMoviesBySlug('category', 'phim-thuyet-minh').then(res => ({ key: 'dubbedMovies', data: res.data.data?.items || [] })),
        movieApi.fetchMoviesBySlug('category', 'hoat-hinh').then(res => ({ key: 'cartoonMovies', data: res.data.data?.items || [] })),
        movieApi.fetchMoviesBySlug('category', 'phim-long-tieng').then(res => ({ key: 'longTiengMovies', data: res.data.data?.items || [] })),
        movieApi.fetchMoviesBySlug('country', 'viet-nam').then(res => ({ key: 'vietnamMovies', data: res.data.data?.items || [] })),
        movieApi.fetchMoviesBySlug('country', 'trung-quoc').then(res => ({ key: 'chinaMovies', data: res.data.data?.items || [] })),
        movieApi.fetchMoviesBySlug('country', 'au-my').then(res => ({ key: 'usEuMovies', data: res.data.data?.items || [] })),
        movieApi.fetchMoviesBySlug('country', 'nhat-ban').then(res => ({ key: 'japanMovies', data: res.data.data?.items || [] })),
        movieApi.fetchMoviesBySlug('country', 'han-quoc').then(res => ({ key: 'koreaMovies', data: res.data.data?.items || [] })),
        Promise.resolve({ key: 'history', data: loadHistory().slice(0, 6) }),
      ];

      try {
        const results = await Promise.allSettled(sectionPromises);
        const newSectionsData = {};
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            newSectionsData[result.value.key] = result.value.data;
          } else {
            console.error(`Failed to fetch section ${result.reason?.config?.url || ''}:`, result.reason);
          }
        });
        setHomeSectionsData(prev => ({ ...prev, ...newSectionsData }));
      } catch (error) {
        console.error('Unexpected error fetching home page sections:', error);
      } finally {
        setLoadingSections(false);
      }
    };

    fetchHomePageSections();
  }, [showMainMovieGrid, loadHistory]);

  useEffect(() => {
    const fetchMainMovies = async () => {
      setLoadingMain(true);
      let url = '';
      let params = { page: currentPage, limit: DEFAULT_PAGE_LIMIT };
      let newSeoData = {
        titleHead: 'PhimAPI - Danh Sách Phim',
        descriptionHead: 'Xem phim mới cập nhật nhanh nhất'
      };

      try {
        if (urlKeyword) {
          url = `${V1_API_URL}/tim-kiem`;
          params.keyword = urlKeyword;
          newSeoData.titleHead = `Tìm kiếm: ${urlKeyword} - PhimAPI`;
          newSeoData.descriptionHead = `Kết quả tìm kiếm phim cho từ khóa "${urlKeyword}"`;
        } else if (urlCategorySlug) {
          if (urlCategorySlug === 'phim-moi-cap-nhat') {
            url = `${BASE_API_URL}/danh-sach/phim-moi-cap-nhat`;
            newSeoData.titleHead = 'Phim Mới Cập Nhật - PhimAPI';
            newSeoData.descriptionHead = 'Xem phim mới cập nhật nhanh nhất';
          } else if (urlCategorySlug === 'history') {
            newSeoData.titleHead = 'Lịch Sử Xem - PhimAPI';
            newSeoData.descriptionHead = 'Danh sách phim bạn đã xem gần đây.';
          } else {
            const isPredefinedListType = CATEGORIES_MAPPING.some(cat => cat.slug === urlCategorySlug);
            if (isPredefinedListType) {
              url = `${V1_API_URL}/danh-sach/${urlCategorySlug}`;
              const typeName = CATEGORIES_MAPPING.find(cat => cat.slug === urlCategorySlug)?.name || urlCategorySlug;
              newSeoData.titleHead = `${typeName} - PhimAPI`;
              newSeoData.descriptionHead = `Danh sách ${typeName} mới nhất.`;
            } else {
              url = `${V1_API_URL}/the-loai/${urlCategorySlug}`;
              const catName = genres.find(g => g.slug === urlCategorySlug)?.name || urlCategorySlug;
              newSeoData.titleHead = `${catName} - PhimAPI`;
              newSeoData.descriptionHead = `Danh sách phim thể loại ${catName} mới nhất.`;
            }
          }
        } else if (urlCountrySlug) {
          url = `${V1_API_URL}/quoc-gia/${urlCountrySlug}`;
          const countryName = countries.find(c => c.slug === urlCountrySlug)?.name || urlCountrySlug;
          newSeoData.titleHead = `Phim ${countryName} - PhimAPI`;
          newSeoData.descriptionHead = `Danh sách phim quốc gia ${countryName} mới nhất.`;
        } else if (urlYear) {
          url = `${V1_API_URL}/nam/${urlYear}`;
          newSeoData.titleHead = `Phim năm ${urlYear} - PhimAPI`;
          newSeoData.descriptionHead = `Danh sách phim phát hành năm ${urlYear} mới nhất.`;
        } else {
          setMovies([]);
          setTotalPages(1);
          setLoadingMain(false);
          return;
        }

        const response = await movieApi.fetchMoviesBySlug(
          urlKeyword ? 'search' : urlCategorySlug ? (urlCategorySlug === 'history' ? 'history' : CATEGORIES_MAPPING.some(cat => cat.slug === urlCategorySlug) ? 'category' : 'genre') : urlCountrySlug ? 'country' : 'year',
          urlKeyword || urlCategorySlug || urlCountrySlug || urlYear,
          currentPage,
          DEFAULT_PAGE_LIMIT
        );

        let items = [];
        let paginationData = {};
        let seoOnPageData = {};

        if (url === `${BASE_API_URL}/danh-sach/phim-moi-cap-nhat` || urlCategorySlug === 'history') {
          items = response.data.data?.items || response.data.items || [];
          paginationData = response.data.data?.params?.pagination || response.data.pagination || {};
        } else {
          items = response.data.data?.items || [];
          paginationData = response.data.data?.params?.pagination || {};
          seoOnPageData = response.data.data?.seoOnPage || {};
        }

        setMovies(items);
        setTotalPages(paginationData.totalPages || 1);
        setSeoData(seoOnPageData.titleHead ? seoOnPageData : newSeoData);

      } catch (error) {
        console.error('Error fetching main movies:', error);
        setMovies([]);
        setTotalPages(1);
      } finally {
        setLoadingMain(false);
      }
    };

    if (showMainMovieGrid) {
      fetchMainMovies();
    } else {
      setLoadingMain(false);
      setMovies([]);
      setTotalPages(1);
    }
  }, [currentPage, urlKeyword, urlCategorySlug, urlCountrySlug, urlYear, genres, countries, showMainMovieGrid]);

  const handleFilterChange = useCallback((type, selectedValue) => {
    const value = selectedValue ? selectedValue.value : '';
    const newSearchParams = new URLSearchParams();

    if (value) {
      newSearchParams.set('page', '1');
      if (type === 'category') {
        newSearchParams.set('category', value);
      } else if (type === 'country') {
        newSearchParams.set('country', value);
      } else if (type === 'year') {
        newSearchParams.set('year', value);
      }
    }
    navigate(`/?${newSearchParams.toString()}`);
    onCloseFilterModal();
  }, [navigate, onCloseFilterModal]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('page', newPage.toString());
      navigate(`/?${newSearchParams.toString()}`);
    }
  }, [totalPages, searchParams, navigate]);

  const getMainListTitle = () => {
    if (urlKeyword) return `Kết quả tìm kiếm cho: "${urlKeyword}"`;
    if (urlCategorySlug) {
      if (urlCategorySlug === 'phim-moi-cap-nhat') return 'Phim Mới Cập Nhật';
      if (urlCategorySlug === 'history') return 'Lịch Sử Xem';
      const predefined = CATEGORIES_MAPPING.find(cat => cat.slug === urlCategorySlug);
      if (predefined) return predefined.name;
      const genre = genres.find(g => g.slug === urlCategorySlug);
      if (genre) return genre.name;
      return urlCategorySlug;
    }
    if (urlCountrySlug) return countries.find(c => c.slug === urlCountrySlug)?.name || urlCountrySlug;
    if (urlYear) return `Phim năm ${urlYear}`;
    return 'Danh sách phim';
  };

  const showGlobalSpinner = (loadingMain && showMainMovieGrid) || (loadingSections && !showMainMovieGrid);

  if (showGlobalSpinner) {
    return <div className="container"><div className="spinner"></div></div>;
  }

  return (
    <div className="container">
      <Helmet>
        <title>{seoData.titleHead}</title>
        <meta name="description" content={seoData.descriptionHead} />
      </Helmet>

      {showFilterModal && (
        <div className="filter-modal-overlay" onClick={onCloseFilterModal}>
          <div className="filter-modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-modal-button" onClick={onCloseFilterModal} aria-label="Đóng bộ lọc">
              <FaTimes aria-hidden="true" />
            </button>
            <h2 className="modal-title">Bộ Lọc Phim</h2>
            <div className="filter-container-modal">
              <Select
                options={[{ value: '', label: 'Tất cả thể loại' }, ...genres.map(g => ({ value: g.slug, label: g.name }))]}
                value={filterCategory ? { value: filterCategory, label: genres.find(g => g.slug === filterCategory)?.name || filterCategory } : { value: '', label: 'Tất cả thể loại' }}
                onChange={(selected) => handleFilterChange('category', selected)}
                placeholder="Chọn thể loại..."
                className="filter-select"
                styles={customSelectStyles}
              />
              <Select
                options={[{ value: '', label: 'Tất cả quốc gia' }, ...countries.map(c => ({ value: c.slug, label: c.name }))]}
                value={filterCountry ? { value: filterCountry, label: countries.find(c => c.slug === filterCountry)?.name || filterCountry } : { value: '', label: 'Tất cả quốc gia' }}
                onChange={(selected) => handleFilterChange('country', selected)}
                placeholder="Chọn quốc gia..."
                className="filter-select"
                styles={customSelectStyles}
              />
              <Select
                options={[{ value: '', label: 'Tất cả năm' }, ...years]}
                value={filterYear ? { value: filterYear, label: filterYear } : { value: '', label: 'Tất cả năm' }}
                onChange={(selected) => handleFilterChange('year', selected)}
                placeholder="Chọn năm..."
                className="filter-select"
                styles={customSelectStyles}
              />
            </div>
          </div>
        </div>
      )}

      {showMainMovieGrid && (
        <h1 className="main-list-title">
          {getMainListTitle()}
        </h1>
      )}

      {showMainMovieGrid && (
        <>
          {movies.length === 0 && !loadingMain ? (
            <p className="no-movies-found">Không tìm thấy phim nào phù hợp với lựa chọn của bạn.</p>
          ) : (
            <div className="movie-grid">
              {movies.map((movie) => (
                <div key={movie._id} className="movie-card">
                  <Link to={`/movie/${movie.slug}${urlCategorySlug === 'history' ? `/${movie.episode_slug}` : ''}`}>
                    <LazyLoadImage
                      src={getImageUrl(movie.poster_url)}
                      alt={movie.name}
                      className="movie-poster"
                      effect="blur"
                      onError={(e) => (e.target.src = '/placeholder.jpg')}
                    />
                    <h3>{movie.name}</h3>
                    <p>{urlCategorySlug === 'history' ? movie.episode_name : movie.year}</p>
                    {movie.quality && <span className="movie-quality">{movie.quality}</span>}
                    {movie.episode_current && !urlCategorySlug === 'history' && <span className="movie-status">{movie.episode_current}</span>}
                  </Link>
                  {urlCategorySlug === 'history' && (
                    <div className="history-actions">
                      <button
                        onClick={() => navigate(`/movie/${movie.slug}/${movie.episode_slug}`)}
                        className="continue-watching-button"
                        aria-label={`Tiếp tục xem ${movie.name} - ${movie.episode_name}`}
                      >
                        <FaPlay className="icon" aria-hidden="true" /> Tiếp tục xem
                      </button>
                      <button
                        onClick={() => handleDeleteHistory(movie.slug, movie.episode_slug)}
                        className="delete-history-button"
                        aria-label={`Xóa ${movie.name} khỏi lịch sử xem`}
                      >
                        <FaTrash className="icon" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="pagination-button"
                aria-label="Trang trước"
              >
                Trang trước
              </button>
              <span className="pagination-info">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="pagination-button"
                aria-label="Trang sau"
              >
                Trang sau
              </button>
            </div>
          )}
        </>
      )}

      {!showMainMovieGrid && (
        <div className="home-sections-container">
          <HomePageSection
            title="Lịch Sử Xem"
            movies={homeSectionsData.history}
            linkToAll="/?category=history&page=1"
            isLoading={loadingSections}
            isHistory={true}
            onDelete={handleDeleteHistory}
          />
          <HomePageSection
            title="Phim Mới Cập Nhật"
            movies={homeSectionsData.recentMovies}
            linkToAll="/?category=phim-moi-cap-nhat&page=1"
            isLoading={loadingSections}
          />
          <HomePageSection
            title="Phim Bộ"
            movies={homeSectionsData.seriesMovies}
            linkToAll="/?category=phim-bo&page=1"
            isLoading={loadingSections}
          />
          <HomePageSection
            title="Phim Lẻ"
            movies={homeSectionsData.singleMovies}
            linkToAll="/?category=phim-le&page=1"
            isLoading={loadingSections}
          />
          <HomePageSection
            title="TV Shows"
            movies={homeSectionsData.tvShows}
            linkToAll="/?category=tv-shows&page=1"
            isLoading={loadingSections}
          />
          <HomePageSection
            title="Phim Thuyết Minh"
            movies={homeSectionsData.dubbedMovies}
            linkToAll="/?category=phim-thuyet-minh&page=1"
            isLoading={loadingSections}
          />
          <HomePageSection
            title="Hoạt Hình"
            movies={homeSectionsData.cartoonMovies}
            linkToAll="/?category=hoat-hinh&page=1"
            isLoading={loadingSections}
          />
          <HomePageSection
            title="Phim Lồng Tiếng"
            movies={homeSectionsData.longTiengMovies}
            linkToAll="/?category=phim-long-tieng&page=1"
            isLoading={loadingSections}
          />
          <HomePageSection
            title="Phim Việt Nam"
            movies={homeSectionsData.vietnamMovies}
            linkToAll="/?country=viet-nam&page=1"
            isLoading={loadingSections}
          />
          <HomePageSection
            title="Phim Trung Quốc"
            movies={homeSectionsData.chinaMovies}
            linkToAll="/?country=trung-quoc&page=1"
            isLoading={loadingSections}
          />
          <HomePageSection
            title="Phim Âu Mỹ"
            movies={homeSectionsData.usEuMovies}
            linkToAll="/?country=au-my&page=1"
            isLoading={loadingSections}
          />
          <HomePageSection
            title="Phim Nhật Bản"
            movies={homeSectionsData.japanMovies}
            linkToAll="/?country=nhat-ban&page=1"
            isLoading={loadingSections}
          />
          <HomePageSection
            title="Phim Hàn Quốc"
            movies={homeSectionsData.koreaMovies}
            linkToAll="/?country=han-quoc&page=1"
            isLoading={loadingSections}
          />
        </div>
      )}
    </div>
  );
}

export default Home;
