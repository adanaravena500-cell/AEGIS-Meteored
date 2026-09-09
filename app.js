// Configuración e Inicialización
document.addEventListener("DOMContentLoaded", () => {
  const currentYearEl = document.getElementById("currentYear");
  if (currentYearEl) currentYearEl.textContent = new Date().getFullYear();
  initApp();
});

let leafletMap = null;
let leafletMarker = null;
let currentLat = -34.9828;
let currentLon = -71.2394;
let currentDailyData = [];
let activeMapType = "windy";

const DEFAULT_LAT = -34.9828;
const DEFAULT_LON = -71.2394;
const DEFAULT_NAME = "Curicó, Región del Maule, Chile";

async function initApp() {
  setupMapSelector();
  setupEvents();
  renderMap(DEFAULT_LAT, DEFAULT_LON);

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const name = await reverseGeocode(latitude, longitude);
        loadWeatherData(latitude, longitude, name);
      },
      () => {
        loadWeatherData(DEFAULT_LAT, DEFAULT_LON, DEFAULT_NAME);
      },
    );
  } else {
    loadWeatherData(DEFAULT_LAT, DEFAULT_LON, DEFAULT_NAME);
  }
}

function setupMapSelector() {
  let selectorBar = document.getElementById("mapTypeBar");

  if (!selectorBar) {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    selectorBar = document.createElement("div");
    selectorBar.id = "mapTypeBar";
    mapContainer.parentNode.insertBefore(selectorBar, mapContainer);
  }

  selectorBar.style.cssText = `
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
    background: #1e293b;
    padding: 8px 12px;
    border-radius: 8px;
    align-items: center;
  `;

  selectorBar.innerHTML = `
    <span style="color: #fff; font-weight: bold; font-size: 0.9rem;">Vista del Mapa:</span>
    <button id="btnWindy" type="button" style="padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; background: #0284c7; color: white; font-weight: bold;">🌧️ Atmosférico (Windy)</button>
    <button id="btnLeaflet" type="button" style="padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; background: #334155; color: white; font-weight: bold;">🗺️ Estándar (Leaflet)</button>
  `;

  document
    .getElementById("btnWindy")
    .addEventListener("click", () => switchMapEngine("windy"));
  document
    .getElementById("btnLeaflet")
    .addEventListener("click", () => switchMapEngine("leaflet"));
}

function switchMapEngine(type) {
  activeMapType = type;
  const btnWindy = document.getElementById("btnWindy");
  const btnLeaflet = document.getElementById("btnLeaflet");

  if (type === "windy") {
    btnWindy.style.background = "#0284c7";
    btnLeaflet.style.background = "#334155";
  } else {
    btnWindy.style.background = "#334155";
    btnLeaflet.style.background = "#0284c7";
  }

  renderMap(currentLat, currentLon);
}

function renderMap(lat, lon) {
  currentLat = lat;
  currentLon = lon;
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

  if (activeMapType === "windy") {
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
      leafletMarker = null;
    }
    mapContainer.innerHTML = `
      <iframe 
        width="100%" 
        height="100%" 
        style="border:none; min-height: 480px; border-radius: 8px;"
        src="https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=650&height=450&zoom=5&level=surface&overlay=rain&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=true&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1"
        title="Mapamundi de Radares, Nubes e Isobaras">
      </iframe>
    `;
  } else {
    mapContainer.innerHTML = "";
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
    }

    leafletMap = L.map("map", { minZoom: 2, maxZoom: 18 }).setView(
      [lat, lon],
      6,
    );

    const osm = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
      },
    ).addTo(leafletMap);

    const cartoDark = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "© CARTO",
      },
    );

    leafletMarker = L.marker([lat, lon]).addTo(leafletMap);

    const baseMaps = {
      "Mapa Claro": osm,
      "Mapa Oscuro": cartoDark,
    };

    L.control.layers(baseMaps, null, { collapsed: false }).addTo(leafletMap);

    setTimeout(() => {
      if (leafletMap) leafletMap.invalidateSize();
    }, 200);
  }
}

