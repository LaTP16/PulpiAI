import os
from pathlib import Path
from app.core.config import settings, BASE_DIR
from app.services.transaction_service import TransactionService
from app.database.seed_data import DEMO_USER_ID


def _resolve_gemini_api_key() -> str:
    """Resolve GEMINI_API_KEY dynamically from env or .env files."""
    try:
        from dotenv import load_dotenv
        for env_candidate in (BASE_DIR / ".env", BASE_DIR.parent / ".env", Path.home() / ".env"):
            if env_candidate.exists():
                load_dotenv(env_candidate, override=True)
    except ImportError:
        pass
    return (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or settings.GEMINI_API_KEY
        or ""
    ).strip()


class AIService:
    @staticmethod
    def ask_assistant(question: str, user_id: str = DEMO_USER_ID) -> dict:
        summary = TransactionService.get_summary(user_id=user_id)
        transactions = TransactionService.get_transactions(user_id=user_id)[:12]
        record_days = len({tx.date for tx in transactions})
        credit_score = min(92, 35 + record_days * 6 + (25 if summary.balance > 0 else 0))

        recent_lines = "\n".join(
            f"- {tx.date} | {'Ingreso' if tx.type == 'income' else 'Gasto'} | {tx.category}: S/ {tx.amount:.2f} ({tx.description})"
            for tx in transactions
        )
        cat_lines = "\n".join(
            f"- {c.category} ({'Ingreso' if c.type == 'income' else 'Gasto'}): S/ {c.total:.2f}"
            for c in summary.categories
        )

        system_instruction = (
            "Eres PulpiAI, el asistente financiero inteligente para pequeños negocios informales y emprendedores en Perú "
            "(como bodegas, puestos de mercado y comercios locales). Tu objetivo es ayudar a digitalizar y ordenar sus "
            "ingresos y gastos para mejorar su salud financiera y facilitar su acceso al crédito formal.\n\n"
            f"Negocio actual: {settings.DEMO_USER_BUSINESS} (Propietaria: {settings.DEMO_USER_NAME})\n"
            f"Resumen financiero actual en tiempo real:\n"
            f"- Ingresos totales: S/ {summary.income:.2f}\n"
            f"- Gastos totales: S/ {summary.expense:.2f}\n"
            f"- Saldo neto disponible: S/ {summary.balance:.2f}\n"
            f"- Total de movimientos registrados: {summary.total_count}\n"
            f"- Puntaje de preparación crediticia: {credit_score}/100 ({record_days} días con registro activo)\n\n"
            f"Totales por categoría:\n{cat_lines or 'Sin categorías'}\n\n"
            f"Últimos movimientos:\n{recent_lines or 'Sin movimientos'}\n\n"
            "Reglas de respuesta:\n"
            "1. Responde en español, de forma cálida, clara, concisa (máximo 3-4 oraciones) y práctica.\n"
            "2. Usa siempre soles peruanos (S/) y cita los datos reales del negocio.\n"
            "3. Da consejos accionables para ordenar sus finanzas o mejorar su perfil crediticio."
        )

        api_key = _resolve_gemini_api_key()
        if api_key:
            from google import genai
            from google.genai import types

            client = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(timeout=10000),
            )
            models_to_try = [
                settings.GEMINI_MODEL or "gemini-3.5-flash-lite",
                "gemini-3.1-flash-lite",
                "gemini-3.8-flash",
            ]
            # Remove duplicates preserving order
            seen = set()
            ordered_models = [m for m in models_to_try if not (m in seen or seen.add(m))]

            for model_name in ordered_models:
                try:
                    interaction = client.interactions.create(
                        model=model_name,
                        system_instruction=system_instruction,
                        input=question,
                    )
                    if interaction and interaction.output_text:
                        return {
                            "answer": interaction.output_text.strip(),
                            "provider": "gemini",
                            "model": model_name,
                        }
                except Exception as exc:
                    print(f"[PulpiAI] Gemini model {model_name} warning: {exc}")

        # Contextual fallback when API key is not yet set or offline
        lower = question.lower()
        top_expense = next((c for c in summary.categories if c.type == "expense"), None)
        top_income = next((c for c in summary.categories if c.type == "income"), None)

        if "gast" in lower:
            top_cat = f" La categoría de mayor gasto es {top_expense.category} (S/ {top_expense.total:.2f})." if top_expense else ""
            answer = (
                f"Tus gastos registrados suman S/ {summary.expense:.2f}.{top_cat} "
                f"Te recomiendo separar tus gastos personales de los de {settings.DEMO_USER_BUSINESS} para cuidar tu liquidez."
            )
        elif "ingres" in lower or "vend" in lower or "venta" in lower:
            top_cat = f" Tu principal fuente es {top_income.category} (S/ {top_income.total:.2f})." if top_income else ""
            answer = (
                f"Tus ingresos registrados suman S/ {summary.income:.2f} y tu saldo neto disponible es S/ {summary.balance:.2f}.{top_cat}"
            )
        elif "crédito" in lower or "credito" in lower or "préstamo" in lower or "prestamo" in lower:
            answer = (
                f"Tienes un puntaje crediticio de {credit_score}/100 con un saldo positivo de S/ {summary.balance:.2f} "
                f"y {summary.total_count} movimientos registrados. Mantener registros diarios por voz o foto de tus boletas fortalecerá tu evaluación ante entidades financieras."
            )
        else:
            answer = (
                f"Hola {settings.DEMO_USER_NAME.split()[0]}, en {settings.DEMO_USER_BUSINESS} tienes un saldo disponible de "
                f"S/ {summary.balance:.2f} (Ingresos: S/ {summary.income:.2f} | Gastos: S/ {summary.expense:.2f}) "
                f"en {summary.total_count} movimientos. ¿Te gustaría analizar tus gastos, tus ventas o tu preparación para el crédito?"
            )

        return {
            "answer": answer,
            "provider": "local_fallback",
            "model": "pulpi-contextual",
        }
