"""
gmail_sync.py — Sincronización automática de gastos desde Gmail.

Lee correos de los remitentes configurados por cada usuario en email_sources,
extrae montos y descripciones, y los inserta como transacciones en RootCash.
Usa el Thread ID de Gmail para evitar duplicados cuando el mismo gasto llega
desde dos remitentes distintos (ej: noreply y notificaciones del mismo banco).

Ejecutar una vez al día (ej: 23:00) con el Programador de Tareas de Windows:
    python backend/gmail_sync.py
"""

import os
import base64
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import requests
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# Palabras clave para detectar transferencias internas entre cuentas propias
# Estos movimientos no son ni gasto ni ingreso real, solo un traspaso interno
INTERNAL_TRANSFER_KEYWORDS = [
    "transferencia entre cuentas",
    "traspaso entre cuentas",
    "transferencia propia",
    "entre mis cuentas",
    "cuenta propia",
    "transferencia interna",
    "traspaso a cuenta propia",
]

# Palabras clave para distinguir ingreso de gasto
INCOME_KEYWORDS = [
    "recibiste", "te enviaron", "depósito", "deposito",
    "abono", "recibido", "ingreso", "te han transferido",
]
EXPENSE_KEYWORDS = [
    "pagaste", "compraste", "débito", "debito", "cargo",
    "compra", "transferiste", "enviaste", "pago realizado",
]


def get_user_sources(supabase, user_id: str) -> list:
    """
    Obtiene los remitentes activos configurados por el usuario en email_sources.
    Retorna lista de dicts con sender_email y display_name.
    """
    result = supabase.table("email_sources") \
        .select("sender_email, display_name") \
        .eq("user_id", user_id) \
        .eq("is_active", True) \
        .execute()
    return result.data


def refresh_access_token(refresh_token: str) -> dict:
    """
    Pide un nuevo access_token a Google usando el refresh_token guardado.
    Los access_tokens duran 1 hora; el refresh_token dura indefinidamente.
    """
    response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
    )
    return response.json()


def get_emails(access_token: str, senders: list, since_hours: int = 25) -> list:
    """
    Busca correos de los remitentes dados en las últimas N horas.
    Retorna lista de mensajes con su contenido completo.
    """
    if not senders:
        return []

    # Construir query: "(from:a OR from:b) after:YYYY/MM/DD"
    query_parts = [f"from:{s}" for s in senders]
    query = f"({' OR '.join(query_parts)})"
    after_date = (datetime.now(timezone.utc) - timedelta(hours=since_hours)).strftime("%Y/%m/%d")
    query += f" after:{after_date}"

    headers = {"Authorization": f"Bearer {access_token}"}

    # 1. Obtener lista de IDs de mensajes
    list_res = requests.get(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages",
        headers=headers,
        params={"q": query, "maxResults": 50}
    )

    if list_res.status_code != 200:
        print(f"  Error buscando correos: {list_res.status_code}")
        return []

    messages = list_res.json().get("messages", [])

    # 2. Obtener contenido completo de cada mensaje
    emails = []
    for msg in messages:
        detail_res = requests.get(
            f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg['id']}",
            headers=headers,
            params={"format": "full"}
        )
        if detail_res.status_code == 200:
            emails.append(detail_res.json())

    return emails


def decode_email_body(payload: dict) -> str:
    """
    Decodifica el cuerpo del correo desde base64url.
    Prefiere texto plano sobre HTML para facilitar el parsing.
    """
    body = ""

    # Cuerpo directo (sin partes)
    if payload.get("body", {}).get("data"):
        body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="ignore")

    # Cuerpo con múltiples partes (multipart/alternative)
    elif payload.get("parts"):
        for part in payload["parts"]:
            if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
                body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="ignore")
                break  # Texto plano es suficiente y más fácil de parsear
            elif part.get("mimeType") == "text/html" and part.get("body", {}).get("data"):
                # Guardar HTML como fallback si no hay texto plano
                body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="ignore")

    return body


