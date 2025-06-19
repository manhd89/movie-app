import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom'; // Import useLocation
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Hls from 'hls.js';
import { FaArrowLeft, FaRegPlayCircle } from 'react-icons/fa';
import 'react-toastify/dist/ReactToastify.css';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

// Ad-blocking CSS (giữ nguyên)
const adBlockCSS = `
  .bg-opacity-40.bg-white.w-full.text-center.space-x-2.bottom-0.absolute {
    display: none !important;
  }
`;

// Config và caches (giữ nguyên)
const config = {
  adsRegexList: [
    new RegExp(
      '(?<!#EXT-X-DISCONTINUITY[\\s\\S]*)#EXT-X-DISCONTINUITY\\n(?:.*?\\n){18,24}#EXT-X-DISCONTINUITY\\n(?![\\s\\S]*#EXT-X-DISCONTINUITY)',
      'g'
    ),
    /#EXT-X-DISCONTINUITY\n(?:#EXT-X-KEY:METHOD=NONE\n(?:.*\n){18,24})?#EXT-X-DISCONTINUITY\n|convertv7\//g,
    /#EXT-X-DISCONTINUITY\n(?:#EXTINF:(?:3.92|0.76|2.00|2.50|2.00|2.42|2.00|0.78|1.96)0000,\n.*\n){9}#EXT-X-DISCONTINUITY\n(?:#EXTINF:(?:2.00|1.76|3.20|2.00|1.36|2.00|2.00|0.72)0000,\n.*\n){8}(?=#EXT-X-DISCONTINUITY)/g,
  ],
  domainBypassWhitelist: ['kkphimplayer', 'phim1280', 'opstream'],
};

const caches = { blob: {} };

