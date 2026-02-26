import os
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno (asegurarse de crear .env en /backend)
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # Usar Service Role para bypass RLS o Anon key y ejecutar como admin
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL")

# Configuración de correo (Opcional, Gmail como ejemplo)
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
EMAIL_SENDER = os.environ.get("EMAIL_SENDER")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD") # App Password de Google

# Inicializar Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def send_slack_notification(message):
    if not SLACK_WEBHOOK_URL:
        return
    import requests
    requests.post(SLACK_WEBHOOK_URL, json={"text": message})

def send_email_notification(to_email, subject, body):
    if not EMAIL_SENDER or not EMAIL_PASSWORD:
        return
    
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = EMAIL_SENDER
    msg['To'] = to_email

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_SENDER, to_email, msg.as_string())
        server.quit()
        print(f"Correo enviado a {to_email}")
    except Exception as e:
        print(f"Error enviando correo: {e}")

def check_due_debts():
    print(f"[{datetime.now()}] Iniciando revisión de deudas fijas...")
    
    today = datetime.now()
    target_date = today + timedelta(days=2) # Avisar con 2 días de anticipación
    target_day = target_date.day
    
    # 1. Obtener todas las deudas que vencen en target_day
    try:
        response = supabase.table('fixed_debts').select('*, profiles(email)').eq('due_day', target_day).execute()
        debts = response.data
    except Exception as e:
        print(f"Error conectando a Supabase: {e}")
        return

    if not debts:
        print(f"No hay deudas que venzan el día {target_day}.")
        return

    for debt in debts:
        user_id = debt['user_id']
        description = debt['description']
        amount = debt['amount']
        user_email = debt['profiles']['email'] if debt.get('profiles') else None
        
        message = f"Recordatorio: Tu pago fijo de '{description}' por ${amount:,.0f} CLP vence en 2 días (el día {target_day})."
        
        print(f"Notificando a {user_id} sobre {description}...")

        # 2. Guardar notificación en la base de datos (para la UI de la app web)
        try:
            supabase.table('notifications').insert({
                'user_id': user_id,
                'message': message,
                'is_read': False
            }).execute()
        except Exception as e:
            print(f"Error guardando notificación en DB: {e}")
        
        # 3. Enviar notificaciones externas
        if SLACK_WEBHOOK_URL:
            send_slack_notification(f"<@{user_email}> " + message)
            
        if user_email and EMAIL_SENDER:
            send_email_notification(
                user_email,
                "RootCash: Recordatorio de Pago Próximo",
                message + "\n\nIngresa a RootCash para registrar tu pago una vez lo realices."
            )

if __name__ == "__main__":
    check_due_debts()
