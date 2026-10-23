import re
import unicodedata
from datetime import datetime
from typing import Dict, Tuple, Optional
from app.schemas.voice import VoiceParseResponse, MovementType

SPANISH_UNITS = {
    "cero": 0, "un": 1, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4,
    "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10,
    "once": 11, "doce": 12, "trece": 13, "catorce": 14, "quince": 15,
    "dieciseis": 16, "dieciséis": 16, "diecisiete": 17, "dieciocho": 18, "diecinueve": 19,
    "veinte": 20, "veintiun": 21, "veintiuno": 21, "veintiuna": 21, "veintidos": 22, "veintidós": 22,
    "veintitres": 23, "veintitrés": 23, "veinticuatro": 24, "veinticinco": 25,
    "veintiseis": 26, "veintiséis": 26, "veintisiete": 27, "veintiocho": 28, "veintinueve": 29
}

SPANISH_TENS = {
    "diez": 10, "veinte": 20, "treinta": 30, "cuarenta": 40, "cincuenta": 50,
    "sesenta": 60, "setenta": 70, "ochenta": 80, "noventa": 90
}

SPANISH_HUNDREDS = {
    "cien": 100, "ciento": 100, "doscientos": 200, "trescientos": 300,
    "cuatrocientos": 400, "quinientos": 500, "seiscientos": 600,
    "setecientos": 700, "ochocientos": 800, "novecientos": 900
}

def remove_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )

def parse_spanish_words_to_number(words_str: str) -> Optional[float]:
    """Parse text representation of Spanish numbers (e.g. 'mil quinientos', 'veinticinco')."""
    words = [w for w in words_str.strip().split() if w and w != "y"]
    if not words:
        return None

    total = 0.0
    current = 0.0

    for word in words:
        norm = remove_accents(word.lower())
        if norm in SPANISH_UNITS:
            current += SPANISH_UNITS[norm]
        elif norm in SPANISH_TENS:
            current += SPANISH_TENS[norm]
        elif norm in SPANISH_HUNDREDS:
            current += SPANISH_HUNDREDS[norm]
        elif norm == "mil":
            current = 1 if current == 0 else current
            total += current * 1000
            current = 0
        elif norm in ("millon", "millones"):
            current = 1 if current == 0 else current
            total += current * 1_000_000
            current = 0
        elif norm == "medio":
            current += 0.5
        elif norm.isdigit():
            current += float(norm)
        else:
            return None

    return total + current

