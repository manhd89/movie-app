import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Hls from 'hls.js';
import { FaArrowLeft, FaRegPlayCircle } from 'react-icons/fa';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

// --- Constants ---
// Use environment variables for API URLs
const BASE_API_URL = process.env.REACT_APP_API_URL;
const CDN_IMAGE_URL = process.env.REACT_APP_API_CDN_IMAGE;

// Ad-blocking CSS (giữ nguyên)
const adBlockCSS = `
  .bg-opacity-40.bg-white.w-full.text-center.space-x-2.bottom-0.absolute {
    display: none !important;
  }
`;

// Hàm removeAds sẽ đơn giản hơn nhiều khi có Service Worker
async function removeAds(playlistUrl) {
  // Service Worker sẽ tự động chặn và xử lý request này
  return playlistUrl;
}

// Hằng số để lưu trữ vị trí tối thiểu để coi là đang xem
const PLAYBACK_SAVE_THRESHOLD_SECONDS = 5; // Lưu vị trí nếu đã xem ít nhất 5 giây
const LAST_PLAYED_KEY_PREFIX = 'lastPlayedPosition-';

function MovieDetail() {
  const { slug, episodeSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedServer, setSelectedServer] = useState(() => {
    return parseInt(localStorage.getItem(`selectedServer-${slug}`)) || 0;
  });
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [showMovieInfoPanel, setShowMovieInfoPanel] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef(null);
  const hlsInstanceRef = useRef(null);

  // Thêm một ref để lưu trữ vị trí video hiện tại khi tạm dừng/thoát
  const currentPlaybackPositionRef = useRef(0);

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
        // Sử dụng BASE_API_URL
        const response = await axios.get(`${BASE_API_URL}/phim/${slug}`, {
          timeout: 5000,
        });
        setMovie(response.data.movie);
        setEpisodes(response.data.episodes || []);
        setInitialLoading(false);
      } catch (error) {
        // Loại bỏ console.error
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

      if (!episodeSlug) {
        setShowMovieInfoPanel(true);
        setCurrentEpisode(null);
      } else {
        if (serverData && serverData.length > 0) {
          const episodeToLoad = serverData.find((ep) => ep.slug === episodeSlug);
          if (episodeToLoad) {
            setCurrentEpisode(episodeToLoad);
            setShowMovieInfoPanel(false);
          } else {
            setCurrentEpisode(null);
            setShowMovieInfoPanel(true);
            navigate(`/movie/${slug}`, { replace: true });
          }
        } else {
          setCurrentEpisode(null);
          setShowMovieInfoPanel(true);
          navigate(`/movie/${slug}`, { replace: true });
        }
      }
    } else if (movie && episodes.length === 0) {
      setCurrentEpisode(null);
      setShowMovieInfoPanel(true);
      if (episodeSlug) {
        navigate(`/movie/${slug}`, { replace: true });
      }
    }
  }, [movie, episodes, selectedServer, episodeSlug, navigate, slug]);

  // Effect 3: Persist selected server (giữ nguyên)
  useEffect(() => {
    localStorage.setItem(`selectedServer-${slug}`, selectedServer);
  }, [selectedServer, slug]);

  // Hàm để tạo key lưu trữ vị trí video
  const getPlaybackPositionKey = useCallback((epSlug) => {
    return `${LAST_PLAYED_KEY_PREFIX}${slug}-${epSlug}`;
  }, [slug]);

  // Hàm để lưu vị trí video hiện tại
  const savePlaybackPosition = useCallback(() => {
    const video = videoRef.current;
    if (video && currentEpisode && video.currentTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
      const key = getPlaybackPositionKey(currentEpisode.slug);
      localStorage.setItem(key, video.currentTime.toString());
      // Loại bỏ console.log
    }
  }, [currentEpisode, getPlaybackPositionKey]);

  // Effect 4: Handle video playback with HLS.js. CHỈ chạy khi `currentEpisode` thay đổi
  const loadVideo = useCallback(async () => {
    const video = videoRef.current;
    if (showMovieInfoPanel || !currentEpisode?.link_m3u8 || !video) {
        setVideoLoading(false);
        if (video) {
            video.src = '';
            video.removeAttribute('src');
            video.load();
        }
        // Loại bỏ console.error
        return;
    }

    setVideoLoading(true);

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    try {
      const originalM3u8Url = await removeAds(currentEpisode.link_m3u8);

      if (Hls.isSupported()) {
        const hls = new Hls({
            // Các tùy chọn HLS.js để cải thiện buffering và phục hồi lỗi
            maxBufferLength: 60, // Tăng buffer lên 60 giây
            maxMaxBufferLength: 120, // Tối đa 120 giây
            maxBufferSize: 100 * 1000 * 1000, // Tối đa 100MB
            startFragPrefetch: true, // Tải trước fragment tiếp theo
            enableWorker: true, // Sử dụng web worker để parsing
        });
        hlsInstanceRef.current = hls;
        hls.loadSource(originalM3u8Url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setVideoLoading(false);

          // Lấy vị trí đã lưu từ localStorage
          const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
          const savedTime = parseFloat(localStorage.getItem(savedPositionKey));

          if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
            video.currentTime = savedTime;
            // Loại bỏ console.log
          } else {
            video.currentTime = 0; // Bắt đầu từ đầu nếu không có vị trí hợp lệ
          }

          video.play().catch(error => {
            // Loại bỏ console.warn
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          // Loại bỏ console.error
          setVideoLoading(false);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // Loại bỏ console.error
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                // Loại bỏ console.error
                hls.recoverMediaError();
                break;
              default:
                // Loại bỏ console.error
                hls.destroy();
                break;
            }
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = originalM3u8Url;

        // Lấy vị trí đã lưu từ localStorage cho trình duyệt hỗ trợ HLS native
        const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
        const savedTime = parseFloat(localStorage.getItem(savedPositionKey));

        video.onloadedmetadata = () => { // Đảm bảo metadata đã tải trước khi set currentTime
            if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
                video.currentTime = savedTime;
                // Loại bỏ console.log
            } else {
                video.currentTime = 0;
            }
            setVideoLoading(false);
            video.play().catch(error => {
                // Loại bỏ console.warn
            });
        };
      } else {
        // Loại bỏ console.error
        setVideoLoading(false);
      }
    } catch (error) {
      // Loại bỏ console.error
      setVideoLoading(false);
    }
  }, [currentEpisode, showMovieInfoPanel, getPlaybackPositionKey]);

  useEffect(() => {
    loadVideo();
    return () => {
      // Lưu vị trí video trước khi unmount hoặc tải tập mới
      savePlaybackPosition();
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, [currentEpisode, loadVideo, savePlaybackPosition]);

  // NEW EFFECT: Handle page visibility for video playback and saving position
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Listener để lưu vị trí khi video tạm dừng
    const handleVideoPause = () => {
        savePlaybackPosition();
    };

    // Listener để cập nhật vị trí thường xuyên khi đang phát
    const handleTimeUpdate = () => {
        currentPlaybackPositionRef.current = video.currentTime; // Lưu vào ref để dùng khi đóng đột ngột
    };

    video.addEventListener('pause', handleVideoPause);
    video.addEventListener('timeupdate', handleTimeUpdate);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab chuyển sang background
        if (!video.paused) {
          video.pause();
          // Loại bỏ console.log
        }
        // Lưu vị trí ngay lập tức khi chuyển sang background
        savePlaybackPosition();
      } else {
        // Tab chuyển sang foreground
        if (video.src && !showMovieInfoPanel) {
            // Cố gắng khắc phục lỗi buffer stalled trước khi play
            if (hlsInstanceRef.current && hlsInstanceRef.current.media && hlsInstanceRef.current.media.readyState < 4) {
                // Loại bỏ console.log
                hlsInstanceRef.current.recoverMediaError(); // Thử phục hồi lỗi
                hlsInstanceRef.current.startLoad(); // Đảm bảo quá trình tải tiếp tục
            }

            video.play().catch(error => {
                // Loại bỏ console.warn
            });
            // Loại bỏ console.log
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Rất quan trọng: loại bỏ các listeners để tránh memory leak
      video.removeEventListener('pause', handleVideoPause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [showMovieInfoPanel, savePlaybackPosition]);


  // handleServerChange: Chuyển server, cố gắng giữ tập hiện tại hoặc chọn tập đầu tiên của server mới.
  // Luôn hiển thị player.
  const handleServerChange = useCallback((index) => {
    if (episodes.length === 0) return;

    // Lưu vị trí đang xem của tập phim hiện tại trước khi chuyển server
    savePlaybackPosition();

    setSelectedServer(index);
    setShowMovieInfoPanel(false);

    const newServerData = episodes[index]?.server_data;
    let targetEpisode = null;

    if (newServerData && newServerData.length > 0) {
      // Tìm tập phim có slug tương ứng trên server mới
      targetEpisode = newServerData.find(ep => ep.slug === currentEpisode?.slug);
      if (!targetEpisode) {
        // Nếu không tìm thấy, chuyển sang tập đầu tiên của server mới
        targetEpisode = newServerData[0];
        // Loại bỏ console.log
      }
      setCurrentEpisode(targetEpisode);
      navigate(`/movie/${slug}/${targetEpisode.slug}`, { replace: true });
    } else {
      setCurrentEpisode(null);
      // Loại bỏ console.warn
      navigate(`/movie/${slug}`, { replace: true });
    }
  }, [slug, navigate, episodes, currentEpisode, savePlaybackPosition]);


  // handleEpisodeSelect: Chọn một tập cụ thể. Luôn hiển thị player.
  const handleEpisodeSelect = useCallback((episode) => {
    // Lưu vị trí đang xem của tập phim hiện tại trước khi chuyển tập
    savePlaybackPosition();

    setCurrentEpisode(episode);
    setShowMovieInfoPanel(false);
    navigate(`/movie/${slug}/${episode.slug}`);
  }, [slug, navigate, savePlaybackPosition]);


  // Các hàm tiện ích khác (giữ nguyên)
  const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
      return url;
    }
    // Sử dụng CDN_IMAGE_URL từ .env
    return url ? `${CDN_IMAGE_URL}/${url}` : '/fallback-image.jpg';
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

  // Hàm định dạng thời gian từ giây sang HH:MM:SS (Giữ lại để có thể dùng cho debug nếu cần)
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s]
      .map(v => v < 10 ? '0' + v : v)
      .filter((v, i) => v !== '00' || i > 0 || h > 0) // Hide hours if 00
      .join(':');
  };

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
      <h1 className="movie-title">
        {movie.name}
        {currentEpisode && ` - ${currentEpisode.name || 'Tập phim'}`}
      </h1>
      <div className="movie-detail">
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
        ) : (
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
            <button
              onClick={() => {
                setShowMovieInfoPanel(true);
                setCurrentEpisode(null);
                navigate(`/movie/${slug}`, { replace: true });
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
