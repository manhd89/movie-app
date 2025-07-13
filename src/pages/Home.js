import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { FaAngleRight, FaTimes, FaHistory, FaTrashAlt } from 'react-icons/fa';

import MovieCard from '../components/MovieCard';
import YearFilter from '../components/YearFilter';
import TypeFilter from '../components/TypeFilter';
import GenreFilter from '../components/GenreFilter';
import DubbedFilter from '../components/DubbedFilter';
import CountryFilter from '../components/CountryFilter';

import { years as staticYears } from '../components/YearFilter';
import { types as staticTypes } from '../components/TypeFilter';
import { genres as staticGenres } from '../components/GenreFilter';
import { dubbedOptions as staticDubbedOptions } from '../components/DubbedFilter';
import { countries as staticCountries } from '../components/CountryFilter';


import 'react-lazy-load-image-component/src/effects/blur.css';
import './Home.css';
import useIntersectionObserver from '../hooks/useIntersectionObserver'; // Import the hook

const BASE_API_URL = process.env.REACT_APP_API_URL;
const V1_API_URL = `${process.env.REACT_APP_API_URL}/v1/api`;
const DEFAULT_PAGE_LIMIT = 12;
const WATCH_HISTORY_KEY = 'watchHistory';

// getImageUrl giờ có thể được đơn giản hóa hoặc loại bỏ nếu MovieCard handle tất cả
// Hoặc giữ lại nếu cần cho các chỗ khác ngoài MovieCard
const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
        return url;
    }
    return url ? `${process.env.REACT_APP_API_CDN_IMAGE}/${url}` : '/placeholder.jpg';
};

const movieApi = {
    // Không fetch genres và countries ở đây nữa nếu dùng dữ liệu tĩnh từ filter components
    fetchRecentUpdates: (page = 1) => axios.get(`${BASE_API_URL}/danh-sach/phim-moi-cap-nhat?page=${page}`),
    fetchMoviesBySlug: (type, slug, page = 1, limit = DEFAULT_PAGE_LIMIT, filters = {}) => {
        let url;
        // Logic này cần được kiểm tra lại để phù hợp với tham số mới
        if (type === 'category') url = `${V1_API_URL}/danh-sach/${slug}`; // Ví dụ: phim-bo, tv-shows
        else if (type === 'genre') url = `${V1_API_URL}/the-loai/${slug}`;
        else if (type === 'country') url = `${V1_API_URL}/quoc-gia/${slug}`;
        else if (type === 'year') url = `${V1_API_URL}/nam/${slug}`;
        else if (type === 'search') url = `${V1_API_URL}/tim-kiem`;
        else return Promise.reject(new Error("Invalid fetch type for movieApi.fetchMoviesBySlug"));

        return axios.get(url, { params: { page, limit, ...filters } });
    }
};

const CATEGORIES_MAPPING = [
    { slug: 'phim-moi-cap-nhat', name: 'Phim Mới Cập Nhật' },
    { slug: 'phim-bo', name: 'Phim Bộ' },
    { slug: 'phim-le', name: 'Phim Lẻ' },
    { slug: 'tv-shows', name: 'TV Shows' },
    { slug: 'hoat-hinh', name: 'Hoạt Hình' },
    { slug: 'phim-vietsub', name: 'Phim Vietsub' }, // Kiểm tra lại nếu có API cho vietsub riêng
    { slug: 'phim-thuyet-minh', name: 'Phim Thuyết Minh' },
    { slug: 'phim-long-tieng', name: 'Phim Lồng Tiếng' },
];