function getTotalDuration(playlist) {
  const matches = playlist.match(/#EXTINF:([\d.]+)/g) ?? [];
  return matches.reduce((sum, match) => sum + parseFloat(match.split(':')[1]), 0);
}

function isContainAds(playlist) {
  if (!config || !Array.isArray(config.adsRegexList)) {
    console.error("Lỗi: config hoặc adsRegexList không được định nghĩa đúng cách.");
    return false;
  }
  return config.adsRegexList.some((regex) => {
    regex.lastIndex = 0;
    return regex.test(playlist);
  });
}

function getExceptionDuration(url) {
  url = new URL(url);
  if (['ophim', 'opstream'].some((keyword) => url.hostname.includes(keyword))) {
    return 600;
  } else if (['nguonc', 'streamc'].some((keyword) => url.hostname.includes(keyword))) {
    return Infinity;
  } else {
    return 900;
  }
}

async function removeAds(playlistUrl) {
  playlistUrl = new URL(playlistUrl);
  if (caches.blob[playlistUrl.href]) {
    return caches.blob[playlistUrl.href];
  }
  const isNoNeedToBypass = config.domainBypassWhitelist.some((keyword) =>
    playlistUrl.hostname.includes(keyword)
  );
  try {
    let req = await fetch(playlistUrl);
    if (!req.ok) {
      throw new Error(`HTTP error! status: ${req.status}`);
    }
    let playlist = await req.text();
    playlist = playlist.replace(/^[^#].*$/gm, (line) => {
      try {
        const parsed = new URL(line, playlistUrl);
        return parsed.toString();
      } catch {
        return line;
      }
    });
    if (playlist.includes('#EXT-X-STREAM-INF')) {
      caches.blob[playlistUrl.href] = await removeAds(
        playlist.trim().split('\n').slice(-1)[0]
      );
      return caches.blob[playlistUrl.href];
    }
    if (isContainAds(playlist)) {
      playlist = config.adsRegexList.reduce((playlist2, regex) => {
        return playlist2.replaceAll(regex, '');
      }, playlist);
    } else if (getTotalDuration(playlist) <= getExceptionDuration(playlistUrl)) {
      // No action needed for short playlists
    } else {
      toast.error('Không tìm thấy quảng cáo. Vui lòng báo cáo nếu video chứa quảng cáo.');
    }
    caches.blob[playlistUrl.href] = URL.createObjectURL(
      new Blob([playlist], {
        type: req.headers.get('Content-Type') ?? 'text/plain',
      })
    );
    return caches.blob[playlistUrl.href];
  } catch (error) {
    console.error("Lỗi khi fetch hoặc xử lý playlist:", error);
    toast.error(`Không thể tải playlist video: ${error.message}`);
    throw error;
  }
}

function MovieDetail() {
  const { slug, episodeSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation(); // Sử dụng useLocation để kiểm tra trạng thái điều hướng
  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedServer, setSelectedServer] = useState(() => {
    return parseInt(localStorage.getItem(`selectedServer-${slug}`)) || 0;
  });
  const [currentEpisode, setCurrentEpisode] = useState(null);
  // Mới: `showMovieInfoPanel` điều khiển hiển thị thông tin phim (true) hay player (false)
  const [showMovieInfoPanel, setShowMovieInfoPanel] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef(null);
  const hlsInstanceRef = useRef(null);

  // Inject ad-blocking CSS (giữ nguyên)
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = adBlockCSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Effect 1: Fetch movie data. CHỈ chạy khi `slug` thay đổi.
  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        setInitialLoading(true);
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/phim/${slug}`, {
          timeout: 5000,
        });
        setMovie(response.data.movie);
        setEpisodes(response.data.episodes || []);
        setInitialLoading(false);
      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu phim:', error);
        if (error.response?.status === 404) {
          toast.error('Phim hoặc tập phim không tồn tại.');
        } else {
          toast.error('Lỗi kết nối server. Vui lòng thử lại sau.');
        }
        setInitialLoading(false);
      }
    };
    fetchMovieData();
  }, [slug]);

  // Effect 2: Cập nhật currentEpisode và `showMovieInfoPanel` ban đầu
  useEffect(() => {
    if (movie && episodes.length > 0) {
      const validServerIndex = selectedServer < episodes.length ? selectedServer : 0;
      setSelectedServer(validServerIndex);

      const serverData = episodes[validServerIndex]?.server_data;

      // Logic: Nếu không có episodeSlug trong URL, mặc định hiển thị thông tin phim.
      // Nếu có episodeSlug, cố gắng tìm và phát, nếu không tìm thấy thì vẫn hiển thị thông tin phim.
      if (!episodeSlug) {
        // Chỉ hiện thông tin phim nếu không có episodeSlug trong URL
        setShowMovieInfoPanel(true);
        setCurrentEpisode(null); // Đảm bảo không có tập nào được chọn để phát
      } else {
        // Nếu có episodeSlug, cố gắng tìm tập và hiển thị player
        if (serverData && serverData.length > 0) {
          const episodeToLoad = serverData.find((ep) => ep.slug === episodeSlug);
          if (episodeToLoad) {
            setCurrentEpisode(episodeToLoad);
            setShowMovieInfoPanel(false); // Có tập để phát, hiển thị player
          } else {
            // Có episodeSlug nhưng không tìm thấy tập trên server này
            setCurrentEpisode(null); // Vẫn đặt là null
            setShowMovieInfoPanel(true); // Quay lại hiển thị thông tin phim
            toast.warn('Tập phim không tồn tại trên server này. Đã quay lại trang chi tiết.');
            navigate(`/movie/${slug}`, { replace: true });
          }
        } else {
          // Có episodeSlug nhưng server không có dữ liệu
          setCurrentEpisode(null);
          setShowMovieInfoPanel(true); // Quay lại hiển thị thông tin phim
          toast.warn('Server hoặc tập phim không tồn tại. Đã quay lại trang chi tiết.');
          navigate(`/movie/${slug}`, { replace: true });
        }
      }
    } else if (movie && episodes.length === 0) {
      // Dữ liệu phim đã tải nhưng không có tập nào
      setCurrentEpisode(null);
      setShowMovieInfoPanel(true);
      toast.info('Bộ phim này hiện chưa có tập nào.');
      if (episodeSlug) { // Nếu có episodeSlug nhưng không có tập nào
        navigate(`/movie/${slug}`, { replace: true });
      }
    }
  }, [movie, episodes, selectedServer, episodeSlug, navigate, slug]);

  // Effect 3: Persist selected server (giữ nguyên)
  useEffect(() => {
    localStorage.setItem(`selectedServer-${slug}`, selectedServer);
  }, [selectedServer, slug]);

  // Effect 4: Handle video playback with HLS.js. CHỈ chạy khi `currentEpisode` thay đổi
  // và `showMovieInfoPanel` là false (nghĩa là đang ở chế độ xem player).
  const loadVideo = useCallback(async () => {
    // Chỉ tải video nếu đang ở chế độ hiển thị player VÀ có currentEpisode hợp lệ
    if (showMovieInfoPanel || !currentEpisode?.link_m3u8 || !videoRef.current) {
        setVideoLoading(false);
        if (videoRef.current) { // Đảm bảo video player bị reset nếu không phát
            videoRef.current.src = '';
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
        }
        // Nếu không phát được video nhưng vẫn đang ở chế độ player, hiển thị thông báo
        if (!showMovieInfoPanel && currentEpisode && !isValidUrl(currentEpisode.link_m3u8)) {
            toast.error('Video không khả dụng cho tập này.');
        }
        return;
    }

    const video = videoRef.current;
    setVideoLoading(true);

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    try {
      const cleanPlaylistUrl = await removeAds(currentEpisode.link_m3u8);

      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsInstanceRef.current = hls;
        hls.loadSource(cleanPlaylistUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setVideoLoading(false);
          video.play().catch(error => {
            console.warn("Autoplay was prevented:", error);
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS.js error:', data);
          setVideoLoading(false);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                toast.error('Lỗi mạng khi tải video. Vui lòng kiểm tra kết nối.');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                toast.error('Lỗi phát video. Có thể do định dạng không hỗ trợ.');
                hls.recoverMediaError();
                break;
              default:
                toast.error('Lỗi video nghiêm trọng. Vui lòng thử tập khác.');
                hls.destroy();
                break;
            }
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = cleanPlaylistUrl;
        video.play().catch(error => console.warn("Autoplay was prevented (native):", error));
        setVideoLoading(false);
      } else {
        toast.error('Trình duyệt không hỗ trợ phát HLS. Vui lòng cập nhật.');
        setVideoLoading(false);
      }
    } catch (error) {
      console.error('Error loading video:', error);
      setVideoLoading(false);
    }
  }, [currentEpisode, showMovieInfoPanel]); // Thêm showMovieInfoPanel vào dependency

  useEffect(() => {
    loadVideo();
    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      if (videoRef.current && videoRef.current.src && videoRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(videoRef.current.src);
        videoRef.current.src = '';
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, [currentEpisode, loadVideo]);


  // handleServerChange: Chuyển server, cố gắng giữ tập hiện tại hoặc chọn tập đầu tiên của server mới.
  // Luôn hiển thị player.
  const handleServerChange = useCallback((index) => {
    if (episodes.length === 0) return; // Đảm bảo có episodes trước khi xử lý

    setSelectedServer(index);
    setShowMovieInfoPanel(false); // Chắc chắn hiển thị player

    const newServerData = episodes[index]?.server_data;
    let targetEpisode = null;

    if (newServerData && newServerData.length > 0) {
      // Cố gắng tìm tập hiện tại trong server mới
      targetEpisode = newServerData.find(ep => ep.slug === currentEpisode?.slug);
      if (!targetEpisode) {
        targetEpisode = newServerData[0]; // Mặc định về tập đầu tiên nếu không tìm thấy
        toast.info('Tập hiện tại không có trên server này. Đã chuyển sang tập đầu tiên.');
      }
      setCurrentEpisode(targetEpisode);
      navigate(`/movie/${slug}/${targetEpisode.slug}`, { replace: true });
    } else {
      // Server mới không có tập nào, vẫn cố gắng giữ player
      setCurrentEpisode(null); // Không có tập hợp lệ để phát
      toast.warn('Server này không có tập phim nào.');
      navigate(`/movie/${slug}`, { replace: true }); // Vẫn cập nhật URL
    }
  }, [slug, navigate, episodes, currentEpisode]);

  // handleEpisodeSelect: Chọn một tập cụ thể. Luôn hiển thị player.
  const handleEpisodeSelect = useCallback((episode) => {
    setCurrentEpisode(episode);
    setShowMovieInfoPanel(false); // Chắc chắn hiển thị player
    navigate(`/movie/${slug}/${episode.slug}`);
  }, [slug, navigate]);

  // Các hàm tiện ích khác (giữ nguyên)
  const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
      return url;
    }
    return url ? `${process.env.REACT_APP_API_CDN_IMAGE}/${url}` : '/fallback-image.jpg';
  };

  const truncateDescription = (text, maxLength = 160) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, '');
    return stripped.length > maxLength ? stripped.substring(0, maxLength) + '...' : stripped;
  };

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return url.startsWith('https://');
    } catch {
      return false;
    }
  };

  // Render logic: Kiểm soát hiển thị spinner toàn trang và nội dung.
  if (initialLoading) {
    return (
      <div className="container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!movie) {
    return <div className="container">Phim không tồn tại.</div>;
  }

  return (
    <div className="container">
      <Helmet>
        <title>
          {currentEpisode
            ? `${movie.name} - ${currentEpisode.name || 'Tập phim'}`
            : movie.seoOnPage?.titleHead || movie.name}
        </title>
        <meta
          name="description"
          content={movie.seoOnPage?.descriptionHead || truncateDescription(movie.content)}
        />
      </Helmet>
      <ToastContainer />
      <h1 className="movie-title">
        {movie.name}
        {currentEpisode && ` - ${currentEpisode.name || 'Tập phim'}`}
      </h1>
      <div className="movie-detail">
        {/* Điều kiện hiển thị thông tin phim (showMovieInfoPanel === true) */}
        {showMovieInfoPanel ? (
          <>
            <LazyLoadImage
              src={getImageUrl(movie.poster_url)}
              alt={movie.name}
              className="movie-poster"
              effect="blur"
              width="300"
              height="450"
            />
            <div className="movie-info">
              <p><strong>Tên gốc:</strong> {movie.origin_name}</p>
              <p><strong>Năm:</strong> {movie.year}</p>
              <p>
                <strong>Thể loại:</strong>{' '}
                {movie.category?.map((cat) => cat.name).join(', ') || 'N/A'}
              </p>
              <p>
                <strong>Quốc gia:</strong>{' '}
                {movie.country?.map((c) => c.name).join(', ') || 'N/A'}
              </p>
              <p><strong>Chất lượng:</strong> {movie.quality || 'N/A'}</p>
              <p><strong>Ngôn ngữ:</strong> {movie.lang || 'N/A'}</p>
              <p><strong>Thời lượng:</strong> {movie.time || 'N/A'}</p>
              <p><strong>Trạng thái:</strong> {movie.episode_current || 'Full'}</p>
              <p><strong>Nội dung:</strong> {movie.content || 'Không có mô tả.'}</p>
            </div>
          </>
        ) : ( // Luôn hiển thị khu vực video player nếu showMovieInfoPanel là false
          <>
            <div className="video-player">
              {videoLoading && (
                <div className="video-overlay-spinner">
                  <div className="spinner"></div>
                </div>
              )}
              {currentEpisode && isValidUrl(currentEpisode.link_m3u8) ? (
                <video
                  ref={videoRef}
                  controls
                  width="100%"
                  height="100%"
                  aria-label={`Video player for ${currentEpisode.name || 'Tập phim'}`}
                  className={videoLoading ? 'hidden-video' : ''}
                />
              ) : (
                <div className="video-error-message" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#fff',
                    fontSize: '1.2rem',
                    textAlign: 'center',
                    padding: '20px',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    borderRadius: '8px',
                    zIndex: 5
                }}>
                    <p>Video không khả dụng cho tập này.</p>
                    <FaRegPlayCircle style={{ fontSize: '3rem', marginTop: '10px' }} />
                </div>
              )}
            </div>
            {/* Nút quay lại thông tin phim: chỉ hiển thị khi đang ở chế độ player */}
            <button
              onClick={() => {
                setShowMovieInfoPanel(true); // Chuyển sang hiển thị thông tin phim
                setCurrentEpisode(null); // Xóa tập hiện tại
                navigate(`/movie/${slug}`, { replace: true }); // Cập nhật URL
              }}
              className="back-button"
              aria-label="Quay lại thông tin phim"
            >
              <FaArrowLeft className="icon" /> Quay lại thông tin phim
            </button>
          </>
        )}
      </div>
      {episodes.length > 0 && (
        <div className="episode-list">
          <h3>Danh sách tập</h3>
          <div className="server-list">
            {episodes.map((server, index) => (
              <button
                key={server.server_name}
                onClick={() => handleServerChange(index)}
                className={`server-button ${index === selectedServer ? 'active' : ''}`}
                aria-label={`Chọn server ${server.server_name}`}
              >
                <FaRegPlayCircle className="icon" /> {server.server_name}
              </button>
            ))}
          </div>
          <div className="episodes">
            {episodes[selectedServer]?.server_data?.length > 0 ? (
              episodes[selectedServer].server_data.map((ep, index) => (
                <button
                  key={ep.slug}
                  onClick={() => handleEpisodeSelect(ep)}
                  className={`episode-button ${ep.slug === currentEpisode?.slug ? 'active' : ''}`}
                  aria-label={`Xem ${ep.name || `Tập ${index + 1}`}`}
                >
                  {ep.name || `Tập ${index + 1}`}
                </button>
              ))
            ) : (
              <p>Không có tập phim cho server này.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MovieDetail;
