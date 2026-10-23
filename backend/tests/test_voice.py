def test_voice_expense_lunch(client):
    res = client.post("/api/voice/parse", json={"text": "Gasté 25 soles en almuerzo"})
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "expense"
    assert data["amount"] == 25.00
    assert data["currency"] == "PEN"
    assert data["category"] == "Alimentación"
    assert data["needs_confirmation"] is False

def test_voice_expense_book_decimals(client):
    res = client.post("/api/voice/parse", json={"text": "Compré un libro por 49.90 soles"})
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "expense"
    assert data["amount"] == 49.90
    assert data["currency"] == "PEN"
    assert data["category"] == "Compras"
    assert data["needs_confirmation"] is False

def test_voice_income_salary(client):
    res = client.post("/api/voice/parse", json={"text": "Recibí 1500 soles de sueldo"})
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "income"
    assert data["amount"] == 1500.00
    assert data["currency"] == "PEN"
    assert data["category"] == "Sueldo"
    assert data["needs_confirmation"] is False

def test_voice_expense_cents_expression(client):
    res = client.post("/api/voice/parse", json={"text": "Pagué 12 soles con 50 céntimos en transporte"})
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "expense"
    assert data["amount"] == 12.50
    assert data["category"] == "Transporte"
    assert data["needs_confirmation"] is False

def test_voice_income_freelance(client):
    res = client.post("/api/voice/parse", json={"text": "Ingresé 300 soles por un trabajo independiente"})
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "income"
    assert data["amount"] == 300.00
    assert data["category"] == "Trabajos independientes"
    assert data["needs_confirmation"] is False

def test_voice_written_numbers():
    from app.services.voice_service import VoiceService
    res = VoiceService.parse_transcript("Gasté veinticinco soles en comida")
    assert res.type == "expense"
    assert res.amount == 25.00

def test_voice_disambiguate_quantity_and_date():
    from app.services.voice_service import VoiceService
    res = VoiceService.parse_transcript("Compré 3 cuadernos por 45 soles el 15 de marzo")
    assert res.type == "expense"
    assert res.amount == 45.00  # Should NOT be 3 or 15

def test_voice_low_confidence_requires_confirmation(client):
    res = client.post("/api/voice/parse", json={"text": "Anotar algo que compré"})
    assert res.status_code == 200
    data = res.json()
    assert data["needs_confirmation"] is True
    assert data["amount"] == 0.0