function HistorySection({ historyMovies, onDeleteHistoryItem }) {
    const navigate = useNavigate();

    const handleContinueWatching = useCallback((movieSlug, episodeSlug) => {
        navigate(`/movie/${movieSlug}/${episodeSlug}`);
    }, [navigate]);

    if (!historyMovies || historyMovies.length === 0) {
        return null;
    }

    const displayMovies = historyMovies.slice(0, 10);
    const hasMoreHistory = historyMovies.length > 10;

    return (
        <div className="history-section">
            <div className="section-header">
                <h2>Lịch Sử Đã Xem</h2>
                {hasMoreHistory && (
                    <Link to="/history" className="see-all-link">
                        Xem tất cả <FaAngleRight />
                    </Link>
                )}
            </div>
            <div className="history-movie-list">
                {displayMovies.map((movie) => (
                    <div key={movie.slug + (movie.episode?.slug || '')} className="history-movie-card">
                        <Link to={`/movie/${movie.slug}/${movie.episode?.slug || ''}`}>
                            <LazyLoadImage
                                src={getImageUrl(movie.poster_url)} // Vẫn dùng getImageUrl ở đây
                                alt={movie.name}
                                className="movie-poster-horizontal"
                                effect="blur"
                                onError={(e) => (e.target.src = '/placeholder.jpg')}
                            />
                            <h3>{movie.name}</h3>
                            {movie.episode?.name && (
                                <p>Tập: {movie.episode.name} ({movie.episode.server_name || 'N/A'})</p>
                            )}
                            {!movie.episode?.name && movie.year && <p>{movie.year}</p>}
                        </Link>
                        <div className="history-actions">
                            {movie.episode?.slug && (
                                <button
                                    onClick={() => handleContinueWatching(movie.slug, movie.episode.slug)}
                                    className="continue-watching-button"
                                >
                                    <FaHistory /> Tiếp tục xem
                                </button>
                            )}
                            <button
                                onClick={() => onDeleteHistoryItem(movie.slug)}
                                className="delete-history-item-button"
                                title="Xóa khỏi lịch sử"
                            >
                                <FaTrashAlt />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

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
                        {/* Sử dụng MovieCard ở đây */}
                        <MovieCard movie={movie} />
                    </Link>
                ))}
            </div>
        </div>
    );
}