def is_internal_transfer(text: str) -> bool:
    """
    Detecta transferencias entre cuentas propias para ignorarlas.
    Estos movimientos no son gastos ni ingresos reales.
    """
    text_lower = text.lower()
    return any(kw in text_lower for kw in INTERNAL_TRANSFER_KEYWORDS)


def is_thread_processed(supabase, user_id: str, thread_id: str) -> bool:
    """
    Verifica si ya procesamos este hilo de Gmail.
    Cuando un banco envía el mismo comprobante desde noreply Y notificaciones,
    ambos correos comparten el mismo threadId → solo procesamos uno.
    """
    result = supabase.table("processed_emails") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("gmail_thread_id", thread_id) \
        .execute()
    return len(result.data) > 0


def mark_thread_processed(supabase, user_id: str, thread_id: str):
    """Registra un hilo de Gmail como ya procesado."""
    try:
        supabase.table("processed_emails").insert({
            "user_id": user_id,
            "gmail_thread_id": thread_id,
        }).execute()
    except Exception:
        pass  # Si ya existe (UNIQUE constraint), ignorar silenciosamente


def parse_transaction(email: dict) -> dict | None:
    """
    Intenta extraer datos de transacción de un correo.
    Retorna dict con: amount, type, description, date
    o None si no se encuentra un monto válido.
    """
    headers_dict = {h["name"]: h["value"] for h in email.get("payload", {}).get("headers", [])}
    subject = headers_dict.get("Subject", "")
    date_str = headers_dict.get("Date", "")

    body = decode_email_body(email.get("payload", {}))
    text = f"{subject} {body}"  # Buscar monto en asunto y cuerpo

    # --- Detectar monto ---
    # Patrones comunes en correos chilenos: $150.000 / CLP 150.000 / 150.000 pesos
    amount_patterns = [
        r'\$\s*([\d\.]+(?:,\d{2})?)',           # $150.000 o $150.000,00
        r'CLP\s*([\d\.]+(?:,\d{2})?)',           # CLP 150.000
        r'(\d{1,3}(?:\.\d{3})+)(?:\s*pesos?)?', # 150.000 pesos
    ]

    amount = None
    for pattern in amount_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            raw = match.group(1).replace(".", "").replace(",", ".")
            try:
                parsed = float(raw)
                if parsed > 100:  # Ignorar valores muy pequeños que no son montos reales
                    amount = parsed
                    break
            except ValueError:
                continue

    if not amount:
        return None  # Correo sin monto reconocible

    # --- Detectar tipo: gasto o ingreso ---
    text_lower = text.lower()
    transaction_type = "expense"  # Default: gasto
    if any(kw in text_lower for kw in INCOME_KEYWORDS):
        transaction_type = "income"
    elif any(kw in text_lower for kw in EXPENSE_KEYWORDS):
        transaction_type = "expense"

    # --- Descripción: usar el asunto del correo limpio ---
    description = re.sub(r'\s+', ' ', subject).strip()[:200] if subject else "Transacción automática"

    # --- Fecha del correo ---
    try:
        date = parsedate_to_datetime(date_str).date().isoformat()
    except Exception:
        date = datetime.now().date().isoformat()

    return {
        "amount": amount,
        "type": transaction_type,
        "description": description,
        "date": date,
    }


def transaction_exists(supabase, user_id: str, amount: float, date: str) -> bool:
    """
    Fallback de deduplicación: verifica si ya existe una transacción con
    el mismo monto y fecha. Cubre casos donde dos correos distintos sobre
    el mismo gasto tienen threadIds diferentes.
    """
    result = supabase.table("transactions") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("amount", amount) \
        .eq("date", date) \
        .execute()
    return len(result.data) > 0


