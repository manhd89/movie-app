import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Hls from 'hls.js';
import { FaArrowLeft, FaRegPlayCircle, FaHistory } from 'react-icons/fa';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

const PLAYBACK_SAVE_THRESHOLD_SECONDS = 5;
const LAST_PLAYED_KEY_PREFIX = 'lastPlayedPosition-';
const WATCH_HISTORY_KEY = 'watchHistory';
const SAVE_INTERVAL_SECONDS = 10;

function MovieDetail() {
  const { slug, episodeSlug } = useParams();
  const navigate = useNavigate();
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
  const currentPlaybackPositionRef = useRef(0);
  const [lastViewedPosition, setLastViewedPosition] = useState(0);
  const [lastViewedEpisodeInfo, setLastViewedEpisodeInfo] = useState(null);
  const saveIntervalRef = useRef(null);

  useEffect(() => {
    const fetchMovieData = async () => {
      setInitialLoading(true);
      try {
        const response = await axios.get(`/api/movie?slug=${slug}`);
        setMovie(response.data.movie);
        setEpisodes(response.data.episodes);
      } catch (error) {
        console.error("Error fetching movie data:", error);
        // Có thể thêm logic để hiển thị thông báo lỗi cho người dùng
      } finally {
        setInitialLoading(false);
      }

      const history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
      const currentMovieHistory = history.find(item => item.slug === slug);
      if (currentMovieHistory) {
        setLastViewedPosition(currentMovieHistory.position);
        setLastViewedEpisodeInfo(currentMovieHistory.episode || null);
      }
    };
    fetchMovieData();
  }, [slug]);

  useEffect(() => {
    if (movie && episodes.length > 0) {
      const validServerIndex = selectedServer < episodes.length ? selectedServer : 0;
      setSelectedServer(validServerIndex);

      const serverData = episodes[validServerIndex].server_data;

      if (!episodeSlug) {
        setShowMovieInfoPanel(true);
        setCurrentEpisode(null);
      } else {
        const episodeToLoad = serverData.find((ep) => ep.slug === episodeSlug);
        if (episodeToLoad) {
          setCurrentEpisode(episodeToLoad);
          setShowMovieInfoPanel(false);
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

  useEffect(() => {
    localStorage.setItem(`selectedServer-${slug}`, selectedServer);
  }, [selectedServer, slug]);

  const getPlaybackPositionKey = useCallback((epSlug) => {
    return `${LAST_PLAYED_KEY_PREFIX}${slug}-${epSlug}`;
  }, [slug]);

  const saveMovieToHistory = useCallback((movieData, episodeData, position) => {
    if (!movieData || !episodeData || position < PLAYBACK_SAVE_THRESHOLD_SECONDS) return;

    const historyEntry = {
      slug: movieData.slug,
      name: movieData.name,
      origin_name: movieData.origin_name,
      poster_url: movieData.poster_url,
      year: movieData.year,
      quality: movieData.quality,
      episode_current: movieData.episode_current,
      episode: {
        slug: episodeData.slug,
        name: episodeData.name,
        server_name: episodes[selectedServer]?.server_name || 'N/A',
      },
      position: Math.floor(position),
      timestamp: Date.now(),
    };

    let history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
    history = history.filter(item => item.slug !== movieData.slug); // Remove old entry for this movie
    history.unshift(historyEntry); // Add new entry to the beginning
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history.slice(0, 20))); // Keep only the latest 20
  }, [episodes, selectedServer]);

  const savePlaybackPosition = useCallback(() => {
    const video = videoRef.current;
    if (video && currentEpisode && video.currentTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
      const key = getPlaybackPositionKey(currentEpisode.slug);
      localStorage.setItem(key, video.currentTime.toString());
      if (movie) {
        saveMovieToHistory(movie, currentEpisode, video.currentTime);
      }
    }
  }, [currentEpisode, getPlaybackPositionKey, movie, saveMovieToHistory]);

  const loadVideo = useCallback(() => {
    const video = videoRef.current;
    if (showMovieInfoPanel || !currentEpisode?.link_m3u8 || !video) {
      setVideoLoading(false);
      if (video) {
        // Clear video source when not playing or no M3U8 link
        video.src = '';
        video.removeAttribute('src');
        video.load();
      }
      return;
    }

    setVideoLoading(true);

    // Clear previous interval
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }

    // Destroy previous HLS instance
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    const originalM3u8Url = currentEpisode.link_m3u8;
    // Sử dụng proxy làm sạch M3U8 của bạn
    const proxiedM3u8Url = `/api/clean-m3u8?url=${encodeURIComponent(originalM3u8Url)}`;

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 100 * 1000 * 1000,
        startFragPrefetch: true,
        enableWorker: true,
      });
      hlsInstanceRef.current = hls;
      hls.loadSource(proxiedM3u8Url); // Tải nguồn từ URL proxy
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setVideoLoading(false);
        const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
        const savedTime = parseFloat(localStorage.getItem(savedPositionKey));
        if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
          video.currentTime = savedTime;
        } else {
          video.currentTime = 0;
        }
        video.play().catch(error => console.error("Error playing video:", error));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS Error:", data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("Media error, trying to recover");
              hls.recoverMediaError();
              break;
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error("Network error, trying to load again");
              // Tải lại video có thể giúp trong trường hợp lỗi mạng tạm thời
              loadVideo(); // Gọi lại loadVideo
              break;
            default:
              // Không thể phục hồi lỗi nghiêm trọng, hủy HLS
              hls.destroy();
              hlsInstanceRef.current = null;
              setVideoLoading(false);
              alert('Không thể tải video. Vui lòng thử lại sau.');
              break;
          }
        }
      });

    } else {
      // Fallback cho các trình duyệt không hỗ trợ HLS.js (native HLS)
      video.src = proxiedM3u8Url; // Sử dụng URL proxy
      video.onloadedmetadata = () => {
        const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
        const savedTime = parseFloat(localStorage.getItem(savedPositionKey));
        if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
          video.currentTime = savedTime;
        } else {
          video.currentTime = 0;
        }
        setVideoLoading(false);
        video.play().catch(error => console.error("Error playing video (native):", error));
      };
      video.onerror = (e) => {
        console.error("Video element error (native HLS):", e);
        setVideoLoading(false);
        alert('Không thể tải video. Vui lòng thử lại sau.');
      };
    }

    if (video) {
      saveIntervalRef.current = setInterval(() => {
        if (!video.paused) {
          savePlaybackPosition();
        }
      }, SAVE_INTERVAL_SECONDS * 1000);
    }
  }, [currentEpisode, showMovieInfoPanel, getPlaybackPositionKey, savePlaybackPosition]);

  useEffect(() => {
    const video = videoRef.current;
    loadVideo(); // Tải video khi currentEpisode thay đổi
    return () => {
      savePlaybackPosition(); // Lưu vị trí khi component unmount hoặc currentEpisode thay đổi
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      if (video) {
        // Clear video source to stop any ongoing downloads
        video.src = '';
        video.removeAttribute('src');
        video.load();
      }
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
    };
  }, [currentEpisode, loadVideo, savePlaybackPosition]); // Dependencies đảm bảo chạy lại khi episode thay đổi

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoPause = () => {
      savePlaybackPosition();
    };

    const handleTimeUpdate = () => {
      currentPlaybackPositionRef.current = video.currentTime;
    };

    video.addEventListener('pause', handleVideoPause);
    video.addEventListener('timeupdate', handleTimeUpdate);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tạm dừng video và lưu vị trí khi tab/cửa sổ không hoạt động
        if (!video.paused) {
          video.pause();
        }
        savePlaybackPosition();
      } else if (video.src && !showMovieInfoPanel) {
        // Tiếp tục phát video khi tab/cửa sổ trở lại hoạt động, nếu có nguồn video và không hiển thị thông tin phim
        video.play().catch(error => console.error("Error playing video on visibility change:", error));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      video.removeEventListener('pause', handleVideoPause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [showMovieInfoPanel, savePlaybackPosition]);

  const handleServerChange = useCallback((index) => {
    savePlaybackPosition(); // Lưu vị trí của tập hiện tại trước khi chuyển server
    setSelectedServer(index);
    setShowMovieInfoPanel(false);

    const newServerData = episodes[index].server_data;
    // Tìm tập hiện tại trong server mới, nếu không có thì chọn tập đầu tiên
    const targetEpisode = newServerData.find(ep => ep.slug === currentEpisode?.slug) || newServerData[0];
    setCurrentEpisode(targetEpisode);
    navigate(`/movie/${slug}/${targetEpisode.slug}`, { replace: true });
  }, [slug, navigate, episodes, currentEpisode, savePlaybackPosition]);

  const handleEpisodeSelect = useCallback((episode) => {
    savePlaybackPosition(); // Lưu vị trí của tập hiện tại trước khi chuyển tập
    setCurrentEpisode(episode);
    setShowMovieInfoPanel(false);
    navigate(`/movie/${slug}/${episode.slug}`);
  }, [slug, navigate, savePlaybackPosition]);

  const handleContinueWatching = useCallback(() => {
    const serverIndex = episodes.findIndex(server => server.server_name === lastViewedEpisodeInfo.server_name);
    if (serverIndex !== -1) {
      setSelectedServer(serverIndex);
      const targetEpisode = episodes[serverIndex].server_data.find(ep => ep.slug === lastViewedEpisodeInfo.slug);
      if (targetEpisode) {
        setCurrentEpisode(targetEpisode);
        setShowMovieInfoPanel(false);
        navigate(`/movie/${movie.slug}/${targetEpisode.slug}`);
      }
    } else {
      // Nếu server không còn tồn tại, chuyển đến tập đầu tiên của server mặc định
      console.warn("Last viewed server not found, defaulting to first episode of first server.");
      setSelectedServer(0);
      setCurrentEpisode(episodes[0].server_data[0]);
      setShowMovieInfoPanel(false);
      navigate(`/movie/${movie.slug}/${episodes[0].server_data[0].slug}`);
    }
  }, [episodes, lastViewedEpisodeInfo, navigate, movie]);

  const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
      return url;
    }
    // Sử dụng biến môi trường REACT_APP_API_CDN_IMAGE hoặc một URL fallback
    return url ? `${process.env.REACT_APP_API_CDN_IMAGE || ''}/${url}` : '/fallback-image.jpg';
  };

  const truncateDescription = (text, maxLength = 160) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, ''); // Loại bỏ các thẻ HTML
    return stripped.length > maxLength ? stripped.substring(0, maxLength) + '...' : stripped;
  };

  if (initialLoading) {
    return (
      <div className="container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="container">
        <p>Không tìm thấy thông tin phim hoặc có lỗi xảy ra.</p>
        <button onClick={() => navigate('/')} className="back-button">
          <FaArrowLeft className="icon" /> Quay lại trang chủ
        </button>
      </div>
    );
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
        {/* Thêm các thẻ meta khác cho SEO nếu cần */}
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
              <p className="movie-content-description"><strong>Nội dung:</strong> {movie.content || 'Không có mô tả.'}</p>
              {lastViewedPosition > PLAYBACK_SAVE_THRESHOLD_SECONDS && lastViewedEpisodeInfo && (
                <button
                  onClick={handleContinueWatching}
                  className="continue-watching-detail-button"
                  aria-label={`Tiếp tục xem ${lastViewedEpisodeInfo.name || 'Tập phim'}`}
                >
                  <FaHistory /> Tiếp tục xem{' '}
                  {lastViewedEpisodeInfo.name || `Tập cuối cùng`}
                  {' '}tại {Math.floor(lastViewedPosition / 60)} phút {Math.floor(lastViewedPosition % 60)} giây
                </button>
              )}
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
              <video
                ref={videoRef}
                controls
                width="100%"
                height="100%"
                aria-label={`Video player for ${currentEpisode?.name || 'Tập phim'}`}
                className={videoLoading ? 'hidden-video' : ''}
              />
            </div>
            <button
              onClick={() => {
                setShowMovieInfoPanel(true);
                setCurrentEpisode(null); // Clear current episode to go back to info state
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
            {episodes[selectedServer]?.server_data.map((ep, index) => (
              <button
                key={ep.slug}
                onClick={() => handleEpisodeSelect(ep)}
                className={`episode-button ${ep.slug === currentEpisode?.slug ? 'active' : ''}`}
                aria-label={`Xem ${ep.name || `Tập ${index + 1}`}`}
              >
                {ep.name || `Tập ${index + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}
      {episodes.length === 0 && !initialLoading && (
        <p className="no-episodes-message">Hiện tại chưa có tập phim nào.</p>
      )}
    </div>
  );
}

export default MovieDetail;
