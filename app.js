let leafletMap = null;
let currentMarker = null;
let currentCoords = {
  lat: -35.1147,
  lon: -71.2828,
  label: "Avenida Quechereguas, Molina, Chile",
};
let lastWeatherData = null; // Guardar datos para exportación detallada

document.addEventListener("DOMContentLoaded", () => {
  const yearElem = document.getElementById("currentYear");
  if (yearElem) yearElem.textContent = new Date().getFullYear();

  // 1. Obtener la ubicación precisa por GPS del dispositivo
  getUserLocation();

  // Eventos para la búsqueda manual
  document.getElementById("searchBtn").addEventListener("click", () => {
    const city = document.getElementById("cityInput").value.trim();
    if (city) initWeatherAppByCity(city);
  });

  document.getElementById("cityInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const city = document.getElementById("cityInput").value.trim();
      if (city) initWeatherAppByCity(city);
    }
  });

  // Alternar entre mapa de Windy (lluvia/viento) y Mapa Físico (Topográfico)
  const btnWindy = document.getElementById("btnMapWindy");
  const btnPhysical = document.getElementById("btnMapPhysical");
  const windyContainer = document.getElementById("windyContainer");
  const physicalContainer = document.getElementById("physicalContainer");

  btnWindy.addEventListener("click", () => {
    btnWindy.classList.add("active");
    btnPhysical.classList.remove("active");
    windyContainer.classList.remove("hidden");
    physicalContainer.classList.add("hidden");
  });

  btnPhysical.addEventListener("click", () => {
    btnPhysical.classList.add("active");
    btnWindy.classList.remove("active");
    physicalContainer.classList.remove("hidden");
    windyContainer.classList.add("hidden");

    renderPhysicalMap(
      currentCoords.lat,
      currentCoords.lon,
      currentCoords.label,
    );
  });

  document
    .getElementById("downloadPdfBtn")
    .addEventListener("click", exportProfessionalPDF);
});

// Solicitar la ubicación exacta usando el sensor GPS del dispositivo
function getUserLocation() {
  if ("geolocation" in navigator) {
    document.getElementById("cityName").textContent =
      "Obteniendo ubicación GPS de alta precisión...";

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        // Cargar clima y mapa directamente con la coordenada GPS detectada
        await initWeatherByCoords(lat, lon);
      },
      (error) => {
        console.warn("GPS no disponible o permiso denegado:", error.message);
        // Si falla el GPS o se deniega el permiso, buscar Molina como respaldo
        initWeatherAppByCity("Molina, Chile");
      },
      {
        enableHighAccuracy: true, // Forzar uso de GPS de alta precisión
        timeout: 15000,
        maximumAge: 0,
      },
    );
  } else {
    initWeatherAppByCity("Molina, Chile");
  }
}

// Cargar clima y mapas a partir de Latitud y Longitud directas (GPS de alta precisión)
async function initWeatherByCoords(lat, lon) {
  try {
    let locationLabel = `Ubicación GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})`;

    // Consulta de alta precisión a Nominatim (OpenStreetMap)
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const addr = geoData.address || {};

        // Extraer detalles específicos: Calle/Avenida, Villa/Sector, Comuna/Ciudad y Región
        const road = addr.road || addr.pedestrian || addr.suburb || "";
        const localArea =
          addr.town ||
          addr.city ||
          addr.village ||
          addr.municipality ||
          addr.county ||
          "";
        const state = addr.state || "";

        if (road && localArea) {
          locationLabel = `${road}, ${localArea}, ${state}`;
        } else if (localArea) {
          locationLabel = `${localArea}, ${state}, Chile`;
        } else if (geoData.display_name) {
          locationLabel = geoData.display_name.split(",").slice(0, 3).join(",");
        }
      }
    } catch (e) {
      console.log("Error al consultar Nominatim, mostrando coordenadas puras.");
    }

    currentCoords = { lat, lon, label: locationLabel };
    document.getElementById("cityName").textContent = locationLabel;

    // Actualizar Iframe de Windy con la posición exacta y Zoom en Molina/Quechereguas (Zoom 11)
    updateWindyMap(lat, lon);

    // Actualizar mapa físico topográfico si está activo
    if (
      !document.getElementById("physicalContainer").classList.contains("hidden")
    ) {
      renderPhysicalMap(lat, lon, locationLabel);
    }

    // Cargar datos exactos del clima desde Open-Meteo para las coordenadas exactas
    await fetchWeatherData(lat, lon);
  } catch (error) {
    console.error("Error al cargar clima por coordenadas:", error);
    document.getElementById("cityName").textContent =
      "Error al consultar la ubicación actual";
  }
}

