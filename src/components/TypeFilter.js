// src/components/TypeFilter.js
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export const types = [
  { name: "Phim Bộ", slug: "phim-bo" },
  { name: "Phim Lẻ", slug: "phim-le" },
  { name: "Phim Hoạt Hình", slug: "hoat-hinh" },
  { name: "TV Shows", slug: "tv-shows" },
];

function TypeFilter() {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const currentType = searchParams.get("type") || "";

  const [selectedTypeState, setSelectedTypeState] = useState(currentType);

  useEffect(() => {
    setSelectedTypeState(currentType);
  }, [currentType]);

  const handleTypeChange = (e) => {
    const newTypeSlug = e.target.value;
    setSelectedTypeState(newTypeSlug);

    const params = new URLSearchParams(location.search);
    if (newTypeSlug) {
      params.set("type", newTypeSlug);
    } else {
      params.delete("type");
    }
    params.delete("page");

    navigate(`?${params.toString()}`);
  };

  return (
    <div className="filter-item">
      <label htmlFor="type" className="filter-label">
        Loại:
      </label>
      <select
        id="type"
        value={selectedTypeState}
        onChange={handleTypeChange}
        className="filter-select-element"
      >
        <option value="">Tất cả</option>
        {types.map((type) => (
          <option key={type.slug} value={type.slug}>
            {type.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default TypeFilter;
