// src/pages/Home.js
import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import Select from 'react-select'; // Still needed for HomePageSection if filters are displayed there
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { FaAngleRight } from 'react-icons/fa'; // FaTimes, FaHistory, FaTrashAlt are no longer needed here

import 'react-lazy-load-image-component/src/effects/blur.css';
import './Home.css';
import useIntersectionObserver from '../hooks/useIntersectionObserver';

const BASE_API_URL = process.env.REACT_APP_API_URL;
const V1_API_URL = `${process.env.REACT_APP_API_URL}/v1/api`;
const DEFAULT_PAGE_LIMIT = 12;
// WATCH_HISTORY_KEY is no longer used directly in Home.js for rendering history section

const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
        return url;
    }
    return url ? `${process.env.REACT_APP_API_CDN_IMAGE}/${url}` : '/placeholder.jpg';
};

// HistorySection component is removed from here
// as it will be replaced by a dedicated HistoryPage.

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
                    <Link key={movie._id} to={`/movie/${movie.slug}`} className="movie-card-horizontal">
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
                ))}
            </div>
        </div>
    );
}

// HomePage now no longer receives showFilterModal or onCloseFilterModal
function Home() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [movies, setMovies] = useState([]);
    const [loadingMain, setLoadingMain] = useState(false);
    const [totalPages, setTotalPages] = useState(1);

    const urlKeyword = searchParams.get('keyword');
    const urlCategorySlug = searchParams.get('category');
    const urlCountrySlug = searchParams.get('country');
    const urlYear = searchParams.get('year');
    const urlPage = parseInt(searchParams.get('page')) || 1;

    // Filter states are now mainly derived from URL params for display logic,
    // actual selection happens in FilterMenu
    const [filterCategory, setFilterCategory] = useState(urlCategorySlug || '');
    const [filterCountry, setFilterCountry] = useState(urlCountrySlug || '');
    const [filterYear, setFilterYear] = useState(urlYear || '');
    const [currentPage, setCurrentPage] = useState(urlPage);

    const [genres, setGenres] = useState([]);
    const [countries, setCountries] = useState([]);

    const [seoData, setSeoData] = useState({
        titleHead: 'HDonline - Trang Chủ',
        descriptionHead: 'Xem phim mới cập nhật nhanh nhất, tổng hợp phim bộ, phim lẻ, TV Shows.'
    });

    const [homeSectionsData, setHomeSectionsData] = useState({
        recentMovies: null, seriesMovies: null, singleMovies: null, tvShows: null,
        dubbedMovies: null, cartoonMovies: null, longTiengMovies: null,
        vietnamMovies: null, chinaMovies: null, usEuMovies: null, japanMovies: null, koreaMovies: null,
    });
    // requestedSections can be removed if you only check `homeSectionsData[key] === null`

    // Define refs for lazy load sections
    const tvShowsRef = useIntersectionObserver();
    const dubbedMoviesRef = useIntersectionObserver();
    const cartoonMoviesRef = useIntersectionObserver();
    const longTiengMoviesRef = useIntersectionObserver();
    const vietnamMoviesRef = useIntersectionObserver();
    const chinaMoviesRef = useIntersectionObserver();
    const usEuMoviesRef = useIntersectionObserver();
    const japanMoviesRef = useIntersectionObserver();
    const koreaMoviesRef = useIntersectionObserver();

    // Update local state when URL params change
    useEffect(() => {
        setFilterCategory(urlCategorySlug || '');
        setFilterCountry(urlCountrySlug || '');
        setFilterYear(urlYear || '');
        setCurrentPage(urlPage);
    }, [urlKeyword, urlCategorySlug, urlCountrySlug, urlYear, urlPage]);


    // Fetch genres and countries once on mount, as they are used in FilterMenu
    // and also potentially for display logic in Home if needed.
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [genreRes, countryRes] = await Promise.all([
                    axios.get(`${BASE_API_URL}/the-loai`),
                    axios.get(`${BASE_API_URL}/quoc-gia`)
                ]);
                setGenres(genreRes.data);
                setCountries(countryRes.data);
                localStorage.setItem('genres', JSON.stringify(genreRes.data));
                localStorage.setItem('countries', JSON.stringify(countryRes.data));
            } catch (error) {
                console.error('Error fetching filters data for Home:', error);
            }
        };

        const cachedGenres = localStorage.getItem('genres');
        const cachedCountries = localStorage.getItem('countries');
        if (cachedGenres && cachedCountries) {
            setGenres(JSON.parse(cachedGenres));
            setCountries(JSON.parse(cachedCountries));
        } else {
            fetchInitialData();
        }
    }, []); // Only runs once on mount


    // Determine if main movie grid should be shown based on URL params
    const showMainMovieGrid = !!urlKeyword || !!urlCategorySlug || !!urlCountrySlug || !!urlYear;

    // Helper function to fetch a specific section
    const fetchSection = useCallback(async (key, fetchFunc) => {
        if (homeSectionsData[key] === null) { // Only fetch if data is null (not yet fetched)
            try {
                const res = await fetchFunc();
                setHomeSectionsData(prev => ({ ...prev, [key]: res.data.items || res.data.data?.items || [] }));
            } catch (error) {
                console.error(`Failed to fetch section ${key}:`, error);
                setHomeSectionsData(prev => ({ ...prev, [key]: [] }));
            }
        }
    }, [homeSectionsData]);

    // Unified useEffect for fetching data
    useEffect(() => {
        const fetchData = async () => {
            if (showMainMovieGrid) {
                setLoadingMain(true);
                let url = '';
                let params = { page: currentPage, limit: DEFAULT_PAGE_LIMIT };
                let newSeoData = {
                    titleHead: 'Phim Online - Trang Chủ',
                    descriptionHead: 'Xem phim mới cập nhật nhanh nhất, tổng hợp phim bộ, phim lẻ, TV Shows.'
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
                        } else {
                            const isPredefinedListType = ['phim-bo', 'phim-le', 'tv-shows', 'hoat-hinh', 'phim-vietsub', 'phim-thuyet-minh', 'phim-long-tieng'].some(cat => cat === urlCategorySlug);
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

                    const response = await axios.get(url, { params });

                    let items = [];
                    let paginationData = {};
                    let seoOnPageData = {};

                    if (url.includes('/danh-sach/phim-moi-cap-nhat')) {
                        items = response.data.items || [];
                        paginationData = response.data.pagination || {};
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
            } else {
                // Logic for home page sections (lazy loading)
                // Always load the first 3 sections immediately
                fetchSection('recentMovies', () => axios.get(`${BASE_API_URL}/danh-sach/phim-moi-cap-nhat`));
                fetchSection('seriesMovies', () => axios.get(`${V1_API_URL}/danh-sach/phim-bo`));
                fetchSection('singleMovies', () => axios.get(`${V1_API_URL}/danh-sach/phim-le`));

                // Load other sections when their respective refs come into view
                if (tvShowsRef[1]?.isIntersecting) {
                    fetchSection('tvShows', () => axios.get(`${V1_API_URL}/danh-sach/tv-shows`));
                }
                if (dubbedMoviesRef[1]?.isIntersecting) {
                    fetchSection('dubbedMovies', () => axios.get(`${V1_API_URL}/danh-sach/phim-thuyet-minh`));
                }
                if (cartoonMoviesRef[1]?.isIntersecting) {
                    fetchSection('cartoonMovies', () => axios.get(`${V1_API_URL}/danh-sach/hoat-hinh`));
                }
                if (longTiengMoviesRef[1]?.isIntersecting) {
                    fetchSection('longTiengMovies', () => axios.get(`${V1_API_URL}/danh-sach/phim-long-tieng`));
                }
                if (vietnamMoviesRef[1]?.isIntersecting) {
                    fetchSection('vietnamMovies', () => axios.get(`${V1_API_URL}/quoc-gia/viet-nam`));
                }
                if (chinaMoviesRef[1]?.isIntersecting) {
                    fetchSection('chinaMovies', () => axios.get(`${V1_API_URL}/quoc-gia/trung-quoc`));
                }
                if (usEuMoviesRef[1]?.isIntersecting) {
                    fetchSection('usEuMovies', () => axios.get(`${V1_API_URL}/quoc-gia/au-my`));
                }
                if (japanMoviesRef[1]?.isIntersecting) {
                    fetchSection('japanMovies', () => axios.get(`${V1_API_URL}/quoc-gia/nhat-ban`));
                }
                if (koreaMoviesRef[1]?.isIntersecting) {
                    fetchSection('koreaMovies', () => axios.get(`${V1_API_URL}/quoc-gia/han-quoc`));
                }
            }
        };

        fetchData();
    }, [
        currentPage, urlKeyword, urlCategorySlug, urlCountrySlug, urlYear, showMainMovieGrid,
        genres, countries, fetchSection,
        tvShowsRef[1]?.isIntersecting, dubbedMoviesRef[1]?.isIntersecting, cartoonMoviesRef[1]?.isIntersecting, longTiengMoviesRef[1]?.isIntersecting,
        vietnamMoviesRef[1]?.isIntersecting, chinaMoviesRef[1]?.isIntersecting, usEuMoviesRef[1]?.isIntersecting, japanMoviesRef[1]?.isIntersecting, koreaMoviesRef[1]?.isIntersecting
    ]);


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

    const showGlobalSpinner = (loadingMain && showMainMovieGrid);

    if (showGlobalSpinner) {
        return <div className="container"><div className="spinner"></div></div>;
    }

    return (
        <div className="container">
            <Helmet>
                <title>{seoData.titleHead}</title>
                <meta name="description" content={seoData.descriptionHead} />
            </Helmet>

            {/* Filter modal is removed from here */}

            {showMainMovieGrid && (
                <h1 className="main-list-title">
                    {getMainListTitle()}
                </h1>
            )}

            {showMainMovieGrid ? (
                <>
                    {loadingMain ? (
                        <div className="main-grid-spinner">
                            <div className="spinner"></div>
                        </div>
                    ) : (movies.length === 0 ? (
                        <p className="no-movies-found">Không tìm thấy phim nào phù hợp với lựa chọn của bạn.</p>
                    ) : (
                        <div className="movie-grid">
                            {movies.map((movie) => (
                                <Link key={movie._id} to={`/movie/${movie.slug}`} className="movie-card">
                                    <LazyLoadImage
                                        src={getImageUrl(movie.poster_url)}
                                        alt={movie.name}
                                        className="movie-poster"
                                        effect="blur"
                                        onError={(e) => (e.target.src = '/placeholder.jpg')}
                                    />
                                    <h3>{movie.name}</h3>
                                    <p>{movie.year}</p>
                                    {movie.quality && <span className="movie-quality">{movie.quality}</span>}
                                    {movie.episode_current && <span className="movie-status">{movie.episode_current}</span>}
                                </Link>
                            ))}
                        </div>
                    ))}
                    {totalPages > 1 && !loadingMain && (
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
            ) : (
                <div className="home-sections-container">
                    {/* These sections are always loaded initially */}
                    <HomePageSection
                        title="Phim Mới Cập Nhật"
                        movies={homeSectionsData.recentMovies}
                        linkToAll="/?category=phim-moi-cap-nhat&page=1"
                        isLoading={homeSectionsData.recentMovies === null}
                    />

                    <HomePageSection
                        title="Phim Bộ"
                        movies={homeSectionsData.seriesMovies}
                        linkToAll="/?category=phim-bo&page=1"
                        isLoading={homeSectionsData.seriesMovies === null}
                    />
                    <HomePageSection
                        title="Phim Lẻ"
                        movies={homeSectionsData.singleMovies}
                        linkToAll="/?category=phim-le&page=1"
                        isLoading={homeSectionsData.singleMovies === null}
                    />
                    {/* HistorySection is removed from here. It will be on a dedicated page. */}

                    {/* Lazy-loaded sections - each with its own ref */}
                    {/* TV Shows */}
                    <div ref={tvShowsRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="TV Shows"
                            movies={homeSectionsData.tvShows}
                            linkToAll="/?category=tv-shows&page=1"
                            isLoading={homeSectionsData.tvShows === null && tvShowsRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Thuyết Minh */}
                    <div ref={dubbedMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Thuyết Minh"
                            movies={homeSectionsData.dubbedMovies}
                            linkToAll="/?category=phim-thuyet-minh&page=1"
                            isLoading={homeSectionsData.dubbedMovies === null && dubbedMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Hoạt Hình */}
                    <div ref={cartoonMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Hoạt Hình"
                            movies={homeSectionsData.cartoonMovies}
                            linkToAll="/?category=hoat-hinh&page=1"
                            isLoading={homeSectionsData.cartoonMovies === null && cartoonMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Lồng Tiếng */}
                    <div ref={longTiengMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Lồng Tiếng"
                            movies={homeSectionsData.longTiengMovies}
                            linkToAll="/?category=phim-long-tieng&page=1"
                            isLoading={homeSectionsData.longTiengMovies === null && longTiengMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Việt Nam */}
                    <div ref={vietnamMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Việt Nam"
                            movies={homeSectionsData.vietnamMovies}
                            linkToAll="/?country=viet-nam&page=1"
                            isLoading={homeSectionsData.vietnamMovies === null && vietnamMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Trung Quốc */}
                    <div ref={chinaMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Trung Quốc"
                            movies={homeSectionsData.chinaMovies}
                            linkToAll="/?country=trung-quoc&page=1"
                            isLoading={homeSectionsData.chinaMovies === null && chinaMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Âu Mỹ */}
                    <div ref={usEuMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Âu Mỹ"
                            movies={homeSectionsData.usEuMovies}
                            linkToAll="/?country=au-my&page=1"
                            isLoading={homeSectionsData.usEuMovies === null && usEuMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Nhật Bản */}
                    <div ref={japanMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Nhật Bản"
                            movies={homeSectionsData.japanMovies}
                            linkToAll="/?country=nhat-ban&page=1"
                            isLoading={homeSectionsData.japanMovies === null && japanMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Hàn Quốc */}
                    <div ref={koreaMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Hàn Quốc"
                            movies={homeSectionsData.koreaMovies}
                            linkToAll="/?country=han-quoc&page=1"
                            isLoading={homeSectionsData.koreaMovies === null && koreaMoviesRef[1]?.isIntersecting}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;