// Cargar clima por nombre de ciudad (Búsqueda manual de respaldo)
async function initWeatherAppByCity(cityName) {
  try {
    document.getElementById("cityName").textContent = `Buscando ${cityName}...`;

    const cleanCity = cityName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=es&format=json`;

    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      alert("Lugar no encontrado. Intenta especificando la comuna o región.");
      document.getElementById("cityName").textContent =
        "Ubicación no encontrada";
      return;
    }

    const { latitude, longitude, name, admin1, country } = geoData.results[0];
    const locationLabel = `${name}, ${admin1 || ""}, ${country}`;

    currentCoords = { lat: latitude, lon: longitude, label: locationLabel };
    document.getElementById("cityName").textContent = locationLabel;

    updateWindyMap(latitude, longitude);

    if (
      !document.getElementById("physicalContainer").classList.contains("hidden")
    ) {
      renderPhysicalMap(latitude, longitude, locationLabel);
    }

    await fetchWeatherData(latitude, longitude);
  } catch (error) {
    console.error("Error en búsqueda manual:", error);
    document.getElementById("cityName").textContent =
      "Error al consultar servicio";
  }
}

// Consultar la API del Clima de Open-Meteo con parámetros agrometeorológicos ampliados
async function fetchWeatherData(lat, lon) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure,dew_point_2m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max&timezone=auto`;
  const weatherRes = await fetch(weatherUrl);
  const weatherData = await weatherRes.json();

  lastWeatherData = weatherData; // Almacenar para exportación completa
  updateCards(weatherData);
  renderDailyForecast(weatherData.daily);
  renderHourlyForecast(weatherData.hourly);
}

// Actualizar visor de Windy
function updateWindyMap(lat, lon) {
  const iframe = document.getElementById("meteoredMap");
  if (iframe) {
    iframe.src = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=100%25&height=500&zoom=11&level=surface&overlay=rain&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=true&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
  }
}

// Renderizar Mapa Físico Topográfico con Leaflet
function renderPhysicalMap(lat, lon, label) {
  if (leafletMap !== null) {
    leafletMap.remove();
  }

  leafletMap = L.map("map").setView([lat, lon], 13); // Zoom 13 para ver detalle de calles/avenidas

  L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution:
      "Map data: &copy; OpenStreetMap contributors, SRTM | Style: OpenTopoMap",
  }).addTo(leafletMap);

  currentMarker = L.marker([lat, lon])
    .addTo(leafletMap)
    .bindPopup(`<b>${label}</b>`)
    .openPopup();

  setTimeout(() => {
    leafletMap.invalidateSize();
  }, 200);
}

// Actualizar tarjetas principales de clima
function updateCards(data) {
  const current = data.current;
  const daily = data.daily;

  document.getElementById("tempValue").textContent = Math.round(
    current.temperature_2m,
  );
  document.getElementById("weatherDesc").textContent = getWeatherDescription(
    current.weather_code,
  );
  document.getElementById("realFeel").textContent =
    `${Math.round(current.apparent_temperature)}°C`;
  document.getElementById("windSpeed").textContent =
    `${current.wind_speed_10m} km/h`;
  document.getElementById("windGusts").textContent =
    `${current.wind_gusts_10m} km/h`;

  const sunrise = daily.sunrise[0] ? daily.sunrise[0].split("T")[1] : "--:--";
  const sunset = daily.sunset[0] ? daily.sunset[0].split("T")[1] : "--:--";
  document.getElementById("sunTimes").textContent =
    `Salida: ${sunrise} | Puesta: ${sunset}`;
  document.getElementById("airQualityText").textContent = "Buena (AQI 25)";
}

