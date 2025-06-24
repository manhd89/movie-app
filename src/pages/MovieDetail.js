import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Hls from 'hls.js';
import { Helmet } from 'react-helmet';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaArrowLeft, FaRegPlayCircle } from 'react-icons/fa'; // Import FaRegPlayCircle

import './MovieDetail.css';

// --- Constants ---
const BASE_API_URL = process.env.REACT_APP_API_URL;
const CDN_IMAGE_URL = process.env.REACT_APP_API_CDN_IMAGE;
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

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// Hàm để lấy key cho vị trí playback của từng tập phim
const getPlaybackPositionKey = (episodeSlug) => `playback_position_${episodeSlug}`;

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

// Hàm tiện ích: Cập nhật lịch sử xem
// Hàm này sẽ thêm hoặc cập nhật một mục phim trong lịch sử xem
const updateWatchHistory = (movieInfo, episodeInfo, currentTime) => {
  if (!movieInfo || !episodeInfo) return;

  // Lấy lịch sử hiện có từ localStorage
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

  // Tạo một đối tượng mục lịch sử mới
  const newItem = {
    movieSlug: movieInfo.slug,
    episodeSlug: episodeInfo.slug,
    poster_url: movieInfo.poster_url,
    name: movieInfo.name,
    episodeName: episodeInfo.name, // Thêm tên tập phim
    year: movieInfo.year,
    lastWatched: Date.now(), // Thời gian xem gần nhất
    playbackPosition: currentTime, // Vị trí xem hiện tại
  };

  // Kiểm tra xem phim/tập phim này đã có trong lịch sử chưa
  const existingIndex = history.findIndex(
    item => item.movieSlug === newItem.movieSlug && item.episodeSlug === newItem.episodeSlug
  );

  if (existingIndex > -1) {
    // Nếu đã có, cập nhật thông tin và đưa lên đầu danh sách
    history[existingIndex] = newItem;
    history = [history[existingIndex], ...history.slice(0, existingIndex), ...history.slice(existingIndex + 1)];
  } else {
    // Nếu chưa có, thêm vào đầu danh sách
    history.unshift(newItem);
  }

  // Giới hạn số lượng mục trong lịch sử
  history = history.slice(0, MAX_HISTORY_ITEMS);

  // Lưu lại vào localStorage
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  console.log(`Updated watch history for ${movieInfo.name} - ${episodeInfo.name || 'Tập phim'}`);
};


// Custom hook to detect if a component is unmounted
const useIsMounted = () => {
    const isMounted = useRef(false);
    useEffect(() => {
        isMounted.current = true;
        return () => (isMounted.current = false);
    }, []);
    return isMounted;
};

// Function to remove ads from M3U8 (simulated)
const removeAds = async (m3u8Url) => {
    // In a real scenario, this would involve server-side processing
    // or a more complex service worker logic to modify the M3U8 content.
    // For now, we'll just return the original URL, assuming the service worker handles it.
    return m3u8Url;
};