function Home({ showFilterModal, onCloseFilterModal }) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [movies, setMovies] = useState([]);
    const [loadingMain, setLoadingMain] = useState(false);
    const [totalPages, setTotalPages] = useState(1);

    // Lấy tham số từ URL với tên mới
    const urlKeyword = searchParams.get('keyword');
    const urlCategorySlug = searchParams.get('category'); // Vẫn giữ category cho các danh mục cố định
    const urlGenreSlug = searchParams.get('the-loai'); // Thể loại
    const urlCountrySlug = searchParams.get('quoc-gia'); // Quốc gia
    const urlYear = searchParams.get('nam'); // Năm
    const urlTypeSlug = searchParams.get('type'); // Loại phim (Phim bộ, phim lẻ, ...)
    const urlDubbedSlug = searchParams.get('dubbed'); // Lồng tiếng/Thuyết minh

    const urlPage = parseInt(searchParams.get('page')) || 1;

    // Không cần các state filter riêng nữa, vì các component filter tự quản lý
    const [currentPage, setCurrentPage] = useState(urlPage);

    // Không cần state genres và countries nữa, dùng dữ liệu tĩnh từ components
    // const [genres, setGenres] = useState([]);
    // const [countries, setCountries] = useState([]);

    const [seoData, setSeoData] = useState({
        titleHead: 'HDonline - Trang Chủ',
        descriptionHead: 'Xem phim mới cập nhật nhanh nhất, tổng hợp phim bộ, phim lẻ, TV Shows.'
    });

    const [homeSectionsData, setHomeSectionsData] = useState({
        recentMovies: null, seriesMovies: null, singleMovies: null, tvShows: null,
        dubbedMovies: null, cartoonMovies: null, longTiengMovies: null,
        vietnamMovies: null, chinaMovies: null, usEuMovies: null, japanMovies: null, koreaMovies: null,
    });
    const [requestedSections, setRequestedSections] = useState(new Set());

    const [watchHistory, setWatchHistory] = useState([]);

    const tvShowsRef = useIntersectionObserver();
    const dubbedMoviesRef = useIntersectionObserver();
    const cartoonMoviesRef = useIntersectionObserver();
    const longTiengMoviesRef = useIntersectionObserver();
    const vietnamMoviesRef = useIntersectionObserver();
    const chinaMoviesRef = useIntersectionObserver();
    const usEuMoviesRef = useIntersectionObserver();
    const japanMoviesRef = useIntersectionObserver();
    const koreaMoviesRef = useIntersectionObserver();

    // Cập nhật currentPage khi URL params thay đổi
    useEffect(() => {
        setCurrentPage(urlPage);
    }, [urlKeyword, urlCategorySlug, urlGenreSlug, urlCountrySlug, urlYear, urlTypeSlug, urlDubbedSlug, urlPage]);


    useEffect(() => {
        const history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
        setWatchHistory(history.sort((a, b) => b.timestamp - a.timestamp));
    }, []);

    const handleDeleteHistoryItem = useCallback((slugToRemove) => {
        setWatchHistory(prevHistory => {
            const updatedHistory = prevHistory.filter(item => item.slug !== slugToRemove);
            localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    }, []);

    // Xác định xem có nên hiển thị lưới phim chính dựa trên các tham số URL mới
    const showMainMovieGrid = !!urlKeyword || !!urlCategorySlug || !!urlGenreSlug || !!urlCountrySlug || !!urlYear || !!urlTypeSlug || !!urlDubbedSlug;

    const fetchSection = useCallback(async (key, fetchFunc) => {
        if (homeSectionsData[key] === null && !requestedSections.has(key)) {
            setRequestedSections(prev => new Set(prev).add(key));
            try {
                const res = await fetchFunc();
                setHomeSectionsData(prev => ({ ...prev, [key]: res.data.items || res.data.data?.items || [] }));
            } catch (error) {
                console.error(`Failed to fetch section ${key}:`, error);
                setHomeSectionsData(prev => ({ ...prev, [key]: [] }));
            }
        }
    }, [homeSectionsData, requestedSections]);


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
                        newSeoData.titleHead = `Tìm kiếm: ${urlKeyword} - HDonline`;
                        newSeoData.descriptionHead = `Kết quả tìm kiếm phim cho từ khóa "${urlKeyword}"`;
                    } else if (urlCategorySlug) { // Cho các danh mục cố định như phim-moi-cap-nhat
                        if (urlCategorySlug === 'phim-moi-cap-nhat') {
                            url = `${BASE_API_URL}/danh-sach/phim-moi-cap-nhat`;
                            newSeoData.titleHead = 'Phim Mới Cập Nhật - HDonline';
                            newSeoData.descriptionHead = 'Xem phim mới cập nhật nhanh nhất';
                        } else { // Vẫn giữ để catch các trường hợp category cũ hoặc khác
                            const isPredefinedListType = CATEGORIES_MAPPING.some(cat => cat.slug === urlCategorySlug);
                            if (isPredefinedListType) {
                                url = `${V1_API_URL}/danh-sach/${urlCategorySlug}`;
                                const typeName = CATEGORIES_MAPPING.find(cat => cat.slug === urlCategorySlug)?.name || urlCategorySlug;
                                newSeoData.titleHead = `${typeName} - HDonline`;
                                newSeoData.descriptionHead = `Danh sách ${typeName} mới nhất.`;
                            }
                            // else { Fallback nếu có category không khớp, nhưng các bộ lọc mới đã xử lý }
                        }
                    } else if (urlGenreSlug) { // Thể loại
                        url = `${V1_API_URL}/the-loai/${urlGenreSlug}`;
                        const genreName = staticGenres.find(g => g.slug === urlGenreSlug)?.name || urlGenreSlug;
                        newSeoData.titleHead = `${genreName} - HDonline`;
                        newSeoData.descriptionHead = `Danh sách phim thể loại ${genreName} mới nhất.`;
                    } else if (urlCountrySlug) { // Quốc gia
                        url = `${V1_API_URL}/quoc-gia/${urlCountrySlug}`;
                        const countryName = staticCountries.find(c => c.slug === urlCountrySlug)?.name || urlCountrySlug;
                        newSeoData.titleHead = `Phim ${countryName} - HDonline`;
                        newSeoData.descriptionHead = `Danh sách phim quốc gia ${countryName} mới nhất.`;
                    } else if (urlYear) { // Năm
                        url = `${V1_API_URL}/nam/${urlYear}`;
                        newSeoData.titleHead = `Phim năm ${urlYear} - HDonline`;
                        newSeoData.descriptionHead = `Danh sách phim phát hành năm ${urlYear} mới nhất.`;
                    } else if (urlTypeSlug) { // Loại phim (phim bộ, phim lẻ...)
                        url = `${V1_API_URL}/danh-sach/${urlTypeSlug}`;
                        const typeName = staticTypes.find(t => t.slug === urlTypeSlug)?.name || urlTypeSlug;
                        newSeoData.titleHead = `${typeName} - HDonline`;
                        newSeoData.descriptionHead = `Danh sách ${typeName} mới nhất.`;
                    } else if (urlDubbedSlug) { // Lồng tiếng/Thuyết minh
                        url = `${V1_API_URL}/danh-sach/${urlDubbedSlug}`;
                        const dubbedName = staticDubbedOptions.find(d => d.slug === urlDubbedSlug)?.name || urlDubbedSlug;
                        newSeoData.titleHead = `${dubbedName} - HDonline`;
                        newSeoData.descriptionHead = `Danh sách phim ${dubbedName} mới nhất.`;
                    }
                    else {
                        setMovies([]);
                        setTotalPages(1);
                        setLoadingMain(false);
                        return;
                    }

                    const response = await axios.get(url, { params });
                    console.log("API response for main movies:", response.data);

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
                fetchSection('recentMovies', movieApi.fetchRecentUpdates);
                fetchSection('seriesMovies', () => movieApi.fetchMoviesBySlug('category', 'phim-bo'));
                fetchSection('singleMovies', () => movieApi.fetchMoviesBySlug('category', 'phim-le'));

                if (tvShowsRef[1]?.isIntersecting) {
                    fetchSection('tvShows', () => movieApi.fetchMoviesBySlug('category', 'tv-shows'));
                }
                if (dubbedMoviesRef[1]?.isIntersecting) {
                    fetchSection('dubbedMovies', () => movieApi.fetchMoviesBySlug('category', 'phim-thuyet-minh'));
                }
                if (cartoonMoviesRef[1]?.isIntersecting) {
                    fetchSection('cartoonMovies', () => movieApi.fetchMoviesBySlug('category', 'hoat-hinh'));
                }
                if (longTiengMoviesRef[1]?.isIntersecting) {
                    fetchSection('longTiengMovies', () => movieApi.fetchMoviesBySlug('category', 'phim-long-tieng'));
                }
                if (vietnamMoviesRef[1]?.isIntersecting) {
                    fetchSection('vietnamMovies', () => movieApi.fetchMoviesBySlug('country', 'viet-nam'));
                }
                if (chinaMoviesRef[1]?.isIntersecting) {
                    fetchSection('chinaMovies', () => movieApi.fetchMoviesBySlug('country', 'trung-quoc'));
                }
                if (usEuMoviesRef[1]?.isIntersecting) {
                    fetchSection('usEuMovies', () => movieApi.fetchMoviesBySlug('country', 'au-my'));
                }
                if (japanMoviesRef[1]?.isIntersecting) {
                    fetchSection('japanMovies', () => movieApi.fetchMoviesBySlug('country', 'nhat-ban'));
                }
                if (koreaMoviesRef[1]?.isIntersecting) {
                    fetchSection('koreaMovies', () => movieApi.fetchMoviesBySlug('country', 'han-quoc'));
                }
            }
        };

        fetchData();
    }, [
        currentPage, urlKeyword, urlCategorySlug, urlGenreSlug, urlCountrySlug, urlYear, urlTypeSlug, urlDubbedSlug, showMainMovieGrid,
        fetchSection,
        tvShowsRef[1], dubbedMoviesRef[1], cartoonMoviesRef[1], longTiengMoviesRef[1],
        vietnamMoviesRef[1], chinaMoviesRef[1], usEuMoviesRef[1], japanMoviesRef[1], koreaMoviesRef[1]
    ]);


    // handleFilterChange không còn cần thiết vì các component filter tự xử lý
    // const handleFilterChange = useCallback(...)

    const handlePageChange = useCallback((newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.set('page', newPage.toString());
            navigate(`/?${newSearchParams.toString()}`);
        }
    }, [totalPages, searchParams, navigate]);

    // Cập nhật getMainListTitle để dùng các slug mới và dữ liệu tĩnh
    const getMainListTitle = () => {
        if (urlKeyword) return `Kết quả tìm kiếm cho: "${urlKeyword}"`;
        if (urlGenreSlug) return staticGenres.find(g => g.slug === urlGenreSlug)?.name || urlGenreSlug;
        if (urlTypeSlug) return staticTypes.find(t => t.slug === urlTypeSlug)?.name || urlTypeSlug;
        if (urlCountrySlug) return staticCountries.find(c => c.slug === urlCountrySlug)?.name || urlCountrySlug;
        if (urlYear) return `Phim năm ${urlYear}`;
        if (urlDubbedSlug) return staticDubbedOptions.find(d => d.slug === urlDubbedSlug)?.name || urlDubbedSlug;
        if (urlCategorySlug) { // Giữ lại cho các danh mục cố định như "phim-moi-cap-nhat"
            const predefined = CATEGORIES_MAPPING.find(cat => cat.slug === urlCategorySlug);
            if (predefined) return predefined.name;
        }
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

            {showFilterModal && (
                <div className="filter-modal-overlay" onClick={onCloseFilterModal}>
                    <div className="filter-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-modal-button" onClick={onCloseFilterModal}>
                            <FaTimes />
                        </button>
                        <h2 className="modal-title">Bộ Lọc Phim</h2>
                        <div className="filter-container-modal">
                            {/* Render các component filter mới ở đây */}
                            <GenreFilter />
                            <CountryFilter />
                            <YearFilter />
                            <TypeFilter />
                            <DubbedFilter />
                        </div>
                    </div>
                </div>
            )}

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
                                    {/* Sử dụng MovieCard */}
                                    <MovieCard movie={movie} />
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
                            >
                                Trang sau
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="home-sections-container">
                    <HomePageSection
                        title="Phim Mới Cập Nhật"
                        movies={homeSectionsData.recentMovies}
                        linkToAll="/?category=phim-moi-cap-nhat&page=1"
                        isLoading={homeSectionsData.recentMovies === null}
                    />

                    <HomePageSection
                        title="Phim Bộ"
                        movies={homeSectionsData.seriesMovies}
                        linkToAll="/?type=phim-bo&page=1" // Đã thay đổi category thành type
                        isLoading={homeSectionsData.seriesMovies === null}
                    />
                    <HomePageSection
                        title="Phim Lẻ"
                        movies={homeSectionsData.singleMovies}
                        linkToAll="/?type=phim-le&page=1" // Đã thay đổi category thành type
                        isLoading={homeSectionsData.singleMovies === null}
                    />
                    {watchHistory.length > 0 && (
                        <HistorySection
                            historyMovies={watchHistory}
                            onDeleteHistoryItem={handleDeleteHistoryItem}
                        />
                    )}

                    <div ref={tvShowsRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="TV Shows"
                            movies={homeSectionsData.tvShows}
                            linkToAll="/?type=tv-shows&page=1" // Đã thay đổi category thành type
                            isLoading={homeSectionsData.tvShows === null && tvShowsRef[1]?.isIntersecting}
                        />
                    </div>

                    <div ref={dubbedMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Thuyết Minh"
                            movies={homeSectionsData.dubbedMovies}
                            linkToAll="/?dubbed=phim-thuyet-minh&page=1" // Đã thay đổi category thành dubbed
                            isLoading={homeSectionsData.dubbedMovies === null && dubbedMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    <div ref={cartoonMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Hoạt Hình"
                            movies={homeSectionsData.cartoonMovies}
                            linkToAll="/?type=hoat-hinh&page=1" // Đã thay đổi category thành type
                            isLoading={homeSectionsData.cartoonMovies === null && cartoonMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    <div ref={longTiengMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Lồng Tiếng"
                            movies={homeSectionsData.longTiengMovies}
                            linkToAll="/?dubbed=phim-long-tieng&page=1" // Đã thay đổi category thành dubbed
                            isLoading={homeSectionsData.longTiengMovies === null && longTiengMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    <div ref={vietnamMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Việt Nam"
                            movies={homeSectionsData.vietnamMovies}
                            linkToAll="/?quoc-gia=viet-nam&page=1" // Đã thay đổi country thành quoc-gia
                            isLoading={homeSectionsData.vietnamMovies === null && vietnamMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    <div ref={chinaMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Trung Quốc"
                            movies={homeSectionsData.chinaMovies}
                            linkToAll="/?quoc-gia=trung-quoc&page=1" // Đã thay đổi country thành quoc-gia
                            isLoading={homeSectionsData.chinaMovies === null && chinaMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    <div ref={usEuMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Âu Mỹ"
                            movies={homeSectionsData.usEuMovies}
                            linkToAll="/?quoc-gia=au-my&page=1" // Đã thay đổi country thành quoc-gia
                            isLoading={homeSectionsData.usEuMovies === null && usEuMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    <div ref={japanMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Nhật Bản"
                            movies={homeSectionsData.japanMovies}
                            linkToAll="/?quoc-gia=nhat-ban&page=1" // Đã thay đổi country thành quoc-gia
                            isLoading={homeSectionsData.japanMovies === null && japanMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    <div ref={koreaMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Hàn Quốc"
                            movies={homeSectionsData.koreaMovies}
                            linkToAll="/?quoc-gia=han-quoc&page=1" // Đã thay đổi country thành quoc-gia
                            isLoading={homeSectionsData.koreaMovies === null && koreaMoviesRef[1]?.isIntersecting}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;
