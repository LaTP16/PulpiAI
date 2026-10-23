import re
import io
import unicodedata
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from PIL import Image, ImageEnhance, ImageOps, ImageFilter

from app.schemas.ocr import OCRParseResponse, DocumentType, OperationType, CandidateAmount

# Try importing RapidOCR
try:
    from rapidocr_onnxruntime import RapidOCR
    rapid_ocr_engine = RapidOCR()
except Exception:
    rapid_ocr_engine = None

def remove_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )

def parse_financial_number(raw_str: str) -> Optional[float]:
    """
    Parse a numeric string from receipts/vouchers accurately handling
    both formats: 1,250.50 and 1.250,50 as well as 25.00 and 25,00.
    """
    s = raw_str.strip()
    # Remove currency prefixes and trailing characters
    s = re.sub(r"^[^\d]+", "", s)
    s = re.sub(r"[^\d]+$", "", s)

    if not s:
        return None

    # Both dot and comma present
    if "." in s and "," in s:
        dot_idx = s.rfind(".")
        comma_idx = s.rfind(",")
        if dot_idx > comma_idx:
            # 1,250.50 format (comma is thousand, dot is decimal)
            clean = s.replace(",", "")
            try:
                return float(clean)
            except ValueError:
                return None
        else:
            # 1.250,50 format (dot is thousand, comma is decimal)
            clean = s.replace(".", "").replace(",", ".")
            try:
                return float(clean)
            except ValueError:
                return None

    # Only comma present
    if "," in s:
        parts = s.split(",")
        if len(parts) == 2 and len(parts[1]) <= 2:
            # Decimal comma: 25,00 or 12,5
            clean = s.replace(",", ".")
            try:
                return float(clean)
            except ValueError:
                return None
        else:
            # Thousand separator: 1,000 -> 1000
            clean = s.replace(",", "")
            try:
                return float(clean)
            except ValueError:
                return None

    # Only dot present
    if "." in s:
        parts = s.split(".")
        if len(parts) == 2 and len(parts[1]) <= 2:
            # Decimal dot: 25.00
            try:
                return float(s)
            except ValueError:
                return None
        else:
            # Thousand separator: 1.000 -> 1000
            clean = s.replace(".", "")
            try:
                return float(clean)
            except ValueError:
                return None

    # Plain integer
    try:
        return float(s)
    except ValueError:
        return None