function MovieDetail() {
  const { slug, episodeSlug } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [currentServer, setCurrentServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const [showMovieInfoPanel, setShowMovieInfoPanel] = useState(true); // Control visibility of movie info vs player
  const videoRef = useRef(null);
  const hlsInstanceRef = useRef(null);
  const isMounted = useIsMounted();

  const handleEpisodeSelect = useCallback((episode, server) => {
    if (!episode || !server) {
        console.error("Episode or server is null/undefined during selection.");
        toast.error("Không thể chọn tập phim. Vui lòng thử lại.");
        return;
    }
    setCurrentEpisode(episode);
    setCurrentServer(server);
    setShowMovieInfoPanel(false); // Switch to player view
    // Update URL without reloading page
    navigate(`/movie/${slug}/${episode.slug}`, { replace: true });
    // Scroll to top of the video player section
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug, navigate]);

  const handleServerChange = useCallback((server) => {
    setCurrentServer(server);
    if (movie && movie.episodes[0] && movie.episodes[0].server_data) {
        // Find the first episode on the new server
        const firstEpisodeOnNewServer = movie.episodes[0].server_data.find(
            (ep) => ep.slug === server.slug
        )?.episodes[0];
        if (firstEpisodeOnNewServer) {
            handleEpisodeSelect(firstEpisodeOnNewServer, server);
        } else {
            console.warn(`No episodes found for server ${server.name}`);
            toast.warn(`Không tìm thấy tập phim nào trên server ${server.name}. Vui lòng chọn server khác.`);
            setCurrentEpisode(null); // Clear current episode if no episodes on new server
        }
    }
  }, [movie, handleEpisodeSelect]);


  const savePlaybackPosition = useCallback(() => {
    const video = videoRef.current;
    if (video && currentEpisode && movie) { // Đảm bảo movie object cũng có sẵn
      if (video.currentTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
        const key = getPlaybackPositionKey(currentEpisode.slug);
        localStorage.setItem(key, video.currentTime.toString());
        console.log(`Saved playback position for ${currentEpisode.name}: ${video.currentTime}s`);

        // GỌI HÀM CẬP NHẬT LỊCH SỬ XEM Ở ĐÂY
        updateWatchHistory(movie, currentEpisode, video.currentTime);
      } else {
        // Nếu xem ít hơn ngưỡng, có thể coi như chưa xem đáng kể, không cần lưu vị trí
        // updateWatchHistory(movie, currentEpisode, 0); // hoặc bỏ qua nếu không muốn lưu phim mới mở nhưng chưa xem
      }
    }
  }, [currentEpisode, movie]);


  // Effect for fetching movie details
  useEffect(() => {
    const fetchMovieDetails = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${BASE_API_URL}/api/movie/${slug}`, { timeout: 8000 });
        if (!isMounted.current) return; // Prevent state update if unmounted

        const movieData = response.data;
        setMovie(movieData);
        // Set SEO data
        if (movieData) {
          Helmet.rewind(); // Clear previous helmet data
          const seoTitle = `${movieData.name} - ${movieData.episode_current || 'Xem phim'} - PhimAPI`;
          const seoDescription = movieData.content || `Xem phim ${movieData.name} (${movieData.origin_name}) trực tuyến chất lượng cao tại PhimAPI.`;
          document.title = seoTitle;
          const metaDescription = document.querySelector('meta[name="description"]');
          if (metaDescription) {
            metaDescription.setAttribute('content', seoDescription);
          } else {
            const newMeta = document.createElement('meta');
            newMeta.name = 'description';
            newMeta.content = seoDescription;
            document.head.appendChild(newMeta);
          }
        }

        // Logic để xác định tập và server ban đầu
        if (movieData.episodes && movieData.episodes.length > 0) {
          const firstServer = movieData.episodes[0];
          setCurrentServer(firstServer);

          let initialEpisode = null;

          if (episodeSlug) {
            // Tìm tập phim dựa trên episodeSlug từ URL trong tất cả các server
            for (const serverData of movieData.episodes) {
              const foundEpisode = serverData.episodes.find(
                (ep) => ep.slug === episodeSlug
              );
              if (foundEpisode) {
                initialEpisode = foundEpisode;
                setCurrentServer(serverData); // Set server của tập tìm thấy
                break;
              }
            }
          }

          if (!initialEpisode) {
            // Nếu không có episodeSlug hoặc không tìm thấy, chọn tập đầu tiên của server đầu tiên
            initialEpisode = firstServer.episodes[0] || null;
            if (initialEpisode && initialEpisode.slug) {
                // Cập nhật URL nếu chuyển sang tập đầu tiên mặc định
                if (episodeSlug !== initialEpisode.slug) {
                    navigate(`/movie/${slug}/${initialEpisode.slug}`, { replace: true });
                }
            }
          }

          if (initialEpisode) {
            setCurrentEpisode(initialEpisode);
            setShowMovieInfoPanel(false); // Nếu có tập phim, hiển thị trình phát
          } else {
            setShowMovieInfoPanel(true); // Nếu không có tập phim, hiển thị thông tin phim
          }
        } else {
          setShowMovieInfoPanel(true); // No episodes, show movie info
        }
      } catch (error) {
        if (isMounted.current) {
          console.error('Error fetching movie details:', error);
          setMovie(null);
          // navigate('/404'); // Optional: redirect to a 404 page
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    fetchMovieDetails();

    // Cleanup function for HLS.js and event listeners
    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      // Remove event listener to prevent memory leaks
      if (videoRef.current) {
          videoRef.current.removeEventListener('timeupdate', savePlaybackPosition);
          videoRef.current.removeEventListener('pause', savePlaybackPosition);
          videoRef.current.removeEventListener('ended', savePlaybackPosition);
      }
      window.removeEventListener('beforeunload', savePlaybackPosition);
      window.removeEventListener('pagehide', savePlaybackPosition); // For mobile browsers
      window.removeEventListener('visibilitychange', savePlaybackPosition);
    };
  }, [slug, episodeSlug, navigate, isMounted, savePlaybackPosition]);


  // Effect for video playback and HLS.js setup
  const loadVideo = useCallback(async () => {
    const video = videoRef.current;
    if (showMovieInfoPanel || !currentEpisode?.link_m3u8 || !video) {
      setVideoLoading(false);
      if (video) {
        video.src = ''; // Clear video source
        video.removeAttribute('src'); // For good measure
        video.load(); // Reload the video element to clear any old stream
        video.classList.remove('has-saved-position'); // Remove class if no video
      }
      if (!showMovieInfoPanel && currentEpisode && !isValidUrl(currentEpisode.link_m3u8)) {
        console.error('Video không khả dụng cho tập này.');
        toast.error("Video không khả dụng cho tập này.");
      }
      return;
    }

    setVideoLoading(true);

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    // Add event listeners for saving playback position
    video.removeEventListener('timeupdate', savePlaybackPosition); // Remove old listener first
    video.removeEventListener('pause', savePlaybackPosition);
    video.removeEventListener('ended', savePlaybackPosition);
    window.removeEventListener('beforeunload', savePlaybackPosition);
    window.removeEventListener('pagehide', savePlaybackPosition);
    window.removeEventListener('visibilitychange', savePlaybackPosition);

    video.addEventListener('timeupdate', savePlaybackPosition);
    video.addEventListener('pause', savePlaybackPosition);
    video.addEventListener('ended', savePlaybackPosition); // Save on end too
    window.addEventListener('beforeunload', savePlaybackPosition); // For browser tab close
    window.addEventListener('pagehide', savePlaybackPosition); // For mobile browser back button/tab close
    window.addEventListener('visibilitychange', savePlaybackPosition); // For tab switching


    try {
      // The removeAds function here is just a placeholder.
      // The actual ad removal happens in the service worker for M3U8 requests.
      const processedM3u8Url = await removeAds(currentEpisode.link_m3u8);

      if (Hls.isSupported()) {
        const hls = new Hls({
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
            maxBufferSize: 100 * 1000 * 1000,
            startFragPrefetch: true,
            enableWorker: true,
        });
        hlsInstanceRef.current = hls;
        hls.loadSource(processedM3u8Url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setVideoLoading(false);

          // Lấy vị trí đã lưu từ localStorage
          const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
          const savedTime = parseFloat(localStorage.getItem(savedPositionKey));

          if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
            video.currentTime = savedTime;
            console.log(`Restored playback position for ${currentEpisode.name}: ${savedTime}s`);
            video.classList.add('has-saved-position'); // Thêm class để hiển thị nút "Tiếp tục xem"
          } else {
            video.currentTime = 0;
            video.classList.remove('has-saved-position');
          }

          video.play().catch(error => {
            console.warn("Autoplay was prevented:", error);
            // toast.info("Trình duyệt chặn tự động phát. Vui lòng bấm Play.");
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("HLS.js error:", data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                toast.error("Lỗi mạng khi tải video. Đang thử lại...");
                hls.recoverMediaError();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                toast.error("Lỗi trình phát video. Đang thử lại...");
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                toast.error("Đã xảy ra lỗi nghiêm trọng khi phát video. Vui lòng thử lại server khác.");
                setVideoLoading(false);
                break;
            }
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support for Safari/iOS
        video.src = processedM3u8Url;

        const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
        const savedTime = parseFloat(localStorage.getItem(savedPositionKey));

        video.onloadedmetadata = () => {
            if (isMounted.current) {
                setVideoLoading(false);
                if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
                    video.currentTime = savedTime;
                    console.log(`Restored playback position (native) for ${currentEpisode.name}: ${savedTime}s`);
                    video.classList.add('has-saved-position');
                } else {
                    video.currentTime = 0;
                    video.classList.remove('has-saved-position');
                }
                video.play().catch(error => console.warn("Autoplay was prevented (native):", error));
            }
        };
        video.onerror = (e) => {
            console.error("Native video error:", e);
            toast.error("Không thể phát video này. Vui lòng thử lại server khác.");
            setVideoLoading(false);
        };
      } else {
        console.error('Trình duyệt không hỗ trợ phát HLS. Vui lòng cập nhật.');
        toast.error('Trình duyệt của bạn không hỗ trợ phát video này. Vui lòng cập nhật trình duyệt.');
        setVideoLoading(false);
      }
    } catch (error) {
      console.error('Error loading video:', error);
      toast.error('Đã xảy ra lỗi khi tải video. Vui lòng thử lại.');
      setVideoLoading(false);
    }
  }, [currentEpisode, showMovieInfoPanel, savePlaybackPosition, isMounted]);


  useEffect(() => {
    if (!loading && movie && currentEpisode) {
        loadVideo();
    }
  }, [loading, movie, currentEpisode, loadVideo]); // Reload video when movie/episode data is ready

  if (loading) {
    return (
      <div className="container movie-detail-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="container movie-not-found">
        <p>Không tìm thấy phim này.</p>
        <button onClick={() => navigate('/')} className="back-to-home-button">Quay lại trang chủ</button>
      </div>
    );
  }

  const movieServerData = movie.episodes && movie.episodes.length > 0 ? movie.episodes[0].server_data : [];
  const currentEpisodesInServer = currentServer?.episodes || [];


  // Kiểm tra nếu có currentEpisode và videoRef.current có saved position
  const videoElement = videoRef.current;
  const hasSavedPosition = videoElement && currentEpisode && parseFloat(localStorage.getItem(getPlaybackPositionKey(currentEpisode.slug))) > PLAYBACK_SAVE_THRESHOLD_SECONDS;


  return (
    <div className="container">
      <Helmet>
        <title>{document.title}</title> {/* Lấy title đã set trong useEffect */}
        {/* Description meta tag được cập nhật trực tiếp trong useEffect */}
      </Helmet>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />

      <h1 className="movie-title">
        {movie.name}
        {currentEpisode && ` - ${currentEpisode.name || 'Tập phim'}`}
      </h1>

      <div className="movie-detail">
        {showMovieInfoPanel ? (
          <>
            <div className="movie-poster-large">
              <img src={getImageUrl(movie.poster_url)} alt={movie.name} onError={(e) => e.target.src = '/placeholder.jpg'} />
            </div>
            <div className="movie-info-panel">
              <p className="movie-original-name">{movie.origin_name}</p>
              <p><strong>Năm phát hành:</strong> {movie.year}</p>
              <p><strong>Quốc gia:</strong> {movie.country && movie.country.map(c => c.name).join(', ')}</p>
              <p><strong>Đạo diễn:</strong> {movie.director && movie.director.join(', ')}</p>
              <p><strong>Diễn viên:</strong> {movie.actor && movie.actor.join(', ')}</p>
              <p><strong>Thể loại:</strong> {movie.category && movie.category.map(c => c.name).join(', ')}</p>
              <p><strong>Thời lượng:</strong> {movie.time}</p>
              <p><strong>Số tập:</strong> {movie.episode_total}</p>
              <p><strong>Trạng thái:</strong> {movie.episode_current}</p>
              <div className="movie-content">
                <h3>Nội dung:</h3>
                <p>{movie.content}</p>
              </div>
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
            <div className="player-controls">
                <button
                    onClick={() => {
                        setShowMovieInfoPanel(true);
                        setCurrentEpisode(null); // Clear current episode when going back to info
                        // navigate(`/movie/${slug}`, { replace: true }); // No need to navigate if staying on same slug
                    }}
                    className="back-button"
                    aria-label="Quay lại thông tin phim"
                >
                    <FaArrowLeft className="icon" /> Quay lại thông tin phim
                </button>
                {/* Nút "Tiếp tục xem" */}
                {currentEpisode && hasSavedPosition && (
                    <button
                        onClick={() => {
                            const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
                            const savedTime = parseFloat(localStorage.getItem(savedPositionKey));
                            if (!isNaN(savedTime) && videoRef.current) {
                                videoRef.current.currentTime = savedTime;
                                videoRef.current.play().catch(error => console.warn("Autoplay prevented on continue watching:", error));
                                toast.success(`Tiếp tục xem từ ${formatTime(savedTime)}`);
                            } else {
                                // Fallback to start if somehow savedTime is invalid or 0
                                videoRef.current.currentTime = 0;
                                videoRef.current.play().catch(error => console.warn("Autoplay prevented on continue watching (start new):", error));
                            }
                        }}
                        className={`continue-watching-button`}
                        aria-label="Tiếp tục xem từ vị trí đã lưu"
                    >
                        <FaRegPlayCircle className="icon" /> Tiếp tục xem
                    </button>
                )}
            </div>
          </>
        )}
      </div>

      <div className="episode-selection">
        <h2 className="section-title">Chọn Server</h2>
        <div className="server-list">
          {movieServerData.map((server) => (
            <button
              key={server.server_name}
              className={`server-button ${currentServer && currentServer.server_name === server.server_name ? 'active' : ''}`}
              onClick={() => handleServerChange(server)}
            >
              {server.server_name}
            </button>
          ))}
        </div>

        {currentServer && currentEpisodesInServer.length > 0 && (
          <>
            <h2 className="section-title">Danh sách tập phim ({currentServer.server_name})</h2>
            <div className="episode-list">
              {currentEpisodesInServer.map((episode) => (
                <button
                  key={episode.slug}
                  className={`episode-button ${currentEpisode && currentEpisode.slug === episode.slug ? 'active' : ''}`}
                  onClick={() => handleEpisodeSelect(episode, currentServer)}
                >
                  {episode.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MovieDetail;
