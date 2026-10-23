import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from app.database.session import get_db
from app.schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionSummary,
    WeeklyDay,
    CategoryTotal
)

class TransactionService:
    @staticmethod
    def get_transactions(
        user_id: str,
        type_filter: Optional[str] = None,
        category_filter: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None
    ) -> List[TransactionResponse]:
        query = "SELECT * FROM transactions WHERE user_id = ?"
        params = [user_id]

        if type_filter and type_filter != "all":
            query += " AND type = ?"
            params.append(type_filter)

        if category_filter and category_filter != "all":
            query += " AND category = ?"
            params.append(category_filter)

        if from_date:
            query += " AND date >= ?"
            params.append(from_date)

        if to_date:
            query += " AND date <= ?"
            params.append(to_date)

        query += " ORDER BY date DESC, created_at DESC"

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [
                TransactionResponse(
                    id=r["id"],
                    user_id=r["user_id"],
                    type=r["type"],
                    amount=r["amount"],
                    category=r["category"],
                    description=r["description"],
                    date=r["date"],
                    currency=r["currency"],
                    source=r["source"],
                    is_demo=bool(r["is_demo"]),
                    created_at=str(r["created_at"])
                )
                for r in rows
            ]

    @staticmethod
    def get_transaction_by_id(tx_id: str, user_id: str) -> Optional[TransactionResponse]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM transactions WHERE id = ? AND user_id = ?", (tx_id, user_id))
            r = cursor.fetchone()
            if not r:
                return None
            return TransactionResponse(
                id=r["id"],
                user_id=r["user_id"],
                type=r["type"],
                amount=r["amount"],
                category=r["category"],
                description=r["description"],
                date=r["date"],
                currency=r["currency"],
                source=r["source"],
                is_demo=bool(r["is_demo"]),
                created_at=str(r["created_at"])
            )

    @staticmethod
    def create_transaction(user_id: str, data: TransactionCreate) -> TransactionResponse:
        tx_id = f"tx-{uuid.uuid4().hex[:12]}"
        now = datetime.now().isoformat()
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO transactions (id, user_id, type, amount, category, description, date, currency, source, is_demo, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tx_id,
                    user_id,
                    data.type,
                    data.amount,
                    data.category,
                    data.description.strip(),
                    data.date,
                    data.currency,
                    data.source or "manual",
                    1 if data.is_demo else 0,
                    now
                )
            )

        return TransactionResponse(
            id=tx_id,
            user_id=user_id,
            type=data.type,
            amount=data.amount,
            category=data.category,
            description=data.description.strip(),
            date=data.date,
            currency=data.currency,
            source=data.source or "manual",
            is_demo=data.is_demo or False,
            created_at=now
        )

    @staticmethod
    def update_transaction(tx_id: str, user_id: str, data: TransactionUpdate) -> Optional[TransactionResponse]:
        existing = TransactionService.get_transaction_by_id(tx_id, user_id)
        if not existing:
            return None

        new_type = data.type if data.type is not None else existing.type
        new_amount = data.amount if data.amount is not None else existing.amount
        new_category = data.category if data.category is not None else existing.category
        new_description = data.description.strip() if data.description is not None else existing.description
        new_date = data.date if data.date is not None else existing.date
        new_currency = data.currency if data.currency is not None else existing.currency

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE transactions
                SET type = ?, amount = ?, category = ?, description = ?, date = ?, currency = ?
                WHERE id = ? AND user_id = ?
                """,
                (new_type, new_amount, new_category, new_description, new_date, new_currency, tx_id, user_id)
            )

        return TransactionResponse(
            id=tx_id,
            user_id=user_id,
            type=new_type,
            amount=new_amount,
            category=new_category,
            description=new_description,
            date=new_date,
            currency=new_currency,
            source=existing.source,
            is_demo=existing.is_demo,
            created_at=existing.created_at
        )

    @staticmethod
    def delete_transaction(tx_id: str, user_id: str) -> bool:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM transactions WHERE id = ? AND user_id = ?", (tx_id, user_id))
            return cursor.rowcount > 0

    @staticmethod
    def get_summary(user_id: str) -> TransactionSummary:
        """Calculate total income, expense, balance, weekly days, and category breakdowns."""
        with get_db() as conn:
            cursor = conn.cursor()

            # Totals
            cursor.execute(
                """
                SELECT 
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
                    COUNT(*) as total_count
                FROM transactions
                WHERE user_id = ?
                """,
                (user_id,)
            )
            totals_row = cursor.fetchone()
            total_income = round(totals_row["total_income"], 2)
            total_expense = round(totals_row["total_expense"], 2)
            total_count = totals_row["total_count"]
            balance = round(total_income - total_expense, 2)

            # Weekly (last 7 days from today)
            days = []
            today = datetime.now()
            spanish_days = ["lu", "ma", "mi", "ju", "vi", "sá", "do"]

            for i in range(6, -1, -1):
                day_dt = today - timedelta(days=i)
                date_str = day_dt.strftime("%Y-%m-%d")
                weekday_idx = day_dt.weekday()
                label = spanish_days[weekday_idx]

                cursor.execute(
                    """
                    SELECT 
                        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as day_income,
                        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as day_expense
                    FROM transactions
                    WHERE user_id = ? AND date = ?
                    """,
                    (user_id, date_str)
                )
                day_row = cursor.fetchone()
                days.append(WeeklyDay(
                    label=label,
                    date=date_str,
                    income=round(day_row["day_income"], 2),
                    expense=round(day_row["day_expense"], 2)
                ))

            # Category totals
            cursor.execute(
                """
                SELECT category, type, SUM(amount) as cat_total
                FROM transactions
                WHERE user_id = ?
                GROUP BY category, type
                ORDER BY cat_total DESC
                """,
                (user_id,)
            )
            cat_rows = cursor.fetchall()
            categories = [
                CategoryTotal(
                    category=r["category"],
                    total=round(r["cat_total"], 2),
                    type=r["type"]
                )
                for r in cat_rows
            ]

        return TransactionSummary(
            income=total_income,
            expense=total_expense,
            balance=balance,
            total_count=total_count,
            weekly=days,
            categories=categories
        )
