import React from "react";

function MovieCard({ movie }) {
  // Helper to clean image URLs
  const cleanImageUrl = (url) => {
    if (!url) return "https://via.placeholder.com/200x300";
    if (url.startsWith("https://")) return url;
    return `https://phimimg.com/${url}`;
  };

  const posterUrl = cleanImageUrl(movie.poster_url);
  const thumbUrl = cleanImageUrl(movie.thumb_url);

  console.log("MovieCard Image URLs:", { poster_url: posterUrl, thumb_url: thumbUrl }); // Debug: Log URLs

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
      <img
        src={posterUrl}
        alt={movie.name}
        className="w-full h-64 object-cover"
        onError={(e) => {
          if (e.target.src !== thumbUrl) {
            e.target.src = thumbUrl;
          } else {
            e.target.src = "https://via.placeholder.com/200x300";
          }
        }}
        loading="lazy"
      />
      <div className="p-4">
        <h3 className="text-xl font-semibold text-white truncate">{movie.name}</h3>
        <p className="text-gray-400">{movie.origin_name}</p>
        <p className="text-gray-400">
          {movie.type === "single" ? "Full" : movie.episode_current}
        </p>
        <p className="text-gray-400">{movie.year}</p>
        <p className="text-gray-400">
          {movie.quality} | {movie.lang}
        </p>
      </div>
    </div>
  );
}

export default MovieCard;
