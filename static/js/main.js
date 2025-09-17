let hourlyChartInstance = null;

function showToast(message) {
  const el = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = message;
  const toast = new bootstrap.Toast(el);
  toast.show();
}

function setIcon(el, iconCode) {

  const map = {
    "01d": "☀️", "01n": "🌙",
    "02d": "⛅", "02n": "☁️",
    "03d": "☁️", "03n": "☁️",
    "04d": "☁️", "04n": "☁️",
    "09d": "🌧️", "09n": "🌧️",
    "10d": "🌦️", "10n": "🌧️",
    "11d": "⛈️", "11n": "⛈️",
    "13d": "❄️", "13n": "❄️",
    "50d": "🌫️", "50n": "🌫️"
  };
  el.textContent = map[iconCode] || "⛅";
}

function formatTime(ts, tzOffsetSec) {
  
  const date = new Date((ts + tzOffsetSec) * 1000);
  return date.toLocaleString();
}

async function fetchJSON(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

async function loadByCity(city) {
  try {
    const current = await fetchJSON(`/api/weather?city=${encodeURIComponent(city)}`);
    renderCurrent(current.data);
    document.getElementById('saveCityBtn').disabled = false;

    const forecast = await fetchJSON(`/api/forecast?city=${encodeURIComponent(city)}`);
    renderForecast(forecast);

    
    sessionStorage.setItem('forecastData', JSON.stringify(forecast));
  } catch (e) {
    showToast(e.message);
  }
}

async function loadByCoords(lat, lon) {
  try {
    const current = await fetchJSON(`/api/weather_by_coords?lat=${lat}&lon=${lon}`);
    renderCurrent(current.data);
    document.getElementById('saveCityBtn').disabled = false;

    const city = current.data.city;
    const forecast = await fetchJSON(`/api/forecast?city=${encodeURIComponent(city)}`);
    renderForecast(forecast);

    
    sessionStorage.setItem('forecastData', JSON.stringify(forecast));
  } catch (e) {
    showToast(e.message);
  }
}

function renderCurrent(d) {
  document.getElementById('cwCity').textContent = d.city || '—';
  document.getElementById('cwCountry').textContent = d.country ? `(${d.country})` : '';
  document.getElementById('cwTemp').textContent = Math.round(d.temp ?? 0);
  document.getElementById('cwDesc').textContent = d.weather_desc ?? '—';
  document.getElementById('cwHumidity').textContent = d.humidity ?? '—';
  document.getElementById('cwWind').textContent = d.wind_speed ?? '—';

  setIcon(document.getElementById('cwIcon'), d.icon);

  
  sessionStorage.setItem('currentCity', d.city || '');
  sessionStorage.setItem('currentTemp', d.temp ?? 0); 
  sessionStorage.setItem('currentWeather', d.weather_desc ?? '—');
}

function renderForecast(f) {
  
  const labels = f.hourly.map(i => new Date((i.dt + f.timezone) * 1000).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}));
  const temps = f.hourly.map(i => i.temp);

  const ctx = document.getElementById('hourlyChart').getContext('2d');
  if (hourlyChartInstance) {
    hourlyChartInstance.destroy();
  }
  hourlyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Temp (°C)',
        data: temps,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: { title: { display: true, text: 'Time' } },
        y: { title: { display: true, text: '°C' } }
      }
    }
  });

  
  const grid = document.getElementById('forecastGrid');
  grid.innerHTML = '';
  f.daily.forEach(day => {
    const date = new Date(day.day + 'T00:00:00');
    const el = document.createElement('div');
    el.className = 'col-6 col-md-4 col-lg-2';
    el.innerHTML = `
      <div class="card card-forecast h-100">
        <div class="card-body text-center">
          <div class="fw-semibold">${date.toLocaleDateString()}</div>
          <div class="fs-1 my-2">${iconToEmoji(day.icon)}</div>
          <div><span class="fw-bold">${Math.round(day.max ?? 0)}°</span> / <span class="text-muted">${Math.round(day.min ?? 0)}°</span></div>
        </div>
      </div>
    `;
    grid.appendChild(el);
  });
}