function setupEvents() {
  const searchBtn = document.getElementById("searchBtn");
  const cityInput = document.getElementById("cityInput");
  const downloadPdfBtn = document.getElementById("downloadPdfBtn");

  if (searchBtn) searchBtn.addEventListener("click", () => handleSearch());
  if (cityInput) {
    cityInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleSearch();
    });
  }
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener("click", () => exportWeatherReportPDF());
  }
}

async function handleSearch() {
  const query = document.getElementById("cityInput").value.trim();
  if (!query) return;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
    );
    const data = await res.json();

    if (data && data.length > 0) {
      const { lat, lon, display_name } = data[0];
      loadWeatherData(parseFloat(lat), parseFloat(lon), display_name);
    } else {
      alert("No se encontró la ubicación solicitada.");
    }
  } catch (err) {
    console.error("Error en geocodificación:", err);
  }
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
    );
    const data = await res.json();
    return data.display_name || "Ubicación detectada";
  } catch {
    return "Ubicación detectada";
  }
}

async function loadWeatherData(lat, lon, locationName) {
  renderMap(lat, lon);

  const cityNameEl = document.getElementById("cityName");
  const breadcrumbEl = document.getElementById("breadcrumb");

  if (cityNameEl) cityNameEl.textContent = locationName.split(",")[0];
  if (breadcrumbEl)
    breadcrumbEl.textContent = `Inicio > Clima > ${locationName}`;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,weather_code,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();

    renderCurrentWeather(data.current);
    renderSunMoon(data.daily);

    currentDailyData = data;
    renderDailyForecast(data.daily);
    renderHourlyCarousel(0);
  } catch (err) {
    console.error("Error al obtener datos meteorológicos:", err);
  }
}

function renderCurrentWeather(current) {
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt("tempValue", Math.round(current.temperature_2m));
  setTxt("weatherDesc", getWeatherDescription(current.weather_code));
  setTxt("realFeel", `${Math.round(current.apparent_temperature)}°C`);
  setTxt("windSpeed", `${Math.round(current.wind_speed_10m)} km/h`);
  setTxt("windGusts", `${Math.round(current.wind_gusts_10m)} km/h`);
  setTxt("airQualityText", "Buena (AQI 28)");
}

function renderSunMoon(daily) {
  const sunrise =
    daily.sunrise && daily.sunrise[0]
      ? daily.sunrise[0].split("T")[1]
      : "--:--";
  const sunset =
    daily.sunset && daily.sunset[0] ? daily.sunset[0].split("T")[1] : "--:--";
  const el = document.getElementById("sunTimes");
  if (el) el.textContent = `Salida: ${sunrise} | Puesta: ${sunset}`;
}