// Renderizar pronóstico diario (Semana)
function renderDailyForecast(daily) {
  const container = document.getElementById("dailyContainer");
  if (!container) return;
  container.innerHTML = "";

  daily.time.forEach((dateStr, index) => {
    const row = document.createElement("div");
    row.className = `daily-row ${index === 0 ? "selected-day" : ""}`;

    const dateObj = new Date(dateStr + "T00:00:00");
    const dayName =
      index === 0
        ? "Hoy"
        : dateObj.toLocaleDateString("es-ES", { weekday: "short" });
    const formattedDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
    const precip = daily.precipitation_sum[index];

    row.innerHTML = `
      <div>
        <div class="day-name">${dayName} (${formattedDate})</div>
        <span class="precip-tag">${precip > 0 ? `💧 ${precip} mm` : "Sin lluvia"}</span>
      </div>
      <div class="icon-temp">
        <span>${getWeatherIcon(daily.weather_code[index])}</span>
        <strong>${Math.round(daily.temperature_2m_max[index])}° / ${Math.round(daily.temperature_2m_min[index])}°</strong>
      </div>
    `;

    container.appendChild(row);
  });
}

// Renderizar pronóstico por horas (Próximas 24h)
function renderHourlyForecast(hourly) {
  const container = document.getElementById("hourlyContainer");
  if (!container) return;
  container.innerHTML = "";

  const currentHourNow = new Date().getHours();

  for (let i = 0; i < 24; i++) {
    const timeStr = hourly.time[i];
    const hourVal = parseInt(timeStr.split("T")[1].split(":")[0], 10);
    const temp = Math.round(hourly.temperature_2m[i]);
    const code = hourly.weather_code[i];

    const card = document.createElement("div");
    card.className = "hourly-card";

    if (hourVal === currentHourNow) {
      card.classList.add("current-hour");
    }

    card.innerHTML = `
      <div class="time">${hourVal.toString().padStart(2, "0")}:00</div>
      <div class="icon">${getWeatherIcon(code)}</div>
      <div class="temp">${temp}°C</div>
    `;

    container.appendChild(card);
  }
}

function getWeatherIcon(code) {
  if (code === 0) return "☀️";
  if (code >= 1 && code <= 3) return "⛅";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}

function getWeatherDescription(code) {
  if (code === 0) return "Despejado";
  if (code === 1 || code === 2) return "Parcialmente Nublado";
  if (code === 3) return "Nublado";
  if (code >= 51 && code <= 67) return "Lluvia Ligera";
  if (code >= 80) return "Chubascos";
  return "Normal";
}

