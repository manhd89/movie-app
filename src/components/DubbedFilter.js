// src/components/DubbedFilter.js
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export const dubbedOptions = [
  { name: "Thuyết Minh", slug: "phim-thuyet-minh" },
  { name: "Lồng Tiếng", slug: "phim-long-tieng" },
];

function DubbedFilter() {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const currentDubbed = searchParams.get("dubbed") || "";

  const [selectedDubbedState, setSelectedDubbedState] = useState(currentDubbed);

  useEffect(() => {
    setSelectedDubbedState(currentDubbed);
  }, [currentDubbed]);

  const handleDubbedChange = (e) => {
    const newDubbedSlug = e.target.value;
    setSelectedDubbedState(newDubbedSlug);

    const params = new URLSearchParams(location.search);
    if (newDubbedSlug) {
      params.set("dubbed", newDubbedSlug);
    } else {
      params.delete("dubbed");
    }
    params.delete("page");

    navigate(`?${params.toString()}`);
  };

  return (
    <div className="filter-item">
      <label htmlFor="dubbed" className="filter-label">
        Lồng Tiếng:
      </label>
      <select
        id="dubbed"
        value={selectedDubbedState}
        onChange={handleDubbedChange}
        className="filter-select-element"
      >
        <option value="">Tất cả</option>
        {dubbedOptions.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default DubbedFilter;
