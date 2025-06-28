// src/components/ShakaPlayerComponent.js
import React, { useRef, useEffect, useCallback, useState } from 'react';
import shaka from 'shaka-player/dist/shaka-player.compiled';

const ShakaPlayerComponent = ({ src, onTimeUpdate, onEnded, initialPlaybackPosition, onPlayerReady }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false);

  // Initialize Shaka Player
  const initPlayer = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    const player = new shaka.Player(video);
    playerRef.current = player;
    setIsPlayerInitialized(true);

    // Lắng nghe các sự kiện lỗi của Shaka Player
    player.addEventListener('error', (event) => {
      console.error('Shaka Error:', event.detail);
      // Xử lý lỗi, ví dụ: hiển thị thông báo cho người dùng
    });

    // Lắng nghe sự kiện timeupdate để báo cáo vị trí phát
    const handleTimeUpdate = () => {
      if (onTimeUpdate && video) {
        onTimeUpdate(video.currentTime);
      }
    };

    // Lắng nghe sự kiện ended
    const handleEnded = () => {
      if (onEnded) {
        onEnded();
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    // Cấu hình Shaka Player (tùy chọn)
    // Ví dụ: cấu hình bộ nhớ cache để làm việc với Service Worker
    player.configure({
      streaming: {
        bufferingGoal: 60,
        bufferBehind: 30,
        retryParameters: {
          maxAttempts: 5,
          baseDelay: 500,
          timeout: 30000,
          factor: 2,
        },
      },
      manifest: {
        retryParameters: {
          maxAttempts: 5,
          baseDelay: 500,
          timeout: 30000,
          factor: 2,
        },
      },
      // Thêm cấu hình cho DASH/HLS nếu cần
      // adaptif: { ... }
    });

    try {
      await player.load(src);
      console.log('Shaka Player loaded source:', src);

      if (initialPlaybackPosition && initialPlaybackPosition > 0) {
        video.currentTime = initialPlaybackPosition;
        console.log(`Restored Shaka playback position: ${initialPlaybackPosition}s`);
      }

      video.play().catch(error => {
        console.warn("Autoplay was prevented by Shaka Player:", error);
      });

      if (onPlayerReady) {
        onPlayerReady(player); // Pass the player instance to parent if needed
      }

    } catch (e) {
      console.error('Error loading Shaka Player source:', e);
      // Hiển thị thông báo lỗi trên UI
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [src, onTimeUpdate, onEnded, initialPlaybackPosition, onPlayerReady]);

  useEffect(() => {
    // Chỉ khởi tạo khi src thay đổi và không có trình phát nào đang chạy
    if (src && videoRef.current) {
      shaka.polyfill.installAll(); // Đảm bảo các polyfill cần thiết được cài đặt
      initPlayer();
    }
  }, [src, initPlayer]);

  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      width="100%"
      height="100%"
      className={!isPlayerInitialized ? 'hidden-video' : ''} // Hide until source is loaded
      aria-label="Video player"
      playsInline // Quan trọng cho iOS autoplay
    />
  );
};

export default ShakaPlayerComponent;
