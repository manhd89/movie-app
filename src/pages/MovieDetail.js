// src/pages/MovieDetail.js
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { FaArrowLeft, FaRegPlayCircle, FaHistory } from 'react-icons/fa';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

// Import the new VideoPlayer component
import VideoPlayer from '../components/VideoPlayer'; // Adjust the path if VideoPlayer.js is in a different directory

// Ad-blocking CSS (giữ nguyên)
const adBlockCSS = `
  .bg-opacity-40.bg-white.w-full.text-center.space-x-2.bottom-0.absolute {
    display: none !important;
  }
`;

const PLAYBACK_SAVE_THRESHOLD_SECONDS = 5;
const LAST_PLAYED_KEY_PREFIX = 'lastPlayedPosition-';
const WATCH_HISTORY_KEY = 'watchHistory';
const SAVE_INTERVAL_SECONDS = 10; // Save playback position every 10 seconds

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
  const currentPlaybackPositionRef = useRef(0); // This will still be updated by the VideoPlayer if needed for saving
  const [lastViewedPosition, setLastViewedPosition] = useState(0);
  const [lastViewedEpisodeInfo, setLastViewedEpisodeInfo] = useState(null);
  const saveIntervalRef = useRef(null); // Ref for the interval timer

  // State to pass to VideoPlayer
  const [videoPlayerOptions, setVideoPlayerOptions] = useState(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = adBlockCSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        setInitialLoading(true);
        const response = await axios.get(`/api/movie?slug=${slug}`, {
          timeout: 5000,
        });
        if (response.data && response.data.movie && response.data.episodes) {
          setMovie(response.data.movie);
          setEpisodes(response.data.episodes || []);
        } else if (response.data && response.data.item) {
          setMovie(response.data.item);
          setEpisodes(response.data.item.episodes || []);
        } else {
          console.error("Dữ liệu API không đúng định dạng:", response.data);
          setMovie(null);
          setEpisodes([]);
        }

        setInitialLoading(false);

        const history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
        const currentMovieHistory = history.find(item => item.slug === slug);
        if (currentMovieHistory) {
          setLastViewedPosition(currentMovieHistory.position);
          setLastViewedEpisodeInfo(currentMovieHistory.episode || null);
        } else {
          setLastViewedPosition(0);
          setLastViewedEpisodeInfo(null);
        }

      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu phim:', error);
        setInitialLoading(false);
      }
    };
    fetchMovieData();
  }, [slug]);

  useEffect(() => {
    if (movie && episodes.length > 0) {
      const validServerIndex = selectedServer < episodes.length ? selectedServer : 0;
      setSelectedServer(validServerIndex);

      const serverData = episodes[validServerIndex]?.server_data;

      if (!episodeSlug) {
        setShowMovieInfoPanel(true);
        setCurrentEpisode(null);
        setVideoPlayerOptions(null); // Clear video options if showing info panel
      } else {
        if (serverData && serverData.length > 0) {
          const episodeToLoad = serverData.find((ep) => ep.slug === episodeSlug);
          if (episodeToLoad) {
            setCurrentEpisode(episodeToLoad);
            setShowMovieInfoPanel(false);
            setVideoPlayerOptions({
              sources: [{ src: episodeToLoad.link_m3u8, type: 'application/x-mpegURL' }],
              poster: getImageUrl(movie.poster_url), // Pass movie poster as video poster
              slug: slug, // Pass slug and episode slug for playback saving
              episodeSlug: episodeToLoad.slug,
              playbackPosition: parseFloat(localStorage.getItem(getPlaybackPositionKey(episodeToLoad.slug))),
              savePlaybackPosition: (position) => {
                // Callback to save position from VideoPlayer
                currentPlaybackPositionRef.current = position;
                if (movie && episodeToLoad && position > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
                  localStorage.setItem(getPlaybackPositionKey(episodeToLoad.slug), position.toString());
                  saveMovieToHistory(movie, episodeToLoad, position);
                }
              }
            });
          } else {
            setCurrentEpisode(null);
            setShowMovieInfoPanel(true);
            setVideoPlayerOptions(null);
            navigate(`/movie/${slug}`, { replace: true });
          }
        } else {
          setCurrentEpisode(null);
          setShowMovieInfoPanel(true);
          setVideoPlayerOptions(null);
          navigate(`/movie/${slug}`, { replace: true });
        }
      }
    } else if (movie && episodes.length === 0) {
      setCurrentEpisode(null);
      setShowMovieInfoPanel(true);
      setVideoPlayerOptions(null);
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
    history = history.filter(item => item.slug !== movieData.slug);
    history.unshift(historyEntry);
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    console.log(`Saved movie to history: ${movieData.name} - ${episodeData.name} at ${position}s`);
  }, [episodes, selectedServer]);

  // Remove the old loadVideo and associated HLS.js logic.
  // The VideoPlayer component will handle this internally.

  // The interval for saving playback position will now be managed by the VideoPlayer
  // and it will call the savePlaybackPosition prop.

  // Remove the useEffect that manages the video element directly for HLS and native.
  // The VideoPlayer component will manage its own internal video element and HLS instance.

  const handleServerChange = useCallback((index) => {
    if (episodes.length === 0) return;

    // Save current playback position before changing server/episode
    if (currentEpisode && currentPlaybackPositionRef.current > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
        localStorage.setItem(getPlaybackPositionKey(currentEpisode.slug), currentPlaybackPositionRef.current.toString());
        saveMovieToHistory(movie, currentEpisode, currentPlaybackPositionRef.current);
    }

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
  }, [slug, navigate, episodes, currentEpisode, getPlaybackPositionKey, saveMovieToHistory, movie]);


  const handleEpisodeSelect = useCallback((episode) => {
    // Save current playback position before changing server/episode
    if (currentEpisode && currentPlaybackPositionRef.current > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
        localStorage.setItem(getPlaybackPositionKey(currentEpisode.slug), currentPlaybackPositionRef.current.toString());
        saveMovieToHistory(movie, currentEpisode, currentPlaybackPositionRef.current);
    }

    setCurrentEpisode(episode);
    setShowMovieInfoPanel(false);
    navigate(`/movie/${slug}/${episode.slug}`);
  }, [slug, navigate, currentEpisode, getPlaybackPositionKey, saveMovieToHistory, movie]);

  const handleContinueWatching = useCallback(() => {
    if (lastViewedEpisodeInfo && movie) {
      const serverIndex = episodes.findIndex(server => server.server_name === lastViewedEpisodeInfo.server_name);

      if (serverIndex !== -1) {
        setSelectedServer(serverIndex);
        const targetEpisode = episodes[serverIndex].server_data.find(ep => ep.slug === lastViewedEpisodeInfo.slug);
        if (targetEpisode) {
          setCurrentEpisode(targetEpisode);
          setShowMovieInfoPanel(false);
          navigate(`/movie/${movie.slug}/${targetEpisode.slug}`);
        } else {
          let foundOnOtherServer = false;
          for (let i = 0; i < episodes.length; i++) {
            const ep = episodes[i].server_data.find(epData => epData.slug === lastViewedEpisodeInfo.slug);
            if (ep) {
              setSelectedServer(i);
              setCurrentEpisode(ep);
              setShowMovieInfoPanel(false);
              navigate(`/movie/${movie.slug}/${ep.slug}`);
              foundOnOtherServer = true;
              break;
            }
          }
          if (!foundOnOtherServer) {
            console.warn("Episode not found on any server, showing movie info.");
            setCurrentEpisode(null);
            setShowMovieInfoPanel(true);
            navigate(`/movie/${movie.slug}`, { replace: true });
          }
        }
      } else {
        console.warn("Server not found, showing movie info.");
        setCurrentEpisode(null);
        setShowMovieInfoPanel(true);
        navigate(`/movie/${movie.slug}`, { replace: true });
      }
    } else {
      console.warn("No last viewed episode info, showing movie info.");
      setCurrentEpisode(null);
      setShowMovieInfoPanel(true);
      navigate(`/movie/${movie.slug}`, { replace: true });
    }
  }, [episodes, lastViewedEpisodeInfo, navigate, movie]);


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

  // isValidUrl is no longer directly used for video loading in MovieDetail,
  // but can be kept for other purposes if needed.
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
              {/* Use the VideoPlayer component here */}
              {videoPlayerOptions ? (
                <VideoPlayer options={videoPlayerOptions} />
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
                  <p>Không có nguồn video hoặc tập phim không khả dụng.</p>
                  <FaRegPlayCircle style={{ fontSize: '3rem', marginTop: '10px' }} />
                </div>
              )}
            </div>
            <button
              onClick={() => {
                // Save current playback position before going back to info panel
                if (currentEpisode && currentPlaybackPositionRef.current > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
                    localStorage.setItem(getPlaybackPositionKey(currentEpisode.slug), currentPlaybackPositionRef.current.toString());
                    saveMovieToHistory(movie, currentEpisode, currentPlaybackPositionRef.current);
                }
                setShowMovieInfoPanel(true);
                setCurrentEpisode(null);
                setVideoPlayerOptions(null); // Clear video options when returning to info panel
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
