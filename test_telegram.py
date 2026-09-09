import requests

TELEGRAM_BOT_TOKEN = "8557559322:AAHqJF-zwjun_o8adiuy3kfGsyzdH5NisS4"
TELEGRAM_CHAT_ID = "8777567608"  # Pega aquí el ID numérico de @userinfobot

def enviar_prueba():
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": "🛡️ *AEGIS METEORED ANALISING*\n\nConexión establecida exitosamente con el centro de alertas meteorológicas de Curicó.",
        "parse_mode": "Markdown"
    }
    res = requests.post(url, json=payload)
    if res.status_code == 200:
        print("✅ ¡Mensaje de prueba recibido en tu Telegram!")
    else:
        print(f"❌ Error al enviar: {res.text}")

enviar_prueba()