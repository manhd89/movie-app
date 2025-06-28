// src/components/VideoPlayer.js
import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import shaka from 'shaka-player/dist/shaka-player.ui.js'; // Import UI module for default controls
import 'shaka-player/dist/controls.css'; // Import default Shaka Player UI CSS

const VideoPlayer = forwardRef(({ src, onPlaybackTimeUpdate, onLoaded, onPlay, onPause, onEnded, initialPlaybackTime }, ref) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const uiRef = useRef(null);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (videoRef.current) {
        videoRef.current.play().catch(error => console.warn("Autoplay was prevented by imperative handle:", error));
      }
    },
    pause: () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    },
    currentTime: videoRef.current ? videoRef.current.currentTime : 0,
    duration: videoRef.current ? videoRef.current.duration : 0,
    // You can expose more video properties/methods if needed
  }));

  const initPlayer = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    if (uiRef.current) {
        uiRef.current.destroy(); // Destroy existing UI
        uiRef.current = null;
    }

    const player = new shaka.Player(video);
    playerRef.current = player;

    // Optional: Configure player
    player.configure({
      streaming: {
        bufferingGoal: 60, // seconds of content to buffer ahead
        rebufferingGoal: 5, // seconds of content needed to start playback after a rebuffer
        bufferBehind: 30, // seconds of content to keep behind the playhead
      },
      abr: {
        enabled: true, // Enable Adaptive Bitrate Streaming
      },
    });

    // Attach Shaka Player UI
    const ui = new shaka.ui.Overlay(player, video, video.parentNode);
    uiRef.current = ui;
    ui.get -->().showBigPlayButton(true);

    player.addEventListener('error', (event) => {
      console.error('Shaka Error code:', event.detail.code, 'object:', event.detail.originalError);
      // You might want to display a user-friendly error message
    });

    video.addEventListener('timeupdate', () => {
      if (onPlaybackTimeUpdate) {
        onPlaybackTimeUpdate(video.currentTime);
      }
    });

    video.addEventListener('loadedmetadata', () => {
        if (initialPlaybackTime && initialPlaybackTime > 0) {
            video.currentTime = initialPlaybackTime;
            console.log(`Shaka Player: Restored playback to ${initialPlaybackTime}s`);
        }
        if (onLoaded) {
            onLoaded();
        }
    });

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    try {
      await player.load(src);
      console.log('The video has been loaded by Shaka Player!');
      video.play().catch(error => {
        console.warn("Shaka Player Autoplay prevented:", error);
      });
    } catch (e) {
      console.error('Error loading video with Shaka Player:', e);
      if (onLoaded) { // Call onLoaded even on error to stop loading spinner
          onLoaded(true); // Pass true to indicate error
      }
    }
  }, [src, onPlaybackTimeUpdate, onLoaded, onPlay, onPause, onEnded, initialPlaybackTime]);

  useEffect(() => {
    if (src) {
      initPlayer();
    }

    return () => {
      // Clean up player when component unmounts or src changes
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      if (uiRef.current) {
          uiRef.current.destroy();
          uiRef.current = null;
      }
    };
  }, [src, initPlayer]);

  return (
    <div className="shaka-player-container">
      <video
        ref={videoRef}
        className="shaka-video"
        poster="/path/to/your/poster.jpg" // Optional: add a poster image
      />
    </div>
  );
});

export default VideoPlayer;
