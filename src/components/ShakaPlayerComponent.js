import React, { useRef, useEffect, useState, useCallback } from 'react';
import shaka from 'shaka-player/dist/shaka-player.ui'; // Import shaka player UI
import 'shaka-player/dist/controls.css'; // Import Shaka Player UI CSS

const PLAYBACK_SAVE_THRESHOLD_SECONDS = 5;
const SAVE_INTERVAL_SECONDS = 10;

function ShakaPlayerComponent({
  videoUrl,
  episodeSlug,
  movieSlug,
  onPlaybackPositionChange,
  onVideoLoaded,
  onVideoError,
}) {
  const videoRef = useRef(null);
  const uiRef = useRef(null); // Reference to the UI container div
  const playerRef = useRef(null);
  const saveIntervalRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const getPlaybackPositionKey = useCallback(() => {
    return `lastPlayedPosition-${movieSlug}-${episodeSlug}`;
  }, [movieSlug, episodeSlug]);

  const savePlaybackPosition = useCallback(() => {
    const video = videoRef.current;
    if (video && playerRef.current && video.currentTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
      const key = getPlaybackPositionKey();
      localStorage.setItem(key, video.currentTime.toString());
      onPlaybackPositionChange && onPlaybackPositionChange(video.currentTime);
    }
  }, [episodeSlug, getPlaybackPositionKey, onPlaybackPositionChange]);

  useEffect(() => {
    const video = videoRef.current;
    const uiElement = uiRef.current; // Get the actual DOM element for UI

    if (!video || !videoUrl || !uiElement) { // Ensure all refs are valid
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      setIsPlayerReady(false);
      return;
    }

    // Clear any existing player or interval
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }

    shaka.polyfill.installAll(); // Ensure polyfills are installed

    // Initialize Shaka Player
    const player = new shaka.Player(); // Create player instance
    playerRef.current = player;

    // Attach video element to player (using the recommended attach method)
    player.attach(video)
        .then(() => {
            console.log('Shaka Player attached to video element.');
        })
        .catch(error => {
            console.error('Shaka Player failed to attach to video element:', error);
            onVideoError && onVideoError(error);
            setIsPlayerReady(false);
            return; // Stop execution if attachment fails
        });

    // Initialize Shaka Player UI
    // The UI library will automatically find the video and UI div if correctly structured.
    // We just need to make sure the main container is marked with data-shaka-player-container
    // and the UI div with data-shaka-player-ui.
    new shaka.ui.Overlay(player, uiElement, video); // Pass uiElement directly

    player.addEventListener('error', (event) => {
      console.error('Shaka Error event:', event.detail);
      onVideoError && onVideoError(event.detail);
    });

    player.load(videoUrl)
      .then(() => {
        setIsPlayerReady(true);
        console.log('Shaka Player: The video has been loaded and is now playing!');

        const savedTime = parseFloat(localStorage.getItem(getPlaybackPositionKey()));
        if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
          video.currentTime = savedTime;
          console.log(`Restored playback position for ${episodeSlug}: ${savedTime}s`);
        } else {
          video.currentTime = 0;
        }

        // Attempt to play, but handle autoplay prevention
        video.play().catch(error => {
          if (error.name === "NotAllowedError") {
            console.warn("Autoplay was prevented by the browser. User must interact to play.");
          } else {
            console.warn("Autoplay failed:", error);
          }
        });

        onVideoLoaded && onVideoLoaded();

        saveIntervalRef.current = setInterval(() => {
          if (!video.paused) {
            savePlaybackPosition();
          }
        }, SAVE_INTERVAL_SECONDS * 1000);
      })
      .catch((error) => {
        console.error('Shaka Player: Error loading video', error);
        setIsPlayerReady(false);
        onVideoError && onVideoError(error);
      });

    const handleVideoPause = () => {
        savePlaybackPosition();
    };

    video.addEventListener('pause', handleVideoPause);

    return () => {
      savePlaybackPosition(); // Save on unmount
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
      video.removeEventListener('pause', handleVideoPause);
    };
  }, [videoUrl, episodeSlug, movieSlug, getPlaybackPositionKey, savePlaybackPosition, onVideoLoaded, onVideoError, onPlaybackPositionChange]);

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
        if (!video.paused) { // Attempt to resume if it was playing and not explicitly paused by user
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
  }, [savePlaybackPosition]);


  return (
    // The data-shaka-player-container attribute must be on the main container div
    // and data-shaka-player-ui on the div that holds the UI controls.
    <div data-shaka-player-container style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        autoPlay // Autoplay attribute helps Shaka, but browser policy still applies
        className="shaka-video-element"
      />
      <div data-shaka-player-ui ref={uiRef} className="shaka-player-ui" />
      {!isPlayerReady && (
        <div className="video-overlay-spinner">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
}

export default ShakaPlayerComponent;
