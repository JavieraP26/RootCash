import os
import smtplib
import calendar
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
EMAIL_SENDER = os.environ.get("EMAIL_SENDER")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD")


def init_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Credenciales de Supabase no encontradas.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def send_email_notification(to_email: str, subject: str, body: str):
    if not all([EMAIL_SENDER, EMAIL_PASSWORD]):
        print("  ⚠️  Credenciales de Email no configuradas, saltando...")
        return

    msg = MIMEMultipart()
    msg['From'] = EMAIL_SENDER
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"  ✉️  Correo enviado a {to_email}")
    except Exception as e:
        print(f"  ❌ Error enviando correo a {to_email}: {e}")


def check_debts_for_user(supabase: Client, user_id: str, user_email: str, display_name: str):
    today = datetime.now()
    current_month_str = today.strftime("%Y-%m")

    # Traer todos los gastos fijos del usuario (sin filtro is_paid, no existe en el schema)
    response = supabase.table('fixed_debts') \
        .select('*') \
        .eq('user_id', user_id) \
        .execute()

    debts = response.data
    if not debts:
        print(f"  → Sin gastos fijos para {display_name}.")
        return

    for debt in debts:
        due_day = debt.get('due_day')
        description = debt.get('description')   # la columna se llama 'description', no 'name'
        amount = debt.get('amount')
        last_notified = debt.get('last_notified_month')

        if not due_day:
            continue

        # No notificar dos veces el mismo mes
        if last_notified == current_month_str:
            print(f"  → '{description}' ya fue notificada este mes. Saltando.")
            continue

        # Calcular fecha de vencimiento para este mes
        try:
            _, last_day = calendar.monthrange(today.year, today.month)
            safe_due_day = min(due_day, last_day)
            due_date = datetime(today.year, today.month, safe_due_day)
        except ValueError as e:
            print(f"  → Error calculando fecha para '{description}': {e}")
            continue

        days_until_due = (due_date - today).days

        # Notificar si faltan 3 días o menos (incluye vencidos este mes)
        if days_until_due <= 3:
            if days_until_due == 0:
                estado = "🔥 VENCE HOY"
            elif days_until_due < 0:
                estado = f"⚠️ Venció hace {abs(days_until_due)} día(s)"
            else:
                estado = f"⏰ Faltan {days_until_due} día(s)"

            html_body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; color: #333; background: #f5f5f5; padding: 20px;">
                    <div style="max-width: 500px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">
                        <div style="background: #1a1a2e; padding: 24px; text-align: center;">
                            <h1 style="color: #c8f542; margin: 0; font-size: 28px;">🌱 RootCash</h1>
                            <p style="color: #aaa; margin: 6px 0 0; font-size: 14px;">Recordatorio de pago</p>
                        </div>
                        <div style="padding: 28px;">
                            <p style="font-size: 16px;">Hola <strong>{display_name}</strong> 👋,</p>
                            <p>Tu gasto fijo <strong>"{description}"</strong> por
                            <strong>${int(amount):,}</strong> está próximo a vencer.</p>
                            <div style="background: #f0f9e8; border-left: 4px solid #c8f542;
                                        padding: 14px 18px; border-radius: 6px; margin: 20px 0; font-size: 15px;">
                                <strong>Estado:</strong> {estado}
                            </div>
                            <p style="color: #555;">Entra a la app para registrar el pago y mantener tu presupuesto al día. 💚</p>
                        </div>
                        <div style="background: #f9f9f9; padding: 14px; text-align: center; font-size: 12px; color: #aaa;">
                            RootCash — Tus raíces financieras importan 🌱
                        </div>
                    </div>
                </body>
            </html>
            """

            print(f"  → Notificando a {display_name}: '{description}' ({estado})")
            send_email_notification(
                to_email=user_email,
                subject=f"RootCash — Pago de {description} próximo a vencer",
                body=html_body
            )

            # Marcar como notificado este mes para no re-enviar
            supabase.table('fixed_debts').update({
                'last_notified_month': current_month_str
            }).eq('id', debt['id']).execute()


def run():
    print(f"\n{'='*50}")
    print(f"🌱 RootCash Notificador — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*50}")

    supabase = init_supabase()

    # Obtener todos los usuarios desde la tabla profiles (tiene email, display_name e id)
    profiles_response = supabase.table('profiles').select('id, email, display_name').execute()
    users = profiles_response.data

    if not users:
        print("No hay usuarios registrados.")
        return

    print(f"Usuarios encontrados: {len(users)}\n")

    for user in users:
        user_id = user.get('id')
        user_email = user.get('email')
        display_name = user.get('display_name') or user_email

        print(f"👤 Revisando: {display_name} ({user_email})")
        check_debts_for_user(supabase, user_id, user_email, display_name)

    print(f"\n✅ Revisión completada.")


if __name__ == "__main__":
    run()
