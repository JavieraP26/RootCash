import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Cargar variables de entorno (usando .env para local, GitHub Secrets en prod)
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # Usar Service Role para hacer bypass de RLS
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL")

# Configuración Email
EMAIL_SENDER = os.environ.get("EMAIL_SENDER")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD") # Contraseña de aplicación de Gmail
EMAIL_RECEIVER = os.environ.get("EMAIL_RECEIVER") # Para esta app, el correo del usuario (o hardcodeado temporalmente)

def init_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Supabase credentials not found in environment variables")
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def send_slack_notification(message: str):
    if not SLACK_WEBHOOK_URL:
        print("Webhook de Slack no configurado, saltando...")
        return
    
    payload = {"text": message}
    try:
        response = requests.post(SLACK_WEBHOOK_URL, json=payload)
        response.raise_for_status()
        print("Notificación de Slack enviada con éxito.")
    except Exception as e:
        print(f"Error enviando mensaje a Slack: {e}")

def send_email_notification(subject: str, body: str):
    if not all([EMAIL_SENDER, EMAIL_PASSWORD, EMAIL_RECEIVER]):
        print("Credenciales de Email no configuradas, saltando...")
        return
    
    msg = MIMEMultipart()
    msg['From'] = EMAIL_SENDER
    msg['To'] = EMAIL_RECEIVER
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))

    try:
        # Usando Gmail SMTP por defecto
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        print("Correo enviado con éxito.")
    except Exception as e:
        print(f"Error enviando correo: {e}")

def check_due_debts():
    print(f"--- Iniciando revisión de deudas: {datetime.now()} ---")
    supabase = init_supabase()
    
    # 1. Traer deudas NO pagadas
    response = supabase.table('fixed_debts').select('*').eq('is_paid', False).execute()
    debts = response.data
    
    if not debts:
        print("No hay deudas pendientes por pagar.")
        return

    today = datetime.now()
    current_month_str = today.strftime("%Y-%m") # Ej: "2026-02"

    for debt in debts:
        due_day = debt.get('due_day')
        name = debt.get('name')
        amount = debt.get('amount')
        last_notified = debt.get('last_notified_month')

        if not due_day:
            continue

        # Validamos si ya fue notificado este mes
        if last_notified == current_month_str:
            print(f"- Deuda '{name}' ya fue notificada este mes. Saltando.")
            continue

        # Constructor de la fecha de vencimiento para este mes
        try:
            # Manejo de meses con menos de 31 días si el due_day es 31
            import calendar
            _, last_day_of_month = calendar.monthrange(today.year, today.month)
            safe_due_day = min(due_day, last_day_of_month)
            due_date = datetime(today.year, today.month, safe_due_day)
        except ValueError as e:
            print(f"Error calculando fecha para '{name}': {e}")
            continue

        # 2. Calcular diferencia de días
        days_until_due = (due_date - today).days

        # Solo notificar si faltan entre 0 y 3 días, o si ya se venció este mes (days < 0)
        # y no ha sido pagado.
        if days_until_due <= 3:
            estado = "⚠️ VENCE ESTE MES" if days_until_due < 0 else f"Faltan {days_until_due} día(s)"
            if days_until_due == 0:
                estado = "🔥 VENCE HOY"
            
            message_text = f"🚨 *Aviso RootCash:* Tu deuda *{name}* por *${amount:,}* vence pronto ({estado}). ¡No olvides pagarla!"
            html_body = f"""
            <html>
                <body>
                    <h2>Aviso de Vencimiento - RootCash</h2>
                    <p>Hola,</p>
                    <p>Te recordamos que tu deuda/gasto fijo <strong>{name}</strong> por el monto de <strong>${amount:,}</strong> está próxima a vencer.</p>
                    <p><strong>Estado:</strong> {estado}</p>
                    <br>
                    <p>Entra a la app para marcarla como pagada y mantener tu presupuesto al día.</p>
                </body>
            </html>
            """

            print(f">> Notificando: {name} (Faltan {days_until_due} días)")
            
            # Enviar Notificaciones
            send_slack_notification(message_text)
            send_email_notification(f"RootCash - Pago de {name} próximo a vencer", html_body)

            # 3. Actualizar la base de datos para no enviar de nuevo este mes
            supabase.table('fixed_debts').update({
                'last_notified_month': current_month_str
            }).eq('id', debt['id']).execute()

if __name__ == "__main__":
    check_due_debts()