function renderDailyForecast(daily) {
  const container = document.getElementById("dailyContainer");
  if (!container) return;
  container.innerHTML = "";

  daily.time.forEach((dateStr, index) => {
    const date = new Date(dateStr + "T00:00:00");
    const dayName =
      index === 0
        ? "Hoy"
        : date.toLocaleDateString("es-ES", { weekday: "long" });
    const formattedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    const precip = daily.precipitation_sum ? daily.precipitation_sum[index] : 0;

    const row = document.createElement("div");
    row.className = `daily-row ${index === 0 ? "selected-day" : ""}`;
    row.onclick = () => {
      document
        .querySelectorAll(".daily-row")
        .forEach((r) => r.classList.remove("selected-day"));
      row.classList.add("selected-day");
      renderHourlyCarousel(index);
    };

    row.innerHTML = `
      <div>
        <span class="day-name">${formattedDay} (${date.getDate()}/${date.getMonth() + 1})</span>
        ${precip > 0 ? `<span class="precip-tag">💧 ${precip.toFixed(1)} mm</span>` : `<span style="font-size:0.75rem; color:#64748b;">Sin lluvia</span>`}
      </div>
      <div class="icon-temp">
        <span>${getWeatherIcon(daily.weather_code[index])}</span>
        <span><strong>${Math.round(daily.temperature_2m_max[index])}°</strong> / ${Math.round(daily.temperature_2m_min[index])}°C</span>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderHourlyCarousel(dayIndex) {
  if (!currentDailyData || !currentDailyData.hourly) return;

  const container = document.getElementById("hourlyContainer");
  if (!container) return;
  container.innerHTML = "";

  const selectedDateStr = currentDailyData.daily.time[dayIndex];
  const labelEl = document.getElementById("selectedDayLabel");
  if (labelEl) labelEl.textContent = `(${selectedDateStr})`;

  const startIndex = dayIndex * 24;
  const endIndex = startIndex + 24;

  for (
    let i = startIndex;
    i < endIndex && i < currentDailyData.hourly.time.length;
    i++
  ) {
    const timeStr = currentDailyData.hourly.time[i].split("T")[1];
    const temp = Math.round(currentDailyData.hourly.temperature_2m[i]);
    const code = currentDailyData.hourly.weather_code[i];
    const precip = currentDailyData.hourly.precipitation
      ? currentDailyData.hourly.precipitation[i]
      : 0;

    const card = document.createElement("div");
    card.className = "hourly-card";
    card.innerHTML = `
      <span>${timeStr}</span>
      <span style="font-size: 1.4rem; margin: 4px 0;">${getWeatherIcon(code)}</span>
      <span class="temp">${temp}°C</span>
      ${precip > 0 ? `<span style="font-size:0.75rem; color:#38bdf8; margin-top:3px;">💧 ${precip.toFixed(1)} mm</span>` : ""}
    `;
    container.appendChild(card);
  }
}

// Exportación en PDF Estilo Boletín Oficial Dinámico
function exportWeatherReportPDF() {
  const cityName =
    document.getElementById("cityName")?.textContent || "Ubicación Consultada";
  const currentDate = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const tableBody = [
    [
      {
        text: `PRONÓSTICO METEOROLÓGICO Y PLUVIOMÉTRICO - LOCALIDAD: ${cityName.toUpperCase()}`,
        colSpan: 5,
        alignment: "center",
        bold: true,
        fontSize: 10.5,
        fillColor: "#1e293b",
        color: "#ffffff",
        margin: [0, 4, 0, 4],
      },
      {},
      {},
      {},
      {},
    ],
    [
      { text: "Día / Fecha", style: "tableHeader", alignment: "left" },
      { text: "Condición del Tiempo", style: "tableHeader", alignment: "left" },
      { text: "Temp. Mín (°C)", style: "tableHeader", alignment: "center" },
      { text: "Temp. Máx (°C)", style: "tableHeader", alignment: "center" },
      { text: "Precipitación (mm)", style: "tableHeader", alignment: "center" },
    ],
  ];

  if (currentDailyData && currentDailyData.daily) {
    currentDailyData.daily.time.forEach((dateStr, i) => {
      const date = new Date(dateStr + "T00:00:00");
      const dayName = date.toLocaleDateString("es-ES", { weekday: "long" });
      const formattedDay = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${date.getDate()}/${date.getMonth() + 1}`;

      const min = Math.round(currentDailyData.daily.temperature_2m_min[i]);
      const max = Math.round(currentDailyData.daily.temperature_2m_max[i]);
      const weatherText = getWeatherDescription(
        currentDailyData.daily.weather_code[i],
      );
      const precip = currentDailyData.daily.precipitation_sum
        ? currentDailyData.daily.precipitation_sum[i]
        : 0;

      const isExtreme = min <= 2 || precip > 0;
      const rowFillColor = isExtreme
        ? "#4c1d95"
        : i % 2 === 0
          ? "#f8fafc"
          : "#ffffff";
      const rowTextColor = isExtreme ? "#ffffff" : "#0f172a";

      tableBody.push([
        {
          text: formattedDay,
          fillColor: rowFillColor,
          color: rowTextColor,
          bold: true,
        },
        { text: weatherText, fillColor: rowFillColor, color: rowTextColor },
        {
          text: `${min}°C`,
          alignment: "center",
          fillColor: rowFillColor,
          color: rowTextColor,
          bold: true,
        },
        {
          text: `${max}°C`,
          alignment: "center",
          fillColor: rowFillColor,
          color: rowTextColor,
          bold: true,
        },
        {
          text: precip > 0 ? `${precip.toFixed(1)} mm` : "0.0 mm",
          alignment: "center",
          fillColor: rowFillColor,
          color: isExtreme && precip > 0 ? "#38bdf8" : rowTextColor,
          bold: precip > 0,
        },
      ]);
    });
  }

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [30, 35, 30, 35],
    content: [
      {
        text: "AEGIS VANGUARD SECURITY - BOLETÍN METEOROLÓGICO",
        fontSize: 13,
        bold: true,
        alignment: "center",
        color: "#0f172a",
        margin: [0, 0, 0, 2],
      },
      {
        text: `Informe Técnico Oficial | Fecha de Emisión: ${currentDate}`,
        fontSize: 8.5,
        alignment: "center",
        color: "#64748b",
        margin: [0, 0, 0, 12],
      },
      {
        table: {
          headerRows: 2,
          widths: ["26%", "28%", "15%", "15%", "16%"],
          body: tableBody,
        },
        layout: {
          hLineWidth: function () {
            return 1;
          },
          vLineWidth: function () {
            return 1;
          },
          hLineColor: function () {
            return "#334155";
          },
          vLineColor: function () {
            return "#334155";
          },
        },
      },
      {
        margin: [0, 12, 0, 0],
        table: {
          widths: ["*"],
          body: [
            [
              {
                fillColor: "#f1f5f9",
                borderColor: ["#334155", "#334155", "#334155", "#334155"],
                padding: [8, 6, 8, 6],
                stack: [
                  {
                    text: `Es importante recordar a los usuarios del sector en ${cityName} que los valores presentados corresponden a estimaciones numéricas del modelo meteorológico, por lo que pueden presentar variaciones en los días venideros.`,
                    fontSize: 8,
                    bold: true,
                    alignment: "center",
                    color: "#1e293b",
                    margin: [0, 0, 0, 3],
                  },
                  {
                    text: "Pronóstico orientado a planificación agrícola, logística y preventiva. Para revisar la evolución en tiempo real diríjase a nuestro panel web.",
                    fontSize: 7.5,
                    alignment: "center",
                    color: "#475569",
                  },
                ],
              },
            ],
          ],
        },
      },
    ],
    styles: {
      tableHeader: {
        bold: true,
        fontSize: 9,
        color: "#ffffff",
        fillColor: "#1e3a8a",
        margin: [0, 3, 0, 3],
      },
    },
    defaultStyle: {
      fontSize: 8.5,
    },
  };

  pdfMake
    .createPdf(docDefinition)
    .download(
      `Boletin_Meteorologico_${cityName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
    );
}

function getWeatherDescription(code) {
  const codes = {
    0: "Despejado",
    1: "Principalmente despejado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Niebla",
    48: "Niebla de escarcha",
    51: "Llovizna ligera",
    61: "Lluvia ligera",
    63: "Lluvia moderada",
    65: "Lluvia intensa",
    80: "Chubascos suaves",
    95: "Tormenta eléctrica",
  };
  return codes[code] || "Variable";
}

function getWeatherIcon(code) {
  if (code === 0 || code === 1) return "☀️";
  if (code === 2 || code === 3) return "⛅";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 65) return "🌧️";
  if (code >= 80) return "🌦️";
  if (code >= 95) return "🌩️";
  return "🌤️";
}