def sync_account(supabase, account: dict) -> int:
    """
    Procesa una cuenta Gmail: refresca token, busca correos de los remitentes
    configurados por el usuario, parsea transacciones y las inserta.
    Retorna el número de transacciones nuevas creadas.
    """
    user_id = account["user_id"]
    email = account["email"]
    refresh_token = account["refresh_token"]
    access_token = account.get("access_token")
    expires_at_str = account.get("token_expires_at")

    print(f"\n  Cuenta: {email}")

    # Obtener remitentes configurados por este usuario
    sources = get_user_sources(supabase, user_id)
    if not sources:
        print("  Sin remitentes configurados. Saltando.")
        return 0

    senders = [s["sender_email"] for s in sources]
    print(f"  Monitoreando {len(senders)} remitente(s): {', '.join(senders)}")

    # Refrescar access_token si está por vencer (margen de 5 minutos)
    needs_refresh = True
    if expires_at_str and access_token:
        exp = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        if exp > datetime.now(timezone.utc) + timedelta(minutes=5):
            needs_refresh = False

    if needs_refresh:
        print("  Refrescando token de acceso...")
        token_data = refresh_access_token(refresh_token)
        if "access_token" not in token_data:
            print(f"  Error: {token_data.get('error_description', 'No se pudo refrescar el token')}")
            return 0

        access_token = token_data["access_token"]
        new_expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 3600))
        ).isoformat()

        # Actualizar token en la base de datos para la próxima ejecución
        supabase.table("connected_accounts").update({
            "access_token": access_token,
            "token_expires_at": new_expires_at,
        }).eq("id", account["id"]).execute()

    # Buscar correos de las últimas 25 horas (margen para ejecuciones diarias)
    emails = get_emails(access_token, senders=senders, since_hours=25)
    print(f"  Correos encontrados: {len(emails)}")

    created = 0
    for email_data in emails:
        thread_id = email_data.get("threadId", "")

        # Deduplicación primaria: saltar si ya procesamos este hilo
        # Cubre el caso noreply + notificaciones del mismo banco = mismo thread
        if thread_id and is_thread_processed(supabase, user_id, thread_id):
            print(f"  Hilo ya procesado ({thread_id[:10]}...). Saltando.")
            continue

        body = decode_email_body(email_data.get("payload", {}))
        headers_dict = {h["name"]: h["value"] for h in email_data.get("payload", {}).get("headers", [])}
        subject = headers_dict.get("Subject", "")
        full_text = f"{subject} {body}"

        # Ignorar transferencias internas entre cuentas propias
        if is_internal_transfer(full_text):
            print(f"  Transferencia interna ignorada: {subject[:60]}")
            if thread_id:
                mark_thread_processed(supabase, user_id, thread_id)
            continue

        transaction = parse_transaction(email_data)

        # Marcar el hilo como procesado aunque no tenga monto (evita reprocesarlo)
        if thread_id:
            mark_thread_processed(supabase, user_id, thread_id)

        if not transaction:
            continue  # Correo sin monto reconocible

        # Deduplicación secundaria: mismo monto y fecha ya registrados
        if transaction_exists(supabase, user_id, transaction["amount"], transaction["date"]):
            print(f"  Duplicado por monto/fecha ignorado: ${transaction['amount']:,.0f} el {transaction['date']}")
            continue

        # Insertar sin categoría — el usuario la asigna desde Movimientos
        supabase.table("transactions").insert({
            "user_id": user_id,
            "amount": transaction["amount"],
            "type": transaction["type"],
            "description": transaction["description"],
            "date": transaction["date"],
            "category_id": None,
        }).execute()

        print(f"  ✓ {transaction['type'].upper()} ${transaction['amount']:,.0f} — {transaction['description'][:60]}")
        created += 1

    return created


def run():
    """Punto de entrada. Lee todas las cuentas conectadas y las sincroniza."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Error: Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Iniciando sincronización de Gmail...")

    # Obtener todas las cuentas Gmail conectadas de todos los usuarios
    result = supabase.table("connected_accounts").select("*").execute()
    accounts = result.data

    if not accounts:
        print("No hay cuentas conectadas. Fin.")
        return

    print(f"Cuentas conectadas: {len(accounts)}")

    total_created = 0
    for account in accounts:
        try:
            created = sync_account(supabase, account)
            total_created += created
        except Exception as e:
            # Continuar con las demás cuentas aunque una falle
            print(f"  Error procesando {account.get('email', 'desconocido')}: {e}")

    print(f"\n{'─' * 40}")
    print(f"Total transacciones nuevas: {total_created}")
    print("Sincronización completada.")


if __name__ == "__main__":
    run()
