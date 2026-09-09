document
  .getElementById("downloadPdfBtn")
  .addEventListener("click", exportProfessionalPDF);

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
      // 1. Banner Institucional Superior
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

      // 2. Alerta / Advertencia Meteorológica
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

      // 3. Metadatos de Emisión y Validez
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

      // 4. Tabla Agrometeorológica por Zonas y Regiones
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
          hLineWidth: function (i, node) {
            return 1;
          },
          vLineWidth: function (i, node) {
            return 1;
          },
          hLineColor: function (i, node) {
            return "#cbd5e1";
          },
          vLineColor: function (i, node) {
            return "#cbd5e1";
          },
        },
        margin: [0, 0, 0, 20],
      },

      // 5. Análisis Técnico y Recomendaciones
      {
        text: "Análisis Synóptico y Recomendaciones Técnicas",
        style: "sectionHeader",
      },
      {
        ul: [
          "Condiciones atmosféricas dominadas por alta presión de características frías.",
          "Se recomienda a los agricultores de la zona mantener activados los sistemas de control de heladas en cultivos vulnerables.",
          "Monitoreo continuo de ráfagas de viento y humedad relativa mediante la plataforma AEGIS Meteored Analysing.",
        ],
        fontSize: 9.5,
        color: "#334155",
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
