// src/components/FilterMenu.js
import React, { useCallback, useEffect, useState } from 'react';
import Select from 'react-select';
import { FaTimes } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import './FilterMenu.css';

const BASE_API_URL = process.env.REACT_APP_API_URL;

const customSelectStyles = {
  control: (provided) => ({
    ...provided,
    backgroundColor: '#333',
    borderColor: '#555',
    color: '#fff',
    boxShadow: 'none',
    '&:hover': { borderColor: '#007bff' }
  }),
  input: (provided) => ({ ...provided, color: '#fff' }),
  placeholder: (provided) => ({ ...provided, color: '#ccc' }),
  singleValue: (provided) => ({ ...provided, color: '#fff' }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused ? '#007bff' : '#333',
    color: '#fff',
    '&:active': { backgroundColor: '#0056b3' }
  }),
  menu: (provided) => ({ ...provided, backgroundColor: '#333' }),
  multiValue: (provided) => ({ ...provided, backgroundColor: '#007bff' }),
  multiValueLabel: (provided) => ({ ...provided, color: '#fff' }),
  multiValueRemove: (provided) => ({
    provided,
    color: '#fff',
    '&:hover': { backgroundColor: '#0056b3', color: '#fff' }
  })
};

function FilterMenu({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [genres, setGenres] = useState([]);
  const [countries, setCountries] = useState([]);

  // **THIS IS THE CRITICAL PART:**
  // Ensure 'currentYear' and 'years' are declared ONLY ONCE here
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1970 + 2 }, (_, i) => ({
    value: (currentYear + 1 - i).toString(),
    label: (currentYear + 1 - i).toString()
  }));

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [genreRes, countryRes] = await Promise.all([
          axios.get(`${BASE_API_URL}/the-loai`),
          axios.get(`${BASE_API_URL}/quoc-gia`)
        ]);
        setGenres(genreRes.data);
        setCountries(countryRes.data);
        localStorage.setItem('genres', JSON.stringify(genreRes.data));
        localStorage.setItem('countries', JSON.stringify(countryRes.data));
      } catch (error) {
        console.error('Error fetching filters for menu:', error);
      }
    };

    const cachedGenres = localStorage.getItem('genres');
    const cachedCountries = localStorage.getItem('countries');
    if (cachedGenres && cachedCountries) {
        setGenres(JSON.parse(cachedGenres));
        setCountries(JSON.parse(cachedCountries));
    } else {
        fetchInitialData();
    }
  }, []);

  const handleFilterChange = useCallback((type, selectedValue) => {
    const value = selectedValue ? selectedValue.value : '';
    const currentSearchParams = new URLSearchParams(window.location.search);
    const newSearchParams = new URLSearchParams();

    const keyword = currentSearchParams.get('keyword');
    if (keyword) newSearchParams.set('keyword', keyword);

    if (value) {
      newSearchParams.set(type, value);
    } else {
      newSearchParams.delete(type);
    }

    if (type === 'category') {
        newSearchParams.delete('country');
        newSearchParams.delete('year');
    } else if (type === 'country') {
        newSearchParams.delete('category');
        newSearchParams.delete('year');
    } else if (type === 'year') {
        newSearchParams.delete('category');
        newSearchParams.delete('country');
    }

    newSearchParams.set('page', '1');

    navigate(`/?${newSearchParams.toString()}`);
    onClose();
  }, [navigate, onClose]);

  const currentSearchParams = new URLSearchParams(window.location.search);
  const currentCategory = currentSearchParams.get('category') || '';
  const currentCountry = currentSearchParams.get('country') || '';
  // This 'currentYear' refers to the year from URL params, distinct from the year range 'years'
  const currentYearFromParams = currentSearchParams.get('year') || '';


  const handleNavLinkClick = useCallback((path, filterType, filterValue) => {
    if (filterType && filterValue) {
        handleFilterChange(filterType, { value: filterValue });
    } else {
        navigate(path);
        onClose();
    }
  }, [navigate, onClose, handleFilterChange]);

  return (
    <div className={`filter-menu-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="filter-menu-content" onClick={e => e.stopPropagation()}>
        <button className="close-menu-button" onClick={onClose} aria-label="Đóng menu">
          <FaTimes />
        </button>
        <h2 className="menu-title">Bộ Lọc Phim</h2>
        <div className="filter-container-menu">
          <Select
            options={[{ value: '', label: 'Tất cả thể loại' }, ...genres.map(g => ({ value: g.slug, label: g.name }))]}
            value={currentCategory ? { value: currentCategory, label: genres.find(g => g.slug === currentCategory)?.name || currentCategory } : { value: '', label: 'Tất cả thể loại' }}
            onChange={(selected) => handleFilterChange('category', selected)}
            placeholder="Chọn thể loại..."
            className="filter-select"
            styles={customSelectStyles}
            aria-label="Chọn thể loại phim"
          />
          <Select
            options={[{ value: '', label: 'Tất cả quốc gia' }, ...countries.map(c => ({ value: c.slug, label: c.name }))]}
            value={currentCountry ? { value: currentCountry, label: countries.find(c => c.slug === currentCountry)?.name || currentCountry } : { value: '', label: 'Tất cả quốc gia' }}
            onChange={(selected) => handleFilterChange('country', selected)}
            placeholder="Chọn quốc gia..."
            className="filter-select"
            styles={customSelectStyles}
            aria-label="Chọn quốc gia phim"
          />
          <Select
            options={[{ value: '', label: 'Tất cả năm' }, ...years]}
            value={currentYearFromParams ? { value: currentYearFromParams, label: currentYearFromParams } : { value: '', label: 'Tất cả năm' }}
            onChange={(selected) => handleFilterChange('year', selected)}
            placeholder="Chọn năm..."
            className="filter-select"
            styles={customSelectStyles}
            aria-label="Chọn năm phát hành"
          />
        </div>
      </div>
    </div>
  );
}

export default FilterMenu;
