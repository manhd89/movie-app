import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Hls from 'hls.js';
import { FaArrowLeft, FaRegPlayCircle, FaHistory, FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaExpand, FaCompress, FaFastForward, FaRewind } from 'react-icons/fa';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

// Ad-blocking CSS (giữ nguyên)
const adBlockCSS = `
  .bg-opacity-40.bg-white.w-full.text-center.space-x-2.bottom-0.absolute {
    display: none !important;
  }
`;

async function removeAds(playlistUrl) {
  // Logic removeAds của bạn (nếu có Service Worker, phần này có thể không cần thiết hoặc chỉ là fallback)
  return playlistUrl;
}

const PLAYBACK_SAVE_THRESHOLD_SECONDS = 5;
const LAST_PLAYED_KEY_PREFIX = 'lastPlayedPosition-';
const WATCH_HISTORY_KEY = 'watchHistory';
const SAVE_INTERVAL_SECONDS = 10; // Save playback position every 10 seconds

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
  const currentPlaybackPositionRef = useRef(0);
  const [lastViewedPosition, setLastViewedPosition] = useState(0);
  const [lastViewedEpisodeInfo, setLastViewedEpisodeInfo] = useState(null);
  const saveIntervalRef = useRef(null); // Ref for the interval timer

  // NEW PLAYER STATES AND REFS
  const playerContainerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const lastTap = useRef(0);
  const tapTimeout = useRef(null);
  const [showRewindOverlay, setShowRewindOverlay] = useState(false);
  const [showForwardOverlay, setShowForwardOverlay] = useState(false);
  const rewindOverlayTimeoutRef = useRef(null);
  const forwardOverlayTimeoutRef = useRef(null);

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


  const savePlaybackPosition = useCallback(() => {
    const video = videoRef.current;
    if (video && currentEpisode && video.currentTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
      const key = getPlaybackPositionKey(currentEpisode.slug);
      localStorage.setItem(key, video.currentTime.toString());
      console.log(`Saved playback position for ${currentEpisode.name}: ${video.currentTime}s`);

      if (movie) {
        saveMovieToHistory(movie, currentEpisode, video.currentTime);
      }
    }
  }, [currentEpisode, getPlaybackPositionKey, movie, saveMovieToHistory]);


  const loadVideo = useCallback(async () => {
    const video = videoRef.current;
    if (showMovieInfoPanel || !currentEpisode?.link_m3u8 || !video) {
        setVideoLoading(false);
        setIsPlaying(false); // Stop playing state
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

    // Clear any existing interval before loading new video
    if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
    }

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    try {
      const originalM3u8Url = currentEpisode.link_m3u8;

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
          setDuration(video.duration);

          const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
          const savedTime = parseFloat(localStorage.getItem(savedPositionKey));

          if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
            video.currentTime = savedTime;
            console.log(`Restored playback position for ${currentEpisode.name}: ${savedTime}s`);
          } else {
            video.currentTime = 0;
          }

          video.play().then(() => setIsPlaying(true)).catch(error => {
            console.warn("Autoplay was prevented:", error);
            setIsPlaying(false);
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS.js error:', data);
          setVideoLoading(false);
          setIsPlaying(false);
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
            setDuration(video.duration);
            if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
                video.currentTime = savedTime;
                console.log(`Restored playback position (native) for ${currentEpisode.name}: ${savedTime}s`);
            } else {
                video.currentTime = 0;
            }
            setVideoLoading(false);
            video.play().then(() => setIsPlaying(true)).catch(error => {
                console.warn("Autoplay was prevented (native):", error);
                setIsPlaying(false);
            });
        };
      } else {
        console.error('Trình duyệt không hỗ trợ phát HLS. Vui lòng cập nhật.');
        setVideoLoading(false);
        setIsPlaying(false);
      }

      // Start periodic save when video is successfully loaded (or attempted to load)
      if (video) {
        saveIntervalRef.current = setInterval(() => {
          if (!video.paused) { // Only save if video is playing
            savePlaybackPosition();
          }
        }, SAVE_INTERVAL_SECONDS * 1000);
        console.log(`Started periodic save every ${SAVE_INTERVAL_SECONDS} seconds.`);
      }

    } catch (error) {
      console.error('Error loading video:', error);
      setVideoLoading(false);
      setIsPlaying(false);
    }
  }, [currentEpisode, showMovieInfoPanel, getPlaybackPositionKey, savePlaybackPosition]); // Add savePlaybackPosition to dependencies

  useEffect(() => {
    loadVideo();
    return () => {
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
      // Clear the interval when component unmounts or currentEpisode changes
      if (saveIntervalRef.current) {
          clearInterval(saveIntervalRef.current);
          saveIntervalRef.current = null;
          console.log("Cleared periodic save interval.");
      }
    };
  }, [currentEpisode, loadVideo, savePlaybackPosition]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoPlay = () => setIsPlaying(true);
    const handleVideoPause = () => {
        setIsPlaying(false);
        savePlaybackPosition();
    };
    const handleTimeUpdate = () => {
        setCurrentTime(video.currentTime);
        currentPlaybackPositionRef.current = video.currentTime;
    };
    const handleLoadedMetadata = () => {
        setDuration(video.duration);
    };
    const handleVolumeChange = () => {
        setVolume(video.volume);
        setIsMuted(video.muted);
    };

    video.addEventListener('play', handleVideoPlay);
    video.addEventListener('pause', handleVideoPause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('volumechange', handleVolumeChange);


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

            video.play().then(() => setIsPlaying(true)).catch(error => {
                console.warn("Autoplay was prevented on visibility change:", error);
                setIsPlaying(false);
            });
            console.log("Video attempted to play due to tab coming into foreground.");
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      video.removeEventListener('play', handleVideoPlay);
      video.removeEventListener('pause', handleVideoPause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [showMovieInfoPanel, savePlaybackPosition]);


  // NEW: Custom player functions
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (video) {
      if (video.paused || video.ended) {
        video.play();
      } else {
        video.pause();
      }
      setIsPlaying(!video.paused);
    }
  };

  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    if (video) {
      video.volume = e.target.value;
      setVolume(video.volume);
      setIsMuted(video.volume === 0);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
      if (!video.muted && video.volume === 0) { // If unmuted but volume is 0, set to a default
        video.volume = 0.5;
        setVolume(0.5);
      }
    }
  };

  const handleProgressChange = (e) => {
    const video = videoRef.current;
    if (video) {
      const newTime = (e.target.value / 100) * duration;
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return '00:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const toggleFullScreen = () => {
    const player = playerContainerRef.current;
    if (!player) return;

    if (!document.fullscreenElement) {
      if (player.requestFullscreen) {
        player.requestFullscreen();
      } else if (player.mozRequestFullScreen) { /* Firefox */
        player.mozRequestFullScreen();
      } else if (player.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        player.webkitRequestFullscreen();
      } else if (player.msRequestFullscreen) { /* IE/Edge */
        player.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) { /* Firefox */
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { /* IE/Edge */
        document.msExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
      // For mobile devices, automatically lock/unlock orientation
      if (document.fullscreenElement && screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(e => console.warn("Failed to lock orientation:", e));
      } else if (!document.fullscreenElement && screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Controls visibility
  const handleMouseMove = () => {
    if (!showControls) setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000); // Hide controls after 3 seconds of inactivity
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 1000); // Hide faster if mouse leaves
    }
  };

  const handleContainerClick = () => {
      setShowControls(prev => !prev);
      if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
      }
      if (!showControls) { // If controls were hidden and now shown, set timeout to hide again
          controlsTimeoutRef.current = setTimeout(() => {
              if (isPlaying) setShowControls(false);
          }, 3000);
      }
  };


  // Double Tap Seek Functionality
  const handleVideoTap = (e) => {
    const video = videoRef.current;
    if (!video) return;

    const currentTimeTap = new Date().getTime();
    const tapLength = currentTimeTap - lastTap.current;

    clearTimeout(tapTimeout.current);

    if (tapLength < 300 && tapLength > 0) {
      // Double tap detected
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const videoWidth = rect.width;
      const seekAmount = 10; // Seek 10 seconds

      if (clickX < videoWidth / 2) {
        // Double tap on left side (rewind)
        video.currentTime = Math.max(0, video.currentTime - seekAmount);
        setShowRewindOverlay(true);
        if (rewindOverlayTimeoutRef.current) clearTimeout(rewindOverlayTimeoutRef.current);
        rewindOverlayTimeoutRef.current = setTimeout(() => setShowRewindOverlay(false), 800);
      } else {
        // Double tap on right side (forward)
        video.currentTime = Math.min(video.duration, video.currentTime + seekAmount);
        setShowForwardOverlay(true);
        if (forwardOverlayTimeoutRef.current) clearTimeout(forwardOverlayTimeoutRef.current);
        forwardOverlayTimeoutRef.current = setTimeout(() => setShowForwardOverlay(false), 800);
      }
    } else {
      // Single tap or first tap, reset timeout for next potential double tap
      tapTimeout.current = setTimeout(() => {
        // If no second tap within 300ms, consider it a single tap to toggle controls
        handleContainerClick();
      }, 300);
    }
    lastTap.current = currentTimeTap;
  };


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


  const handleEpisodeSelect = useCallback((episode) => {
    savePlaybackPosition();

    setCurrentEpisode(episode);
    setShowMovieInfoPanel(false);
    navigate(`/movie/${slug}/${episode.slug}`);
  }, [slug, navigate, savePlaybackPosition]);

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
            <div
              className={`video-player-container ${isFullScreen ? 'fullscreen' : ''} ${showControls ? 'show-controls' : 'hide-controls'}`}
              ref={playerContainerRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleVideoTap} // Use touch start for double tap
              onClick={(e) => {
                  // Prevent click from propagating to container if it's from controls
                  if (e.target.closest('.player-controls')) return;
                  // handleContainerClick(); // Single tap handled by handleVideoTap's timeout
              }}
            >
              {videoLoading && (
                <div className="video-overlay-spinner">
                  <div className="spinner"></div>
                </div>
              )}

              {showRewindOverlay && (
                  <div className="seek-overlay rewind-overlay">
                      <FaRewind /> 10s
                  </div>
              )}
              {showForwardOverlay && (
                  <div className="seek-overlay forward-overlay">
                      <FaFastForward /> 10s
                  </div>
              )}

              {currentEpisode && isValidUrl(currentEpisode.link_m3u8) ? (
                <video
                  ref={videoRef}
                  width="100%"
                  height="100%"
                  aria-label={`Video player for ${currentEpisode.name || 'Tập phim'}`}
                  className={videoLoading ? 'hidden-video' : ''}
                  preload="auto" // Changed from 'metadata' for better HLS
                  playsInline // Important for mobile browsers
                  webkit-playsinline // For older iOS
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

              {/* Custom Controls */}
              {!videoLoading && currentEpisode && isValidUrl(currentEpisode.link_m3u8) && (
                <div className={`player-controls ${showControls ? 'visible' : 'hidden'}`}>
                  <div className="progress-bar-container">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={(currentTime / duration) * 100 || 0}
                      className="progress-bar"
                      onChange={handleProgressChange}
                      aria-label="Video progress"
                    />
                  </div>
                  <div className="controls-row">
                    <button onClick={togglePlayPause} className="control-button" aria-label={isPlaying ? 'Pause' : 'Play'}>
                      {isPlaying ? <FaPause /> : <FaPlay />}
                    </button>
                    <div className="volume-controls">
                      <button onClick={toggleMute} className="control-button" aria-label={isMuted ? 'Unmute' : 'Mute'}>
                        {isMuted || volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        className="volume-slider"
                        onChange={handleVolumeChange}
                        aria-label="Volume control"
                      />
                    </div>
                    <span className="time-display">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    <button onClick={toggleFullScreen} className="control-button fullscreen-button" aria-label={isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
                      {isFullScreen ? <FaCompress /> : <FaExpand />}
                    </button>
                  </div>
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