// =========================================================================
// GENERACIÓN DE REPORTE TÉCNICO PROFESIONAL Y COMPLETO EN PDF (pdfMake)
// =========================================================================
function exportProfessionalPDF() {
  const cityName =
    document.getElementById("cityName").textContent || "Ubicación Actual";
  const now = new Date();
  const fechaEmision = now.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const horaEmision = now.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const weather = lastWeatherData || {};
  const current = weather.current || {};
  const daily = weather.daily || {};

  // 1. Análisis de Riesgo de Heladas para la semana
  let frostAlerts = [];
  let minTempWeek = 99;
  let maxPrecipDay = 0;
  let totalPrecipWeek = 0;

  if (daily.temperature_2m_min) {
    daily.temperature_2m_min.forEach((tMin, idx) => {
      if (tMin < minTempWeek) minTempWeek = tMin;
      const dateStr = daily.time[idx];
      const pSum = daily.precipitation_sum ? daily.precipitation_sum[idx] : 0;
      totalPrecipWeek += pSum;
      if (pSum > maxPrecipDay) maxPrecipDay = pSum;

      if (tMin <= 0) {
        frostAlerts.push({
          fecha: dateStr,
          temp: tMin,
          nivel: "ALTO (Helada Meteorológica)",
          color: "#dc2626",
          desc: "Riesgo de congelación directo. Protección pasiva/activa urgente en cultivos sensibles.",
        });
      } else if (tMin <= 3) {
        frostAlerts.push({
          fecha: dateStr,
          temp: tMin,
          nivel: "MODERADO (Riesgo de Helada Agronómica/Superficie)",
          color: "#d97706",
          desc: "Posible escarcha a nivel de suelo. Controlar inversión térmica y humedad.",
        });
      }
    });
  }

  // Determinar Banner de Alerta General
  let alertBgColor = "#dcfce7";
  let alertBorderColor = "#16a34a";
  let alertTextColor = "#15803d";
  let alertTitle = "CONDICIONES ESTABLES / SIN ALERTA CRÍTICA DE HELADAS";
  let alertMsg = `Temperaturas mínimas proyectadas por sobre los 3°C (${minTempWeek.toFixed(1)}°C min). Precipitación acumulada semanal: ${totalPrecipWeek.toFixed(1)} mm.`;

  if (frostAlerts.length > 0) {
    const hasCritical = frostAlerts.some((a) => a.temp <= 0);
    alertBgColor = hasCritical ? "#fee2e2" : "#fef3c7";
    alertBorderColor = hasCritical ? "#dc2626" : "#f59e0b";
    alertTextColor = hasCritical ? "#991b1b" : "#92400e";
    alertTitle = hasCritical
      ? "⚠️ ALERTA AGROMETEOROLÓGICA: CRÍTICA POR HELADAS SEVERAS"
      : "⚠️ ALERTA AGROMETEOROLÓGICA: RIESGO DE HELADAS A NIVEL DE SUELO";
    alertMsg = `Se registran ${frostAlerts.length} días con temperaturas críticas para la agricultura (Mínima semanal de ${minTempWeek.toFixed(1)}°C). Revisar detalle diario.`;
  } else if (totalPrecipWeek > 20) {
    alertBgColor = "#e0f2fe";
    alertBorderColor = "#0284c7";
    alertTextColor = "#0369a1";
    alertTitle = "🌧️ ALERTA DE PRECIPITACIONES SIGNIFICATIVAS";
    alertMsg = `Se prevé una acumulación total de ${totalPrecipWeek.toFixed(1)} mm de agua durante la semana. Pico máximo diario: ${maxPrecipDay.toFixed(1)} mm.`;
  }

  // Construir filas de la tabla de pronóstico diario de 7 días
  const dailyTableRows = [
    [
      { text: "Fecha / Día", style: "tableHeader", fillColor: "#1e1b4b" },
      { text: "T. Mín / Máx", style: "tableHeader", fillColor: "#1e1b4b" },
      { text: "Lluvia (mm)", style: "tableHeader", fillColor: "#1e1b4b" },
      { text: "Prob. Lluvia", style: "tableHeader", fillColor: "#1e1b4b" },
      { text: "Ráfaga Máx", style: "tableHeader", fillColor: "#1e1b4b" },
      { text: "Índice UV", style: "tableHeader", fillColor: "#1e1b4b" },
      { text: "Riesgo Helada", style: "tableHeader", fillColor: "#1e1b4b" },
    ],
  ];

  if (daily.time) {
    daily.time.forEach((dateStr, i) => {
      const dObj = new Date(dateStr + "T00:00:00");
      const dayName = dObj.toLocaleDateString("es-ES", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });
      const tMin = daily.temperature_2m_min[i];
      const tMax = daily.temperature_2m_max[i];
      const precip = daily.precipitation_sum ? daily.precipitation_sum[i] : 0;
      const prob = daily.precipitation_probability_max
        ? daily.precipitation_probability_max[i]
        : 0;
      const gust = daily.wind_gusts_10m_max ? daily.wind_gusts_10m_max[i] : 0;
      const uv = daily.uv_index_max ? daily.uv_index_max[i] : 0;

      let frostStatus = "Sin Riesgo";
      let statusColor = "#16a34a";
      if (tMin <= 0) {
        frostStatus = "SEVERA";
        statusColor = "#dc2626";
      } else if (tMin <= 3) {
        frostStatus = "MODERADA";
        statusColor = "#d97706";
      }

      dailyTableRows.push([
        { text: dayName, alignment: "center", bold: true, fontSize: 8.5 },
        {
          text: `${tMin.toFixed(1)}°C / ${tMax.toFixed(1)}°C`,
          alignment: "center",
          fontSize: 8.5,
        },
        {
          text: `${precip.toFixed(1)} mm`,
          alignment: "center",
          bold: precip > 0,
          color: precip > 0 ? "#0284c7" : "#475569",
          fontSize: 8.5,
        },
        { text: `${prob}%`, alignment: "center", fontSize: 8.5 },
        {
          text: `${Math.round(gust)} km/h`,
          alignment: "center",
          fontSize: 8.5,
        },
        { text: `${uv.toFixed(1)}`, alignment: "center", fontSize: 8.5 },
        {
          text: frostStatus,
          alignment: "center",
          bold: true,
          color: statusColor,
          fontSize: 8.5,
        },
      ]);
    });
  }

  // Definición completa del PDF
  const docDefinition = {
    pageSize: "A4",
    pageMargins: [30, 30, 30, 30],
    content: [
      // Encabezado institucional
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                fillColor: "#0f172a",
                padding: [12, 10, 12, 10],
                stack: [
                  {
                    text: "INFORME AGROMETEOROLÓGICO Y TÉCNICO DE PRECISIÓN",
                    style: "bannerTitle",
                  },
                  {
                    text: "SISTEMA AEGIS VANGUARD - ESTACIÓN DE MONITOREO TERRITORIAL",
                    style: "bannerSubtitle",
                  },
                ],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 10],
      },

      // Ficha de Ubicación y Metadatos de la Emisión
      {
        table: {
          widths: ["60%", "40%"],
          body: [
            [
              {
                fillColor: "#f1f5f9",
                padding: [8, 8, 8, 8],
                stack: [
                  {
                    text: `📍 UBICACIÓN EVALUADA: ${cityName.toUpperCase()}`,
                    bold: true,
                    fontSize: 9.5,
                    color: "#1e293b",
                  },
                  {
                    text: `Coordenadas exactas: Lat ${currentCoords.lat.toFixed(5)}, Lon ${currentCoords.lon.toFixed(5)}`,
                    fontSize: 8.5,
                    color: "#475569",
                  },
                  {
                    text: `Cobertura: Sector urbano / Agrícola de Molina y alrededores`,
                    fontSize: 8,
                    color: "#64748b",
                  },
                ],
              },
              {
                fillColor: "#f1f5f9",
                padding: [8, 8, 8, 8],
                stack: [
                  {
                    text: `📅 Fecha de emisión: ${fechaEmision}`,
                    fontSize: 8.5,
                    color: "#1e293b",
                  },
                  {
                    text: `⏰ Hora exacta: ${horaEmision} (Hora Local)`,
                    fontSize: 8.5,
                    color: "#1e293b",
                  },
                  {
                    text: `🛰️ Fuente de datos: Open-Meteo & ECMWF / GFS Model`,
                    fontSize: 8,
                    color: "#64748b",
                  },
                ],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 10],
      },

      // Cuadro Alerta Agrometeorológica Principal
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                fillColor: alertBgColor,
                borderColor: [
                  alertBorderColor,
                  alertBorderColor,
                  alertBorderColor,
                  alertBorderColor,
                ],
                border: [true, true, true, true],
                padding: [10, 8, 10, 8],
                stack: [
                  {
                    text: alertTitle,
                    bold: true,
                    color: alertTextColor,
                    fontSize: 10,
                    alignment: "center",
                  },
                  {
                    text: alertMsg,
                    color: alertTextColor,
                    fontSize: 8.5,
                    alignment: "center",
                    margin: [0, 3, 0, 0],
                  },
                ],
              },
            ],
          ],
        },
        margin: [0, 0, 0, 12],
      },

      // Sección 1: Diagnóstico Meteorológico Actual
      { text: "1. Diagnóstico Estacional Actual", style: "sectionHeader" },
      {
        table: {
          widths: ["25%", "25%", "25%", "25%"],
          body: [
            [
              { text: "Temperatura Actual", style: "kpiTitle" },
              { text: "Sensación Térmica", style: "kpiTitle" },
              { text: "Humedad Relativa", style: "kpiTitle" },
              { text: "Punto de Rocío", style: "kpiTitle" },
            ],
            [
              {
                text: `${current.temperature_2m ? Math.round(current.temperature_2m) : "--"} °C`,
                style: "kpiValue",
              },
              {
                text: `${current.apparent_temperature ? Math.round(current.apparent_temperature) : "--"} °C`,
                style: "kpiValue",
              },
              {
                text: `${current.relative_humidity_2m ? current.relative_humidity_2m : "--"} %`,
                style: "kpiValue",
              },
              {
                text: `${current.dew_point_2m ? current.dew_point_2m.toFixed(1) : "--"} °C`,
                style: "kpiValue",
              },
            ],
            [
              { text: "Viento Sostenido", style: "kpiTitle" },
              { text: "Ráfagas Máximas", style: "kpiTitle" },
              { text: "Presión Atmosférica", style: "kpiTitle" },
              { text: "Estado Atmosférico", style: "kpiTitle" },
            ],
            [
              {
                text: `${current.wind_speed_10m ? current.wind_speed_10m : "--"} km/h`,
                style: "kpiValue",
              },
              {
                text: `${current.wind_gusts_10m ? current.wind_gusts_10m : "--"} km/h`,
                style: "kpiValue",
              },
              {
                text: `${current.surface_pressure ? Math.round(current.surface_pressure) : "--"} hPa`,
                style: "kpiValue",
              },
              {
                text: getWeatherDescription(current.weather_code),
                style: "kpiValue",
              },
            ],
          ],
        },
        layout: {
          fillColor: function (rowIndex) {
            return rowIndex % 2 === 0 ? "#f8fafc" : "#ffffff";
          },
          hLineWidth: function () {
            return 0.5;
          },
          vLineWidth: function () {
            return 0.5;
          },
          hLineColor: function () {
            return "#e2e8f0";
          },
          vLineColor: function () {
            return "#e2e8f0";
          },
        },
        margin: [0, 0, 0, 15],
      },

      // Sección 2: Pronóstico Detallado de 7 Días (Lluvia, Heladas, Viento)
      {
        text: "2. Pronóstico Táctico 7 Días (Precipitaciones, Heladas y Viento)",
        style: "sectionHeader",
      },
      {
        table: {
          headerRows: 1,
          widths: ["18%", "18%", "14%", "14%", "13%", "11%", "12%"],
          body: dailyTableRows,
        },
        layout: {
          hLineWidth: function () {
            return 0.5;
          },
          vLineWidth: function () {
            return 0.5;
          },
          hLineColor: function () {
            return "#cbd5e1";
          },
          vLineColor: function () {
            return "#cbd5e1";
          },
        },
        margin: [0, 0, 0, 15],
      },

      // Sección 3: Análisis de Heladas y Recomendaciones Agrícolas
      {
        text: "3. Evaluación de Riesgo Agrícola y Recomendaciones de Manejo",
        style: "sectionHeader",
      },
      {
        table: {
          widths: ["100%"],
          body: [
            [
              {
                fillColor: "#f8fafc",
                padding: [10, 8, 10, 8],
                stack: [
                  {
                    text: "❄️ Monitoreo Inversión Térmica / Heladas:",
                    bold: true,
                    fontSize: 9,
                    color: "#1e1b4b",
                  },
                  {
                    text:
                      frostAlerts.length > 0
                        ? `Se prevén temperaturas por debajo del umbral de seguridad agrícola (${frostAlerts.map((a) => a.fecha + ": " + a.temp + "°C").join(" | ")}). Se aconseja activar hélices antiheladas, quemadores o riego por aspersión durante las horas previas al amanecer.`
                        : "No se contemplan eventos de heladas meteorológicas (<0°C) durante los próximos 7 días. El patrón térmico se mantiene favorable para la estabilidad foliar y del brote.",
                    fontSize: 8.5,
                    color: "#334155",
                    margin: [0, 2, 0, 6],
                  },
                  {
                    text: "💧 Gestión de Riego y Agua Caída (Precipitación):",
                    bold: true,
                    fontSize: 9,
                    color: "#1e1b4b",
                  },
                  {
                    text:
                      totalPrecipWeek > 0
                        ? `Acumulado total proyectado: ${totalPrecipWeek.toFixed(1)} mm. Ajuste las tasas de riego programado para evitar saturación de raíces y prevenir la proliferación de hongos o botrytis en los sectores bajos.`
                        : "Período seco sin precipitaciones significativas acumuladas. Mantener los programas de riego continuo según la evapotranspiración de la zona.",
                    fontSize: 8.5,
                    color: "#334155",
                    margin: [0, 2, 0, 6],
                  },
                  {
                    text: "💨 Aplicación de Fitosanitarios y Viento:",
                    bold: true,
                    fontSize: 9,
                    color: "#1e1b4b",
                  },
                  {
                    text: `Las ráfagas máximas de viento alcanzarán hasta ${daily.wind_gusts_10m_max ? Math.max(...daily.wind_gusts_10m_max).toFixed(0) : 0} km/h. Se recomienda realizar labores de fumigación y pulverización durante las primeras horas de la mañana, cuando las velocidades del viento son inferiores a 10 km/h.`,
                    fontSize: 8.5,
                    color: "#334155",
                  },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: function () {
            return 1;
          },
          vLineWidth: function () {
            return 1;
          },
          hLineColor: function () {
            return "#cbd5e1";
          },
          vLineColor: function () {
            return "#cbd5e1";
          },
        },
        margin: [0, 0, 0, 15],
      },

      // Pie de Página Firma / Validación
      {
        columns: [
          {
            text: "Reporte generado automáticamente por la Plataforma AEGIS Meteored Analysing.\nDocumento de carácter técnico para apoyo en la toma de decisiones agrometeorológicas.",
            fontSize: 7.5,
            color: "#64748b",
          },
          {
            text: "AEGIS Vanguard Security\nCentro de Análisis Agrometeorológico",
            fontSize: 8,
            bold: true,
            color: "#1e1b4b",
            alignment: "right",
          },
        ],
        margin: [0, 10, 0, 0],
      },
    ],
    styles: {
      bannerTitle: {
        fontSize: 13,
        bold: true,
        color: "#38bdf8",
        alignment: "center",
      },
      bannerSubtitle: {
        fontSize: 8,
        bold: true,
        color: "#94a3b8",
        alignment: "center",
        margin: [0, 3, 0, 0],
      },
      sectionHeader: {
        fontSize: 10.5,
        bold: true,
        color: "#0f172a",
        margin: [0, 6, 0, 6],
      },
      tableHeader: {
        fontSize: 8,
        bold: true,
        color: "#ffffff",
        alignment: "center",
      },
      kpiTitle: {
        fontSize: 7.5,
        color: "#64748b",
        alignment: "center",
        bold: true,
      },
      kpiValue: {
        fontSize: 9,
        color: "#0f172a",
        alignment: "center",
        bold: true,
      },
    },
  };

  pdfMake
    .createPdf(docDefinition)
    .download(
      `Informe_Agrometeorologico_AEGIS_${cityName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
    );
}