class VoiceService:
    @staticmethod
    def extract_amount_and_currency(text: str) -> Tuple[float, str, float]:
        """
        Extract numerical amount and currency from transcript.
        Returns: (amount, currency, confidence)
        """
        raw_clean = text.lower()
        norm = remove_accents(raw_clean)

        # Detect currency
        currency = "PEN"
        if re.search(r"\b(dolar|dolares|usd|\$|us\$)\b", norm):
            currency = "USD"

        # 1. Look for explicit pattern: "<num> soles con <num> centimos"
        # e.g., "12 soles con 50 centimos" or "doce soles con 50 centimos"
        cents_match = re.search(
            r"(\b[\w\s\d]+?)\s*soles?\s*con\s*([\w\s\d]+?)\s*(?:centimos?|ctvs?|centavos?)",
            norm
        )
        if cents_match:
            main_part = cents_match.group(1).strip()
            cents_part = cents_match.group(2).strip()

            main_val = None
            if re.search(r"\d+", main_part):
                num_match = re.search(r"(\d+(?:[.,]\d+)?)", main_part)
                if num_match:
                    main_val = float(num_match.group(1).replace(",", "."))
            else:
                main_val = parse_spanish_words_to_number(main_part)

            cents_val = None
            if re.search(r"\d+", cents_part):
                num_match = re.search(r"(\d+)", cents_part)
                if num_match:
                    cents_val = float(num_match.group(1))
            else:
                cents_val = parse_spanish_words_to_number(cents_part)

            if main_val is not None and cents_val is not None:
                amount = round(main_val + (cents_val / 100.0), 2)
                return amount, currency, 0.98

        # 2. Look for numeric amounts with currency or indicator:
        # e.g., "por 49.90 soles", "25 soles", "s/ 1,500.00", "s/. 25", "1500 soles"
        num_with_currency = re.findall(
            r"(?:s\/?\.?\s*|\$|pen\s*|us\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:soles?|dolares?|pesos?|pen|usd|\$)?",
            norm
        )

        # Specifically look for amounts preceded or followed by currency words or prepositions
        targeted_matches = re.findall(
            r"(?:(?:por|de|pague|gaste|cobre|recibi|ingrese|fueron|importe|monto|total)\s+(?:de\s+)?)?(?:s\/?\.?\s*|\$|pen\s*)?(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:soles?|dolares?|pen|usd)",
            norm
        )
        if targeted_matches:
            # Pick the targeted amount
            for val_str in targeted_matches:
                val = float(val_str.replace(",", "."))
                # Skip if this is a calendar year like 2024, 2025, 2026 or a day
                if val > 0:
                    return val, currency, 0.95

        # 3. Look for written numbers associated with currency:
        # e.g. "veinticinco soles", "mil quinientos soles", "trescientos soles"
        words_currency_match = re.search(
            r"([a-z\s]+?)\s+(?:soles?|dolares?|pen|usd)",
            norm
        )
        if words_currency_match:
            candidate_words = words_currency_match.group(1).strip()
            # Take last 1-4 words before "soles"
            word_list = candidate_words.split()
            for start_idx in range(max(0, len(word_list) - 4), len(word_list)):
                chunk = " ".join(word_list[start_idx:])
                parsed_num = parse_spanish_words_to_number(chunk)
                if parsed_num and parsed_num > 0:
                    return parsed_num, currency, 0.92

        # 4. Fallback: standard number extraction, avoiding obvious dates or quantities
        # E.g. "compre 3 libros por 20" -> notice "por 20" has "por"
        por_num = re.search(r"\bpor\s+(\d+(?:[.,]\d{1,2})?)", norm)
        if por_num:
            return float(por_num.group(1).replace(",", ".")), currency, 0.90

        # General decimal numbers (e.g. 49.90, 25.50)
        decimals = re.findall(r"\b(\d+[.,]\d{1,2})\b", norm)
        if decimals:
            return float(decimals[-1].replace(",", ".")), currency, 0.85

        # Lone integer if it's the only one or prominent
        integers = [float(x) for x in re.findall(r"\b\d+\b", norm)]
        # Filter out numbers that look like dates (1..31 if followed by month) or years (2020..2030)
        filtered_integers = [x for x in integers if not (2020 <= x <= 2030)]
        if filtered_integers:
            return filtered_integers[-1], currency, 0.80

        # Try to parse any written numbers in the whole sentence
        all_words = norm.split()
        for i in range(len(all_words)):
            for j in range(i + 1, min(i + 5, len(all_words) + 1)):
                chunk = " ".join(all_words[i:j])
                val = parse_spanish_words_to_number(chunk)
                if val and val > 0:
                    return val, currency, 0.75

        return 0.0, currency, 0.0

    @staticmethod
    def detect_operation_type(text: str) -> Tuple[MovementType, float]:
        """Detect whether the operation is an income or expense."""
        norm = remove_accents(text.lower())

        income_keywords = [
            "recibi", "recibo", "cobre", "cobro", "me depositaron", "depositaron",
            "ingrese", "ingreso", "ingresos", "vendi", "venta", "ventas",
            "gane", "ganancia", "abono", "sueldo", "salario", "quincena",
            "me transfirieron", "transfirieron a mi", "me pagaron", "remuneracion"
        ]

        expense_keywords = [
            "gaste", "gasto", "gastos", "compre", "compra", "compras",
            "pague", "pago", "pagos", "salio", "salida", "egreso", "egresos",
            "consumi", "consumo", "costo", "cuesta", "costo de", "desembolso"
        ]

        income_score = sum(1 for kw in income_keywords if re.search(r"\b" + kw + r"\b", norm))
        expense_score = sum(1 for kw in expense_keywords if re.search(r"\b" + kw + r"\b", norm))

        # Contextual boosts
        if "sueldo" in norm or "trabajo independiente" in norm:
            income_score += 2
        if "almuerzo" in norm or "transporte" in norm or "libro" in norm or "mercaderia" in norm:
            expense_score += 1

        if income_score > expense_score:
            return "income", 0.95
        elif expense_score > income_score:
            return "expense", 0.95
        else:
            # Default fallback: check simple matches
            if any(k in norm for k in ["gaste", "compre", "pague"]):
                return "expense", 0.85
            if any(k in norm for k in ["recibi", "cobre", "ingrese"]):
                return "income", 0.85
            return "expense", 0.50  # low confidence default

    @staticmethod
    def suggest_category(text: str, movement_type: MovementType) -> str:
        """Suggest appropriate category based on keywords."""
        norm = remove_accents(text.lower())

        if movement_type == "income":
            if any(k in norm for k in ["sueldo", "salario", "quincena", "empleo"]):
                return "Sueldo"
            if any(k in norm for k in ["independiente", "freelance", "cachuelo", "asesoria", "servicio prestado", "proyecto"]):
                return "Trabajos independientes"
            if any(k in norm for k in ["venta", "vendi", "tienda", "bodega", "abarrotes", "pedido", "producto"]):
                return "Ventas"
            return "Otros ingresos"
        else:
            if any(k in norm for k in ["almuerzo", "desayuno", "cena", "comida", "menu", "restaurante", "snack", "pan"]):
                return "Alimentación"
            if any(k in norm for k in ["transporte", "pasaje", "taxi", "bus", "micro", "gasolina", "combustible", "peaje", "colectivo"]):
                return "Transporte"
            if any(k in norm for k in ["luz", "agua", "internet", "telefono", "celular", "recibo", "servicio", "alquiler"]):
                return "Servicios"
            if any(k in norm for k in ["libro", "cuaderno", "ropa", "zapato", "compras", "tienda", "mercaderia", "mercancia"]):
                return "Compras" if "libro" in norm or "ropa" in norm else "Mercadería"
            if any(k in norm for k in ["cine", "pelicula", "paseo", "salida", "fiesta", "juego", "entretenimiento", "diversion"]):
                return "Entretenimiento"
            return "Otros gastos"

    @staticmethod
    def extract_clean_description(text: str, category: str) -> str:
        """Create a clean description from the spoken text."""
        cleaned = text.strip()
        # Capitalize first letter
        if cleaned:
            cleaned = cleaned[0].upper() + cleaned[1:]
        return cleaned

    @classmethod
    def parse_transcript(cls, text: str) -> VoiceParseResponse:
        """Full pipeline for parsing a spoken voice transcript."""
        cleaned_text = text.strip()
        op_type, type_confidence = cls.detect_operation_type(cleaned_text)
        amount, currency, amount_confidence = cls.extract_amount_and_currency(cleaned_text)
        category = cls.suggest_category(cleaned_text, op_type)
        description = cls.extract_clean_description(cleaned_text, category)
        today = datetime.now().strftime("%Y-%m-%d")

        # Confidence assessment
        overall_confidence = round(min(type_confidence, amount_confidence), 2)
        needs_confirmation = False

        if amount <= 0:
            overall_confidence = 0.3
            needs_confirmation = True
            explanation = "No se detectó un monto claro en la frase. Por favor ingresa el monto manualmente."
        elif overall_confidence < 0.70:
            needs_confirmation = True
            explanation = f"Se detectó un monto de {currency} {amount:.2f}, pero se solicita confirmar los datos."
        else:
            explanation = f"Operación de {op_type} identificada exitosamente por {currency} {amount:.2f}."

        return VoiceParseResponse(
            type=op_type,
            amount=amount,
            currency=currency,
            description=description,
            category=category,
            date=today,
            confidence=overall_confidence,
            needs_confirmation=needs_confirmation,
            explanation=explanation
        )
