// src/components/CountryFilter.js
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export const countries = [
  { name: "Ả Rập Xê-út", slug: "a-rap-xe-ut" },
  { name: "Âu Mỹ", slug: "au-my" },
  { name: "Anh", slug: "anh" },
  { name: "Ấn Độ", slug: "an-do" },
  { name: "Ba Lan", slug: "ba-lan" },
  { name: "Bồ Đào Nha", slug: "bo-dao-nha" },
  { name: "Brazil", slug: "brazil" },
  { name: "Canada", slug: "canada" },
  { name: "Châu Phi", slug: "chau-phi" },
  { name: "Đài Loan", slug: "dai-loan" },
  { name: "Đan Mạch", slug: "dan-mach" },
  { name: "Đức", slug: "duc" },
  { name: "Hà Lan", slug: "ha-lan" },
  { name: "Hàn Quốc", slug: "han-quoc" },
  { name: "Hồng Kông", slug: "hong-kong" },
  { name: "Indonesia", slug: "indonesia" },
  { name: "Malaysia", slug: "malaysia" },
  { name: "Mexico", slug: "mexico" },
  { name: "Na Uy", slug: "na-uy" },
  { name: "Nam Phi", slug: "nam-phi" },
  { name: "Nga", slug: "nga" },
  { name: "Nhật Bản", slug: "nhat-ban" },
  { name: "Philippines", slug: "philippines" },
  { name: "Pháp", slug: "phap" },
  { name: "Quốc gia khác", slug: "quoc-gia-khac" },
  { name: "Tây Ban Nha", slug: "tay-ban-nha" },
  { name: "Thái Lan", slug: "thai-lan" },
  { name: "Thổ Nhĩ Kỳ", slug: "tho-nhi-ky" },
  { name: "Thụy Điển", slug: "thuy-dien" },
  { name: "Thụy Sĩ", slug: "thuy-si" },
  { name: "Trung Quốc", slug: "trung-quoc" },
  { name: "UAE", slug: "uae" },
  { name: "Úc", slug: "uc" },
  { name: "Ukraina", slug: "ukraina" },
  { name: "Việt Nam", slug: "viet-nam" },
  { name: "Ý", slug: "y" },
].sort((a, b) => a.name.localeCompare(b.name, "vi"));

function CountryFilter() {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const currentCountry = searchParams.get("quoc-gia") || "";

  const [selectedCountryState, setSelectedCountryState] = useState(currentCountry);

  useEffect(() => {
    setSelectedCountryState(currentCountry);
  }, [currentCountry]);

  const handleCountryChange = (e) => {
    const newCountrySlug = e.target.value;
    setSelectedCountryState(newCountrySlug);

    const params = new URLSearchParams(location.search);
    if (newCountrySlug) {
      params.set("quoc-gia", newCountrySlug);
    } else {
      params.delete("quoc-gia");
    }
    params.delete("page");

    navigate(`?${params.toString()}`);
  };

  return (
    <div className="filter-item">
      <label htmlFor="country" className="filter-label">
        Quốc gia:
      </label>
      <select
        id="country"
        value={selectedCountryState}
        onChange={handleCountryChange}
        className="filter-select-element"
      >
        <option value="">Tất cả</option>
        {countries.map((country) => (
          <option key={country.slug} value={country.slug}>
            {country.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default CountryFilter;
