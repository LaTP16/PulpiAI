from app.services.ocr_service import OCRService

def test_ocr_invoice_extracts_grand_total():
    """Boleta with subtotal, IGV and total must pick the grand total (not subtotal or IGV)."""
    text = """
    SUPERMERCADOS METRO S.A.
    RUC: 20543210987
    BOLETA DE VENTA ELECTRONICA B012-004567
    FECHA: 21/10/2026
    --------------------------------------
    ITEM   DESCRIPCION             TOTAL
    01     LECHE GLORIA PACK       21.50
    02     DETERGENTE ARIEL        32.00
    SUBTOTAL: S/ 53.50
    IGV 18%: S/ 9.63
    TOTAL A PAGAR: S/ 63.13
    """
    res = OCRService.analyze_document_text(text)
    assert res.is_financial is True
    assert res.document_type == "boleta_factura"
    assert res.operation_type == "expense"
    assert res.amount == 63.13  # Not 53.50 or 9.63 or 21.50

def test_ocr_yape_transfer_sent():
    text = """
    YAPE
    ¡Yapeaste!
    S/ 35.00
    A: Tienda Doña Rosa
    Nro Celular: 987***321
    Nro Operacion: 123456
    Fecha: 22/10/2026
    """
    res = OCRService.analyze_document_text(text)
    assert res.is_financial is True
    assert res.operation_type == "expense"
    assert res.amount == 35.00

def test_ocr_transfer_received_is_income():
    text = """
    BANCO DE CREDITO DEL PERU
    CONSTANCIA DE TRANSFERENCIA RECIBIDA
    ¡Te transfirió dinero!
    Abono en cuenta corriente
    MONTO TRANSFERIDO: S/ 450.00
    De: Roberto Sánchez
    Fecha: 22/10/2026
    """
    res = OCRService.analyze_document_text(text)
    assert res.is_financial is True
    assert res.operation_type == "income"
    assert res.amount == 450.00

def test_ocr_non_financial_image_rejected():
    text = """
    CAPITULO IV: La expedición botánica
    Los exploradores llegaron al valle al amanecer.
    Las montañas se extendían hacia el horizonte bajo una niebla ligera.
    Recogieron muestras de orquídeas y helechos para su estudio.
    """
    res = OCRService.analyze_document_text(text)
    assert res.is_financial is False
    assert res.document_type == "imagen_no_financiera"
    assert res.operation_type == "none"
    assert res.amount == 0.0

def test_ocr_internal_transfer_requires_confirmation():
    text = """
    INTERBANK
    TRANSFERENCIA ENTRE CUENTAS PROPIAS
    Monto transferido: S/ 500.00
    Cuenta origen: 100-2345678
    Cuenta destino: 100-8765432
    Fecha: 20/10/2026
    """
    res = OCRService.analyze_document_text(text)
    assert res.is_financial is True
    assert res.needs_confirmation is True
    assert res.amount == 500.00