class OCRService:
    @staticmethod
    def preprocess_image(image_bytes: bytes) -> Image.Image:
        """Apply orientation correction, contrast enhancement and sharpness."""
        img = Image.open(io.BytesIO(image_bytes))

        # 1. EXIF orientation correction
        img = ImageOps.exif_transpose(img)

        # 2. Convert to RGB
        if img.mode != "RGB":
            img = img.convert("RGB")

        # 3. Enhance contrast
        contrast_enhancer = ImageEnhance.Contrast(img)
        img = contrast_enhancer.enhance(1.4)

        # 4. Enhance sharpness
        sharpness_enhancer = ImageEnhance.Sharpness(img)
        img = sharpness_enhancer.enhance(1.3)

        return img

    @classmethod
    def run_ocr(cls, image_bytes: bytes) -> str:
        """Execute OCR on preprocessed image and return recognized text."""
        preprocessed = cls.preprocess_image(image_bytes)

        if rapid_ocr_engine:
            # Convert PIL image to byte array or numpy
            img_byte_arr = io.BytesIO()
            preprocessed.save(img_byte_arr, format="PNG")
            ocr_result, _ = rapid_ocr_engine(img_byte_arr.getvalue())
            if ocr_result:
                lines = [item[1] for item in ocr_result if item and len(item) > 1]
                return "\n".join(lines)

        return ""

    @staticmethod
    def classify_document(text: str) -> Tuple[DocumentType, str, float]:
        """
        Classify document based on financial semantics and keywords.
        Returns: (DocumentType, label, confidence)
        """
        norm = remove_accents(text.lower())

        # Signals for Boleta / Factura
        invoice_signals = [
            "boleta de venta", "factura", "factura electronica", "boleta electronica",
            "ruc", "subtotal", "sub total", "igv", "op. gravada", "op gravada",
            "cajero", "ticket", "serie", "nro comprobante", "item", "cantidad"
        ]
        invoice_score = sum(2 for s in invoice_signals if s in norm)

        # Signals for Payment Voucher / Transfers
        voucher_signals = [
            "voucher", "constancia", "constancia de pago", "transferencia", "operacion",
            "nro de operacion", "yape", "plin", "bcp", "bbva", "interbank", "scotiabank",
            "banco de la nacion", "tarjeta", "visa", "mastercard", "pos", "terminal",
            "lote", "referencia", "autorizacion", "pagado exitosamente"
        ]
        voucher_score = sum(2 for s in voucher_signals if s in norm)

        # Signals for Received Money
        income_signals = [
            "abono en cuenta", "deposito recibido", "transferencia recibida", "te transfirio",
            "te envio", "recibiste un yape", "recibiste un plin", "abono realizado a tu favor",
            "pago recibido", "constancia de abono", "monto acreditado", "deposito exitoso a favor"
        ]
        income_score = sum(3 for s in income_signals if s in norm)

        # Signals for Mobile Financial App Screenshot
        app_signals = [
            "yapeaste", "yapé", "yape", "plin", "banca movil", "app bcp", "app bbva",
            "enviar dinero", "recibir dinero", "billetera digital", "saldo en cuenta"
        ]
        app_score = sum(1.5 for s in app_signals if s in norm)

        # Non-financial indicators: selfies, landscapes, general notes, books, chat without money
        non_financial_words = [
            "selfie", "paisaje", "foto", "retrato", "meme", "historia", "capitulo",
            "indice", "prologo", "poema", "parrafo", "novela", "articulo", "resumen ejecutivo"
        ]
        non_financial_score = sum(2 for s in non_financial_words if s in norm)

        total_financial_score = invoice_score + voucher_score + income_score + app_score

        # If very little or no financial signals, it's non-financial
        if total_financial_score < 2:
            return "imagen_no_financiera", "Imagen no financiera", 0.90

        # Prioritize Income confirmation
        if income_score >= 3 and income_score > voucher_score:
            return "comprobante_ingreso", "Comprobante de ingreso", 0.92

        if invoice_score > voucher_score and invoice_score > app_score:
            return "boleta_factura", "Boleta o factura de compra", 0.90

        if app_score > voucher_score and ("yapeaste" in norm or "plin" in norm):
            return "captura_financiera", "Captura de billetera digital", 0.88

        return "voucher_pago", "Voucher de pago o transferencia", 0.88

    @classmethod
    def extract_amounts_with_scoring(cls, text: str) -> List[CandidateAmount]:
        """
        Extract all candidate amounts with priority scoring.
        Prioritizes TOTAL / TOTAL A PAGAR / MONTO PAGADO over table item lines, subtotal, IGV, etc.
        """
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        candidates: List[CandidateAmount] = []

        # High-priority total patterns (matched on current line)
        direct_total_patterns = [
            r"\btotal\s*a\s*pagar\b",
            r"\bimporte\s*total\b",
            r"\btotal\s*general\b",
            r"\btotal\s*venta\b",
            r"\bmonto\s*pagado\b",
            r"\bmonto\s*transferido\b",
            r"\bimporte\s*de\s*la\s*operacion\b",
            r"\bimporte\s*operacion\b",
            r"\bmonto\s*total\b",
            r"\byapeaste\b",
            r"\bte\s*transfirio\b",
            r"\btotal\s*:\s*",
            r"\btotal\s+s\/",
            r"\bmonto\s*:\s*",
            r"\bimporte\s*:\s*",
            r"\babono\s*:\s*"
        ]

        # Low-priority / penalty labels
        penalty_labels = [
            r"\bsubtotal\b",
            r"\bsub\s*total\b",
            r"\bigv\b",
            r"\bop\.\s*gravada\b",
            r"\bop\s*inafecta\b",
            r"\bop\s*exonerada\b",
            r"\bvuelto\b",
            r"\bcambio\b",
            r"\bredondeo\b",
            r"\bdescuento\b",
            r"\bsaldo\s*anterior\b",
            r"\bsaldo\s*disponible\b",
            r"\bcomision\b",
            r"\bpropina\b",
            r"\bcelular\b",
            r"\btelefono\b",
            r"\bhora\b",
            r"\bfecha\b",
            r"\boperacion\s*n\b",
            r"\btransaccion\b",
            r"\bcuenta\b",
            r"\bcantidad\b",
            r"\bcant\b"
        ]

        # Table header pattern (e.g. ITEM CANT DESCRIPCION TOTAL)
        table_header_pattern = re.compile(r"\b(item|cant|codigo|descr|precio|p\.u\.)\b", re.I)

        number_pattern = re.compile(
            r"(?:s\/?\.?\s*|\$|pen\s*|us\$\s*)?([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,2})|[0-9]+[.,][0-9]{1,2})"
        )

        for i, line in enumerate(lines):
            norm_line = remove_accents(line.lower())

            # Skip lines that are purely table headers
            if table_header_pattern.search(norm_line) and not re.search(r"\d{2,}", norm_line):
                continue

            matches = list(number_pattern.finditer(line))

            for match in matches:
                num_str = match.group(1)
                val = parse_financial_number(num_str)
                if val is None or val <= 0:
                    continue

                # Filter out years / dates / large account numbers
                if 1990 <= val <= 2035 and "." not in num_str and "," not in num_str:
                    continue
                if val > 500000:
                    continue

                score = 40.0

                # 1. Direct label in the SAME line
                has_direct_total = False
                for dt_pat in direct_total_patterns:
                    if re.search(dt_pat, norm_line):
                        score += 80.0
                        has_direct_total = True
                        break

                # 2. Check if the line above is a direct label without being a table header
                if not has_direct_total and i > 0:
                    prev_line = remove_accents(lines[i - 1].lower())
                    if not table_header_pattern.search(prev_line):
                        for dt_pat in direct_total_patterns:
                            if re.search(dt_pat, prev_line):
                                score += 50.0
                                break

                # 3. Penalties
                for p_label in penalty_labels:
                    if re.search(p_label, norm_line):
                        score -= 60.0
                        break

                # 4. If line contains "S/" or currency symbol
                if re.search(r"s\/?\.?|\$|pen", line, re.IGNORECASE):
                    score += 15.0

                # 5. Position bonus: grand totals in receipts usually appear in the lower half
                position_ratio = i / max(1, len(lines) - 1)
                score += position_ratio * 15.0

                candidates.append(CandidateAmount(
                    label=line[:50],
                    amount=val,
                    confidence_score=round(max(0.05, min(0.99, score / 120.0)), 2)
                ))

        # Sort by confidence score descending, then by line index descending (bottom totals win ties)
        candidates.sort(key=lambda c: c.confidence_score, reverse=True)
        return candidates

    @staticmethod
    def determine_operation_direction(doc_type: DocumentType, text: str) -> Tuple[OperationType, bool, str]:
        """
        Determine if the transaction is Income or Expense.
        Returns: (operation_type, is_internal_transfer, explanation)
        """
        if doc_type == "imagen_no_financiera":
            return "none", False, "El documento no corresponde a una transacción financiera."

        norm = remove_accents(text.lower())

        # Check for transfer between own accounts
        if any(term in norm for term in ["cuentas propias", "misma cuenta", "entre mis cuentas", "cuenta propia"]):
            return "expense", True, "Detectada posible transferencia entre cuentas propias. Se recomienda verificar para no duplicar."

        # Income signals
        income_signals = [
            "te transfirio", "te envio", "abono en cuenta", "deposito recibido",
            "recibiste un yape", "recibiste un plin", "monto acreditado",
            "pago recibido", "constancia de abono", "transferencia recibida"
        ]
        if any(sig in norm for sig in income_signals) or doc_type == "comprobante_ingreso":
            return "income", False, "Comprobante de ingreso o transferencia recibida a tu favor."

        # Expense signals
        expense_signals = [
            "transferiste", "enviaste", "pago realizado", "pago exitoso",
            "yapeaste", "comprobante de pago", "boleta de venta", "factura",
            "compra", "consumo", "cargo en cuenta", "debito"
        ]
        if any(sig in norm for sig in expense_signals) or doc_type in ("boleta_factura", "voucher_pago"):
            return "expense", False, "Pago, compra o transferencia enviada identificada."

        return "expense", False, "Operación clasificada como salida/gasto por defecto."

    @staticmethod
    def extract_entity_name(text: str) -> Optional[str]:
        """Extract merchant, bank or recipient name if possible."""
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        for line in lines[:5]:
            norm = remove_accents(line.lower())
            # Skip boilerplate header
            if any(term in norm for term in ["boleta", "factura", "ruc", "constancia", "voucher", "banco", "comprobante"]):
                continue
            if len(line) >= 4 and not re.search(r"^\d", line):
                return line[:50]
        return None

    @classmethod
    def analyze_document_text(cls, text: str) -> OCRParseResponse:
        """Analyze extracted OCR text and return structured financial classification."""
        cleaned_text = text.strip()
        if not cleaned_text:
            return OCRParseResponse(
                is_financial=False,
                document_type="imagen_no_financiera",
                document_type_label="Sin texto legible",
                operation_type="none",
                amount=0.0,
                currency="PEN",
                description="No se pudo extraer texto legible",
                category="Otros gastos",
                date=datetime.now().strftime("%Y-%m-%d"),
                candidate_amounts=[],
                raw_text="",
                confidence=0.0,
                needs_confirmation=True,
                status_message="No se encontró texto en la imagen. Verifica la calidad o ingresa los datos manualmente."
            )

        # 1. Classify document
        doc_type, doc_label, doc_conf = cls.classify_document(cleaned_text)

        if doc_type == "imagen_no_financiera":
            return OCRParseResponse(
                is_financial=False,
                document_type="imagen_no_financiera",
                document_type_label="Imagen no financiera",
                operation_type="none",
                amount=0.0,
                currency="PEN",
                description="La imagen analizada no parece corresponder a un comprobante financiero.",
                category="Otros gastos",
                date=datetime.now().strftime("%Y-%m-%d"),
                candidate_amounts=[],
                raw_text=cleaned_text[:500],
                confidence=doc_conf,
                needs_confirmation=False,
                status_message="La imagen analizada no corresponde a una transacción financiera. No se registrará ningún movimiento."
            )

        # 2. Extract candidate amounts with scoring
        candidates = cls.extract_amounts_with_scoring(cleaned_text)
        selected_amount = candidates[0].amount if candidates else 0.0
        amount_confidence = candidates[0].confidence_score if candidates else 0.0

        # 3. Determine operation direction (income vs expense)
        op_type, is_internal, direction_explanation = cls.determine_operation_direction(doc_type, cleaned_text)

        # 4. Extract date if present
        date_match = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b", cleaned_text)
        today = datetime.now().strftime("%Y-%m-%d")
        if date_match:
            d, m, y = date_match.group(1), date_match.group(2), date_match.group(3)
            year = f"20{y}" if len(y) == 2 else y
            parsed_date = f"{year}-{m.zfill(2)}-{d.zfill(2)}"
        else:
            parsed_date = today

        # 5. Extract entity name
        entity = cls.extract_entity_name(cleaned_text)

        # 6. Currency
        currency = "PEN"
        if re.search(r"\b(usd|dolares|\$|us\$)\b", cleaned_text.lower()):
            currency = "USD"

        # 7. Category & description
        if op_type == "income":
            category = "Otros ingresos" if not entity else "Ventas"
            description = f"Ingreso: {entity}" if entity else "Ingreso según comprobante"
        else:
            category = "Mercadería" if doc_type == "boleta_factura" else "Servicios"
            description = f"Pago a {entity}" if entity else "Gasto según comprobante"

        # 8. Ambiguity check
        needs_confirmation = False
        if selected_amount <= 0 or amount_confidence < 0.65:
            needs_confirmation = True
            status_message = "Se leyó el documento pero no se encontró un monto con suficiente certeza. Por favor revisa y confirma los campos."
        elif is_internal:
            needs_confirmation = True
            status_message = "Posible transferencia entre cuentas propias detectada. Revisa los datos para no duplicar."
        elif doc_type == "voucher_pago" and len(candidates) > 1 and (candidates[0].confidence_score - candidates[1].confidence_score < 0.15):
            needs_confirmation = True
            status_message = "Existen varios importes similares en el documento. Revisa que el monto seleccionado sea el correcto."
        else:
            status_message = f"Comprobante procesado exitosamente: {doc_label} por {currency} {selected_amount:.2f} ({'Ingreso' if op_type == 'income' else 'Gasto'})."

        return OCRParseResponse(
            is_financial=True,
            document_type=doc_type,
            document_type_label=doc_label,
            operation_type=op_type,
            amount=selected_amount,
            currency=currency,
            description=description,
            category=category,
            date=parsed_date,
            entity_name=entity,
            candidate_amounts=candidates[:5],
            raw_text=cleaned_text,
            confidence=round((doc_conf + amount_confidence) / 2.0, 2),
            needs_confirmation=needs_confirmation,
            status_message=status_message
        )

    @classmethod
    def process_image(cls, image_bytes: bytes) -> OCRParseResponse:
        """Full image OCR analysis pipeline."""
        extracted_text = cls.run_ocr(image_bytes)
        return cls.analyze_document_text(extracted_text)
