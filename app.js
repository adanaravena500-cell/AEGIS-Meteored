// Establece el año dinámico en el footer
document.getElementById("currentYear").textContent = new Date().getFullYear();

// Ejemplo del bucle de generación del carrusel por hora en app.js:
function renderHourlyForecast(hourlyData) {
  const container = document.getElementById("hourlyContainer");
  container.innerHTML = "";

  const currentHourNow = new Date().getHours(); // Obtiene la hora actual (0-23)

  hourlyData.forEach((item) => {
    const card = document.createElement("div");
    card.className = "hourly-card";

    // Obtener la hora como número entero (ej: "08:00" -> 8)
    const hourVal = parseInt(item.time.split(":")[0], 10);

    // Si coincide con la hora actual, remarcamos en azul
    if (hourVal === currentHourNow) {
      card.classList.add("current-hour");
    }

    card.innerHTML = `
      <div class="time">${item.time}</div>
      <div class="icon">${item.icon}</div>
      <div class="temp">${item.temp}°C</div>
    `;

    container.appendChild(card);
  });
}
