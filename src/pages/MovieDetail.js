import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Hls from 'hls.js';
import { FaArrowLeft, FaRegPlayCircle } from 'react-icons/fa';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

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
const VIEWED_HISTORY_KEY = 'viewedHistory'; // KEY mới cho lịch sử xem

// Hàm định dạng thời gian từ giây sang HH:MM:SS (Giữ lại để có thể dùng cho console.log hoặc debug)
const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
      return [h, m, s]
          .map(v => v < 10 ? '0' + v : v)
          .join(':');
  }
  return [m, s]
      .map(v => v < 10 ? '0' + v : v)
      .join(':');
};

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
      console.log(`Saved playback position for ${currentEpisode.name}: ${video.currentTime}s`);

      // Cập nhật lastPosition trong lịch sử xem
      saveMovieToHistory();
    }
  }, [currentEpisode, getPlaybackPositionKey]);


  // Hàm để lưu thông tin phim vào lịch sử xem
  const saveMovieToHistory = useCallback(() => {
    if (!movie) return;

    let history = JSON.parse(localStorage.getItem(VIEWED_HISTORY_KEY) || '[]');

    const movieToSave = {
      slug: movie.slug,
      name: movie.name,
      origin_name: movie.origin_name,
      poster_url: movie.poster_url,
      year: movie.year,
    };

    // Cập nhật lastPosition nếu có từ localStorage
    const lastPositionKey = `${LAST_PLAYED_KEY_PREFIX}${movie.slug}-${currentEpisode?.slug || 'default'}`;
    movieToSave.lastPosition = parseFloat(localStorage.getItem(lastPositionKey)) || 0;

    // Lọc bỏ phim cũ nếu đã có trong lịch sử để đưa lên đầu
    history = history.filter(item => item.slug !== movie.slug);

    // Thêm phim mới vào đầu danh sách
    history.unshift(movieToSave);

    // Giới hạn số lượng phim trong lịch sử (ví dụ 20 phim)
    history = history.slice(0, 20);

    localStorage.setItem(VIEWED_HISTORY_KEY, JSON.stringify(history));
    console.log(`Movie '${movie.name}' saved/updated in history.`);
  }, [movie, currentEpisode]); // currentEpisode để đảm bảo lastPosition được cập nhật chính xác cho tập hiện tại


  // Effect 1: Fetch movie data. CHỈ chạy khi `slug` thay đổi.
  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        setInitialLoading(true);
        const response = await axios.get(`/api/movie?slug=${slug}`, {
          timeout: 5000,
        });
        setMovie(response.data.movie);
        setEpisodes(response.data.episodes || []);
        setInitialLoading(false);
      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu phim:', error);
        setInitialLoading(false);
      }
    };
    fetchMovieData();
  }, [slug]);

  // NEW EFFECT: Call saveMovieToHistory when movie data is available
  useEffect(() => {
    if (movie) {
      saveMovieToHistory();
    }
  }, [movie, saveMovieToHistory]); // `saveMovieToHistory` là một dependency


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
        if (!showMovieInfoPanel && currentEpisode && !isValidUrl(currentEpisode.link_m3u8)) {
            console.error('Video không khả dụng cho tập này.');
        }
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
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
            maxBufferSize: 100 * 1000 * 1000,
            startFragPrefetch: true,
            enableWorker: true,
        });
        hlsInstanceRef.current = hls;
        hls.loadSource(originalM3u8Url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setVideoLoading(false);

          const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
          const savedTime = parseFloat(localStorage.getItem(savedPositionKey));

          if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
            video.currentTime = savedTime;
            console.log(`Restored playback position for ${currentEpisode.name}: ${savedTime}s`);
          } else {
            video.currentTime = 0;
          }

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
                console.error('Lỗi mạng khi tải video. Vui lòng kiểm tra kết nối.');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Lỗi phát video. Có thể do định dạng không hỗ trợ.');
                hls.recoverMediaError();
                break;
              default:
                console.error('Lỗi video nghiêm trọng. Vui lòng thử tập khác.');
                hls.destroy();
                break;
            }
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = originalM3u8Url;

        const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
        const savedTime = parseFloat(localStorage.getItem(savedPositionKey));

        video.onloadedmetadata = () => {
            if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
                video.currentTime = savedTime;
                console.log(`Restored playback position (native) for ${currentEpisode.name}: ${savedTime}s`);
            } else {
                video.currentTime = 0;
            }
            setVideoLoading(false);
            video.play().catch(error => console.warn("Autoplay was prevented (native):", error));
        };
      } else {
        console.error('Trình duyệt không hỗ trợ phát HLS. Vui lòng cập nhật.');
        setVideoLoading(false);
      }
    } catch (error) {
      console.error('Error loading video:', error);
      setVideoLoading(false);
    }
  }, [currentEpisode, showMovieInfoPanel, getPlaybackPositionKey]);


  useEffect(() => {
    const video = videoRef.current;
    if (video) {
        // Gán listener timeupdate để lưu vị trí khi video đang chạy
        video.addEventListener('timeupdate', savePlaybackPosition);
        // Gán listener pause để lưu vị trí khi video tạm dừng
        video.addEventListener('pause', savePlaybackPosition);
    }

    loadVideo(); // Tải video khi currentEpisode thay đổi

    return () => {
      // Lưu vị trí video trước khi unmount hoặc tải tập mới
      savePlaybackPosition(); // Luôn lưu vị trí khi thoát khỏi tập/trang

      if (video) {
          // Xóa listeners để tránh memory leaks
          video.removeEventListener('timeupdate', savePlaybackPosition);
          video.removeEventListener('pause', savePlaybackPosition);
      }
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
  }, [currentEpisode, loadVideo, savePlaybackPosition]); // Dependencies đầy đủ


  // NEW EFFECT: Handle page visibility for video playback and saving position
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!video.paused) {
          video.pause();
          console.log("Video paused due to tab going into background.");
        }
        savePlaybackPosition();
      } else {
        if (video.src && !showMovieInfoPanel) {
            if (hlsInstanceRef.current && hlsInstanceRef.current.media && hlsInstanceRef.current.media.readyState < 4) {
                console.log("Attempting to recover HLS.js media error on foreground.");
                hlsInstanceRef.current.recoverMediaError();
                hlsInstanceRef.current.startLoad();
            }

            video.play().catch(error => {
                console.warn("Autoplay was prevented on visibility change:", error);
            });
            console.log("Video attempted to play due to tab coming into foreground.");
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showMovieInfoPanel, savePlaybackPosition]);


  // handleServerChange: Chuyển server, cố gắng giữ tập hiện tại hoặc chọn tập đầu tiên của server mới.
  // Luôn hiển thị player.
  const handleServerChange = useCallback((index) => {
    if (episodes.length === 0) return;

    savePlaybackPosition();

    setSelectedServer(index);
    setShowMovieInfoPanel(false);

    const newServerData = episodes[index]?.server_data;
    let targetEpisode = null;

    if (newServerData && newServerData.length > 0) {
      targetEpisode = newServerData.find(ep => ep.slug === currentEpisode?.slug);
      if (!targetEpisode) {
        targetEpisode = newServerData[0];
      }
      setCurrentEpisode(targetEpisode);
      navigate(`/movie/${slug}/${targetEpisode.slug}`, { replace: true });
    } else {
      setCurrentEpisode(null);
      navigate(`/movie/${slug}`, { replace: true });
    }
  }, [slug, navigate, episodes, currentEpisode, savePlaybackPosition]);


  // handleEpisodeSelect: Chọn một tập cụ thể. Luôn hiển thị player.
  const handleEpisodeSelect = useCallback((episode) => {
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

  // Lấy vị trí xem dở của phim hiện tại để hiển thị nút "Tiếp tục xem"
  // Lấy từ `viewedHistory` hoặc `localStorage` riêng lẻ cho tập đang hiển thị
  const lastPlayedPositionForCurrentMovie = parseFloat(localStorage.getItem(`${LAST_PLAYED_KEY_PREFIX}${movie.slug}-${currentEpisode?.slug || 'default'}`)) || 0;


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

      {/* NEW: Nút "Tiếp tục xem" trên trang chi tiết */}
      {showMovieInfoPanel && movie && lastPlayedPositionForCurrentMovie > PLAYBACK_SAVE_THRESHOLD_SECONDS && (
        <button
          onClick={() => {
            // Đảm bảo currentEpisode đã được set đúng hoặc tìm tập đầu tiên
            // để chuyển sang chế độ xem video
            if (currentEpisode) {
                setShowMovieInfoPanel(false);
                // navigate(`/movie/${slug}/${currentEpisode.slug}`); // Không cần navigate lại vì đã ở trang đúng
                // loadVideo() sẽ tự khôi phục vị trí
            } else if (episodes.length > 0 && episodes[selectedServer]?.server_data?.length > 0) {
                const firstEpisode = episodes[selectedServer].server_data[0];
                setCurrentEpisode(firstEpisode); // Set để load video
                setShowMovieInfoPanel(false);
                navigate(`/movie/${slug}/${firstEpisode.slug}`); // Điều hướng để URL cập nhật
            }
          }}
          className="continue-watching-detail-button"
        >
          <FaRegPlayCircle className="icon" /> Tiếp tục xem từ {formatTime(lastPlayedPositionForCurrentMovie)}
        </button>
      )}

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
