// src/components/GenreFilter.js
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export const genres = [
  { name: "Âm Nhạc", slug: "am-nhac" },
  { name: "Bí Ẩn", slug: "bi-an" },
  { name: "Chiến Tranh", slug: "chien-tranh" },
  { name: "Chính Kịch", slug: "chinh-kich" },
  { name: "Cổ Trang", slug: "co-trang" },
  { name: "Gia Đình", slug: "gia-dinh" },
  { name: "Hài Hước", slug: "hai-huoc" },
  { name: "Hành Động", slug: "hanh-dong" },
  { name: "Hình Sự", slug: "hinh-su" },
  { name: "Học Đường", slug: "hoc-duong" },
  { name: "Khoa Học", slug: "khoa-hoc" },
  { name: "Kinh Dị", slug: "kinh-di" },
  { name: "Kinh Điển", slug: "kinh-dien" },
  { name: "Lịch Sử", slug: "lich-su" },
  { name: "Miền Tây", slug: "mien-tay" },
  { name: "Phiêu Lưu", slug: "phieu-luu" },
  { name: "Phim 18+", slug: "phim-18" },
  { name: "Tài Liệu", slug: "tai-lieu" },
  { name: "Tâm Lý", slug: "tam-ly" },
  { name: "Thần Thoại", slug: "than-thoai" },
  { name: "Thể Thao", slug: "the-thao" },
  { name: "Tình Cảm", slug: "tinh-cam" },
  { name: "Trẻ Em", slug: "tre-em" },
  { name: "Viễn Tưởng", slug: "vien-tuong" },
  { name: "Võ Thuật", slug: "vo-thuat" },
].sort((a, b) => a.name.localeCompare(b.name, "vi"));

function GenreFilter() {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const currentGenre = searchParams.get("the-loai") || "";

  const [selectedGenreState, setSelectedGenreState] = useState(currentGenre);

  useEffect(() => {
    setSelectedGenreState(currentGenre);
  }, [currentGenre]);

  const handleGenreChange = (e) => {
    const newGenreSlug = e.target.value;
    setSelectedGenreState(newGenreSlug);

    const params = new URLSearchParams(location.search);
    if (newGenreSlug) {
      params.set("the-loai", newGenreSlug);
    } else {
      params.delete("the-loai");
    }
    params.delete("page");

    navigate(`?${params.toString()}`);
  };

  return (
    <div className="filter-item">
      <label htmlFor="genre" className="filter-label">
        Thể loại:
      </label>
      <select
        id="genre"
        value={selectedGenreState}
        onChange={handleGenreChange}
        className="filter-select-element"
      >
        <option value="">Tất cả</option>
        {genres.map((genre) => (
          <option key={genre.slug} value={genre.slug}>
            {genre.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default GenreFilter;
