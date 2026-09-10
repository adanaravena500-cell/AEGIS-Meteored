document.addEventListener("DOMContentLoaded", () => {
  const yearElem = document.getElementById("currentYear");
  if (yearElem) yearElem.textContent = new Date().getFullYear();

  // Cargar datos iniciales (Curicó)
  initWeatherApp("Curicó");

  // Eventos de usuario
  document.getElementById("searchBtn").addEventListener("click", () => {
    const city = document.getElementById("cityInput").value.trim();
    if (city) initWeatherApp(city);
  });

  document.getElementById("cityInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const city = document.getElementById("cityInput").value.trim();
      if (city) initWeatherApp(city);
    }
  });

  document
    .getElementById("downloadPdfBtn")
    .addEventListener("click", exportProfessionalPDF);
});

// Actualizar Mapa Sinóptico ECMWF con Isobaras
function initMap(lat, lon) {
  const iframe = document.getElementById("meteoredMap");
  if (iframe) {
    iframe.src = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=100%25&height=500&zoom=5&level=surface&overlay=rain&product=ecmwf&menu=&message=true&marker=&calendar=now&pressure=true&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
  }
}

// Búsqueda y renderizado de clima
async function initWeatherApp(cityName) {
  try {
    document.getElementById("cityName").textContent = `Buscando ${cityName}...`;

    // Geocodificación vía Open-Meteo
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=es&format=json`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      alert("Ciudad no encontrada");
      document.getElementById("cityName").textContent =
        "Ubicación no encontrada";
      return;
    }

    const { latitude, longitude, name, admin1, country } = geoData.results[0];
    const locationLabel = `${name}, ${admin1 || ""}, ${country}`;
    document.getElementById("cityName").textContent = locationLabel;

    // Actualizar iframe de mapa sinóptico
    initMap(latitude, longitude);

    // Consulta de pronóstico a Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum&timezone=auto`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();

    // Actualizar componentes UI
    updateCards(weatherData);
    renderDailyForecast(weatherData.daily);
    renderHourlyForecast(weatherData.hourly);
  } catch (error) {
    console.error("Error obteniendo el clima:", error);
    document.getElementById("cityName").textContent = "Error de conexión";
  }
}

// Actualizar tarjetas de métricas
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

// Pronóstico 7 días
function renderDailyForecast(daily) {
  const container = document.getElementById("dailyContainer");
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

// Pronóstico por hora con hora actual resaltada
function renderHourlyForecast(hourly) {
  const container = document.getElementById("hourlyContainer");
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

// Exportación PDF Profesional Agrometeorológico
function exportProfessionalPDF() {
  const cityName = document.getElementById("cityName").textContent || "Curicó";
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

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [30, 30, 30, 30],
    content: [
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                fillColor: "#1e1b4b",
                padding: [10, 10, 10, 10],
                stack: [
                  { text: "AEGIS METEORED ANALYSING", style: "bannerTitle" },
                  {
                    text: "SECCIÓN DE METEOROLOGÍA TÉCNICA Y AGROMETEOROLÓGICA",
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
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                fillColor: "#fef3c7",
                borderColor: ["#f59e0b", "#f59e0b", "#f59e0b", "#f59e0b"],
                border: [true, true, true, true],
                padding: [8, 8, 8, 8],
                text: [
                  {
                    text: "⚠️ ADVERTENCIA AGROMETEOROLÓGICA: ",
                    bold: true,
                    color: "#92400e",
                  },
                  {
                    text: `MONITOREO DE TEMPERATURAS Y PRONÓSTICO TÉCNICO PARA ${cityName.toUpperCase()}`,
                    color: "#78350f",
                  },
                ],
                alignment: "center",
              },
            ],
          ],
        },
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          widths: ["50%", "50%"],
          body: [
            [
              {
                fillColor: "#312e81",
                text: `Emisión: ${fechaEmision} - Hora: ${horaEmision}`,
                color: "#ffffff",
                fontSize: 9,
                bold: true,
                alignment: "center",
                padding: [5, 5, 5, 5],
              },
              {
                fillColor: "#312e81",
                text: "Contacto: soporte@aegis-vanguard.com | Sistema AEGIS",
                color: "#ffffff",
                fontSize: 9,
                bold: true,
                alignment: "center",
                padding: [5, 5, 5, 5],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 15],
      },
      {
        text: "Cuadro de Pronóstico de Temperaturas por Zonas (°C)",
        style: "sectionHeader",
      },
      {
        table: {
          headerRows: 1,
          widths: ["25%", "35%", "20%", "20%"],
          body: [
            [
              {
                text: "Región / Sector",
                style: "tableHeader",
                fillColor: "#4338ca",
              },
              {
                text: "Zona Geográfica",
                style: "tableHeader",
                fillColor: "#4338ca",
              },
              {
                text: "T. Mínima (°C)",
                style: "tableHeader",
                fillColor: "#4338ca",
              },
              {
                text: "T. Máxima (°C)",
                style: "tableHeader",
                fillColor: "#4338ca",
              },
            ],
            [
              {
                text: cityName,
                rowSpan: 3,
                alignment: "center",
                bold: true,
                margin: [0, 15, 0, 0],
              },
              { text: "Cordillera de la Costa", alignment: "left" },
              { text: "2°C", alignment: "center", fillColor: "#e0e7ff" },
              { text: "14°C", alignment: "center", fillColor: "#e0e7ff" },
            ],
            [
              {},
              { text: "Valles Centrales", alignment: "left" },
              { text: "4°C", alignment: "center", fillColor: "#e0e7ff" },
              { text: "16°C", alignment: "center", fillColor: "#e0e7ff" },
            ],
            [
              {},
              { text: "Precordillera", alignment: "left" },
              { text: "1°C", alignment: "center", fillColor: "#e0e7ff" },
              { text: "12°C", alignment: "center", fillColor: "#e0e7ff" },
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
        margin: [0, 0, 0, 20],
      },
    ],
    styles: {
      bannerTitle: {
        fontSize: 16,
        bold: true,
        color: "#38bdf8",
        alignment: "center",
      },
      bannerSubtitle: {
        fontSize: 9,
        bold: true,
        color: "#94a3b8",
        alignment: "center",
        margin: [0, 3, 0, 0],
      },
      sectionHeader: {
        fontSize: 11,
        bold: true,
        color: "#1e293b",
        margin: [0, 5, 0, 8],
      },
      tableHeader: {
        fontSize: 9.5,
        bold: true,
        color: "#ffffff",
        alignment: "center",
      },
    },
  };

  pdfMake
    .createPdf(docDefinition)
    .download(`Informe_Meteored_AEGIS_${cityName}.pdf`);
}
