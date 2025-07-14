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
    <div className="mb-6">
      <label htmlFor="year" className="text-lg font-semibold mr-2">
        Năm:
      </label>
      <select
        id="year"
        value={selectedYearState}
        onChange={handleYearChange}
        className="p-2 bg-gray-800 text-white rounded-md border-none focus:outline-none"
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
