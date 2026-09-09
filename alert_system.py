import requests
import time

# Configuración de Telegram
TELEGRAM_BOT_TOKEN = "8557559322:AAHqJF-zwjun_o8adiuy3kfGsyzdH5NisS4"
TELEGRAM_CHAT_ID = "8777567608"

# Coordenadas de Curicó
LAT = "-34.9828"
LON = "-71.2394"

def obtener_descripcion_wmo(code):
    wmo_map = {
        0: "Despejado", 1: "Principalmente despejado", 2: "Parcialmente nublado",
        3: "Nublado", 45: "Niebla", 51: "Llovizna ligera", 61: "Lluvia débil",
        63: "Lluvia moderada", 65: "Lluvia fuerte", 80: "Chubascos débiles",
        95: "Tormenta eléctrica"
    }
    return wmo_map.get(code, "Nublado")

def enviar_alerta_telegram(mensaje):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": mensaje,
        "parse_mode": "Markdown"
    }
    try:
        res = requests.post(url, json=payload)
        if res.status_code == 200:
            print("📲 Alerta enviada con éxito a Telegram.")
        else:
            print(f"Error enviando mensaje: {res.text}")
    except Exception as e:
        print(f"Error de conexión con Telegram: {e}")

def monitorear_clima():
    url = f"https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}&current_weather=true&daily=precipitation_probability_max&timezone=auto"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            clima_actual = data['current_weather']
            temp = round(clima_actual['temperature'])
            code = clima_actual['weathercode']
            descripcion = obtener_descripcion_wmo(code)
            prob_lluvia = round(data['daily']['precipitation_probability_max'][0])

            print(f"[{time.strftime('%H:%M:%S')}] Curicó en vivo (Open-Meteo): {temp}°C | {descripcion} | Prob. Lluvia: {prob_lluvia}%")

            # Enviar alerta si la probabilidad de lluvia es >= 40%
            if prob_lluvia >= 40:
                mensaje = (
                    f"⚠️ *AEGIS METEORED ANALISING*\n\n"
                    f"📍 *Zona:* Curicó, Chile\n"
                    f"🌡️ *Temperatura Actual:* {temp}°C\n"
                    f"🌧️ *Probabilidad de Lluvia Hoy:* {prob_lluvia}%\n"
                    f"☁️ *Estado:* {descripcion}\n\n"
                    f"_Datos satelitales en tiempo real._"
                )
                enviar_alerta_telegram(mensaje)
        else:
            print(f"Error en respuesta Open-Meteo: {response.status_code}")
    except Exception as e:
        print(f"Error de monitoreo: {e}")

if __name__ == "__main__":
    print("=== AEGIS Meteored: Sistema de Alertas Activo (Open-Meteo) ===")
    monitorear_clima()