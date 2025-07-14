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
    <div className="mb-6">
      <label htmlFor="type" className="text-lg font-semibold mr-2">
        Loại:
      </label>
      <select
        id="type"
        value={selectedTypeState}
        onChange={handleTypeChange}
        className="p-2 bg-gray-800 text-white rounded-md border-none focus:outline-none"
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
