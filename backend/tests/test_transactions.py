from app.database.seed_data import seed_demo_data_if_needed, DEMO_USER_ID

def test_summary_consistency(client):
    res = client.get(f"/api/transactions/summary?user_id={DEMO_USER_ID}")
    assert res.status_code == 200
    data = res.json()

    assert data["income"] > 0
    assert data["expense"] > 0
    # Available balance must equal income - expense
    assert round(data["income"] - data["expense"], 2) == round(data["balance"], 2)
    assert data["total_count"] > 0
    assert len(data["weekly"]) == 7
    assert len(data["categories"]) > 0

def test_seed_data_no_duplication_on_repeated_calls(client):
    # Fetch count
    res1 = client.get(f"/api/transactions?user_id={DEMO_USER_ID}")
    count1 = len(res1.json())

    # Call seed multiple times
    seed_demo_data_if_needed()
    seed_demo_data_if_needed()

    res2 = client.get(f"/api/transactions?user_id={DEMO_USER_ID}")
    count2 = len(res2.json())

    assert count1 == count2, f"Seed duplicated records: {count1} vs {count2}"

def test_create_update_delete_transaction_lifecycle(client):
    # 1. Create
    new_tx = {
        "type": "expense",
        "amount": 75.50,
        "category": "Alimentación",
        "description": "Cena de prueba",
        "date": "2026-10-22",
        "currency": "PEN"
    }
    create_res = client.post(f"/api/transactions?user_id={DEMO_USER_ID}", json=new_tx)
    assert create_res.status_code == 201
    created_data = create_res.json()
    tx_id = created_data["id"]
    assert created_data["amount"] == 75.50

    # 2. Update
    update_data = {
        "amount": 80.00,
        "description": "Cena de prueba modificada"
    }
    put_res = client.put(f"/api/transactions/{tx_id}?user_id={DEMO_USER_ID}", json=update_data)
    assert put_res.status_code == 200
    updated_json = put_res.json()
    assert updated_json["amount"] == 80.00
    assert updated_json["description"] == "Cena de prueba modificada"

    # 3. Delete
    del_res = client.delete(f"/api/transactions/{tx_id}?user_id={DEMO_USER_ID}")
    assert del_res.status_code == 200

    # 4. Confirm deleted
    get_res = client.get(f"/api/transactions/{tx_id}?user_id={DEMO_USER_ID}")
    assert get_res.status_code == 404
