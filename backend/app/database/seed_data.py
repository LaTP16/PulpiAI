import uuid
from datetime import datetime, timedelta
from app.core.config import settings
from app.core.security import hash_password
from app.database.session import get_db

DEMO_USER_ID = "demo-user-maria-001"

def get_iso_date(days_ago: int = 0) -> str:
    return (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")

def seed_demo_data_if_needed():
    """Ensure test user and coherent demo transactions exist without duplicating."""
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Check or create test user
        cursor.execute("SELECT * FROM users WHERE email = ? OR id = ?", (settings.DEMO_USER_EMAIL, DEMO_USER_ID))
        user = cursor.fetchone()

        if not user:
            pw_hash = hash_password(settings.DEMO_USER_PASSWORD)
            cursor.execute(
                """
                INSERT INTO users (id, name, email, phone, business_name, password_hash, is_demo)
                VALUES (?, ?, ?, ?, ?, ?, 1)
                """,
                (
                    DEMO_USER_ID,
                    settings.DEMO_USER_NAME,
                    settings.DEMO_USER_EMAIL,
                    settings.DEMO_USER_PHONE,
                    settings.DEMO_USER_BUSINESS,
                    pw_hash,
                )
            )
            user_id = DEMO_USER_ID
        else:
            user_id = user["id"]

        # 2. Check if user already has transactions
        cursor.execute("SELECT COUNT(*) as count FROM transactions WHERE user_id = ?", (user_id,))
        count_row = cursor.fetchone()
        if count_row and count_row["count"] > 0:
            # Data already exists, do NOT duplicate
            return

        # 3. Seed coherent demo transactions across the last 6 days to populate charts and balances
        # Incomes: Sueldo, Trabajos independientes, Ventas
        # Expenses: Alimentación, Transporte, Mercadería, Servicios, Entretenimiento
        demo_transactions = [
            # Incomes
            {
                "type": "income",
                "amount": 1500.00,
                "category": "Sueldo",
                "description": "Pago de sueldo quincenal",
                "date": get_iso_date(6),
                "source": "manual",
            },
            {
                "type": "income",
                "amount": 420.00,
                "category": "Ventas",
                "description": "Venta de abarrotes y bebidas del día",
                "date": get_iso_date(5),
                "source": "manual",
            },
            {
                "type": "income",
                "amount": 300.00,
                "category": "Trabajos independientes",
                "description": "Ingreso por trabajo independiente de asesoría",
                "date": get_iso_date(3),
                "source": "voice",
            },
            {
                "type": "income",
                "amount": 550.00,
                "category": "Ventas",
                "description": "Venta de mercadería fin de semana",
                "date": get_iso_date(1),
                "source": "manual",
            },
            {
                "type": "income",
                "amount": 280.00,
                "category": "Otros ingresos",
                "description": "Abono por pedido especial de víveres",
                "date": get_iso_date(0),
                "source": "whatsapp",
            },

            # Expenses
            {
                "type": "expense",
                "amount": 320.00,
                "category": "Mercadería",
                "description": "Compra de lácteos y embutidos para tienda",
                "date": get_iso_date(6),
                "source": "ocr",
            },
            {
                "type": "expense",
                "amount": 25.00,
                "category": "Alimentación",
                "description": "Almuerzo menú ejecutivo",
                "date": get_iso_date(5),
                "source": "voice",
            },
            {
                "type": "expense",
                "amount": 12.50,
                "category": "Transporte",
                "description": "Pasaje y taxi para abastecimiento",
                "date": get_iso_date(4),
                "source": "voice",
            },
            {
                "type": "expense",
                "amount": 115.00,
                "category": "Servicios",
                "description": "Pago de servicio de luz comercial",
                "date": get_iso_date(3),
                "source": "ocr",
            },
            {
                "type": "expense",
                "amount": 49.90,
                "category": "Compras",
                "description": "Compra de libro de administración de negocios",
                "date": get_iso_date(2),
                "source": "voice",
            },
            {
                "type": "expense",
                "amount": 65.00,
                "category": "Entretenimiento",
                "description": "Salida familiar de fin de semana",
                "date": get_iso_date(1),
                "source": "manual",
            },
            {
                "type": "expense",
                "amount": 180.00,
                "category": "Mercadería",
                "description": "Reposición de bebidas y snacks",
                "date": get_iso_date(0),
                "source": "manual",
            },
        ]

        for tx in demo_transactions:
            cursor.execute(
                """
                INSERT INTO transactions (id, user_id, type, amount, category, description, date, currency, source, is_demo)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'PEN', ?, 1)
                """,
                (
                    f"demo-tx-{uuid.uuid4().hex[:8]}",
                    user_id,
                    tx["type"],
                    tx["amount"],
                    tx["category"],
                    tx["description"],
                    tx["date"],
                    tx["source"],
                )
            )