function iconToEmoji(code) {
  const map = {
    "01d": "☀️", "01n": "🌙",
    "02d": "⛅", "02n": "☁️",
    "03d": "☁️", "03n": "☁️",
    "04d": "☁️", "04n": "☁️",
    "09d": "🌧️", "09n": "🌧️",
    "10d": "🌦️", "10n": "🌧️",
    "11d": "⛈️", "11n": "⛈️",
    "13d": "❄️", "13n": "❄️",
    "50d": "🌫️", "50n": "🌫️"
  };
  return map[code] || "⛅";
}

function applyTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-bs-theme', theme);
}
function toggleTheme() {
  const current = localStorage.getItem('theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', next);
  applyTheme();

  const themeToggle = document.getElementById('themeToggle');
  if (next === 'dark') {
    themeToggle.textContent = '🌙';
  } else {
    themeToggle.textContent = '☀️';
  }
}

function getSavedCities() {
  try {
    return JSON.parse(localStorage.getItem('savedCities') || '[]');
  } catch { return []; }
}
function saveCity(city) {
  const arr = getSavedCities();
  if (!arr.includes(city)) {
    arr.push(city);
    localStorage.setItem('savedCities', JSON.stringify(arr));
  }
  renderSavedCities();
}
function renderSavedCities() {
  const wrap = document.getElementById('savedCities');
  wrap.innerHTML = '';
  const cities = getSavedCities();
  if (cities.length === 0) {
    wrap.innerHTML = '<span class="text-muted">No saved cities yet.</span>';
    return;
  }
  cities.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-outline-secondary';
    btn.textContent = c;
    btn.addEventListener('click', () => loadByCity(c));
    wrap.appendChild(btn);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  renderSavedCities();

  const themeToggle = document.getElementById('themeToggle');
  
  if (localStorage.getItem('theme') === 'dark') {
    themeToggle.textContent = '🌙';
  } else {
    themeToggle.textContent = '☀️';
  }

  themeToggle.addEventListener('click', toggleTheme);

  document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const city = document.getElementById('cityInput').value.trim();
    if (city) loadByCity(city);
  });

  document.getElementById('locBtn').addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        loadByCoords(latitude, longitude);
      },
      (err) => showToast(err.message || 'Unable to get location'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  document.getElementById('saveCityBtn').addEventListener('click', () => {
    const city = sessionStorage.getItem('currentCity') || '';
    if (city) saveCity(city);
  });

  
  const adviceBtn = document.getElementById('checkAdviceBtn');
  if (adviceBtn) {
    adviceBtn.addEventListener('click', () => {
      const purpose = document.getElementById('travelPurpose').value;
      const adviceBox = document.getElementById('travelAdvice');
      const temp = parseFloat(sessionStorage.getItem('currentTemp') || 0);
      const weather = (sessionStorage.getItem('currentWeather') || '').toLowerCase();
      const forecast = JSON.parse(sessionStorage.getItem('forecastData') || '{}');

      if (!purpose) {
        adviceBox.textContent = "Please select a travel purpose.";
        return;
      }

      if (!forecast.daily) {
        adviceBox.textContent = "Please search a city first.";
        return;
      }

      let message = "";

      
      if (temp < 5) {
        message = "Too cold for most outdoor activities.";
      } else if (temp > 35) {
        message = "Too hot, better to avoid outdoor travel.";
      } else if (weather.includes("rain") || weather.includes("storm")) {
        message = "Not a great time due to rain/storm.";
      } else {
        message = "Good weather for your travel!";
      }

      
      const betterDays = forecast.daily.filter(day => {
        return day.max >= 20 && day.max <= 32 && !["🌧️", "⛈️"].includes(iconToEmoji(day.icon));
      }).map(day => day.day);

      if (message.includes("Not") || message.includes("Too")) {
        if (betterDays.length > 0) {
          message += ` Ideal days ahead: ${betterDays.join(", ")}`;
        }
      }

      adviceBox.textContent = message;
    });
  }
});
