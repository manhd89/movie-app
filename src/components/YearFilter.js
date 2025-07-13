// src/components/YearFilter.js
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export const years = Array.from(
  { length: 2026 - 1990 },
  (_, i) => 2025 - i
);

function YearFilter() {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const currentYear = searchParams.get("nam") || "";

  const [selectedYearState, setSelectedYearState] = useState(currentYear);

  useEffect(() => {
    setSelectedYearState(currentYear);
  }, [currentYear]);

  const handleYearChange = (e) => {
    const newYear = e.target.value;
    setSelectedYearState(newYear);

    const params = new URLSearchParams(location.search);
    if (newYear) {
      params.set("nam", newYear);
    } else {
      params.delete("nam");
    }
    params.delete("page");

    navigate(`?${params.toString()}`);
  };

  return (
    <div className="filter-item"> {/* Class chung cho item filter */}
      <label htmlFor="year" className="filter-label">
        Năm:
      </label>
      <select
        id="year"
        value={selectedYearState}
        onChange={handleYearChange}
        className="filter-select-element" /* Class cho select box */
      >
        <option value="">Tất cả</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}

export default YearFilter;
