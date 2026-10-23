# KipuAI - Sistema de Gestión de Gastos e Ingresos

KipuAI es una aplicación de gestión financiera para emprendedores y microempresas, equipada con reconocimiento de transacciones por voz y análisis inteligente de comprobantes mediante OCR.

---

## Estructura del Proyecto

El proyecto está organizado en dos módulos independientes:

```text
PulpiAI/
├── frontend/                     # Aplicación React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── services/
│   │   │   └── api.ts            # Cliente REST conectado al backend Python
│   │   ├── App.tsx               # Vistas principales (Dashboard, Registro, Historial, WhatsApp, Asistente, Crédito)
│   │   ├── index.css             # Estilos globales y utilidades
│   │   └── main.tsx              # Punto de entrada de React
│   ├── public/                   # Activos estáticos
│   ├── index.html                # Plantilla HTML
│   ├── package.json              # Dependencias del frontend
│   └── vite.config.ts            # Configuración de Vite con proxy /api -> backend:8000
│
├── backend/                      # API REST con Python y FastAPI
│   ├── app/
│   │   ├── main.py               # Aplicación principal FastAPI, CORS y ciclo de vida
│   │   ├── core/
│   │   │   ├── config.py         # Configuración y variables de entorno
│   │   │   └── security.py       # Hash seguro de contraseñas (PBKDF2-HMAC-SHA256)
│   │   ├── database/
│   │   │   ├── session.py        # Conexión SQLite con WAL mode y transacciones ACID
│   │   │   └── seed_data.py      # Inicialización y datos de ejemplo no duplicables
│   │   ├── models/               # Modelos de base de datos
│   │   ├── schemas/              # Validación de datos con Pydantic (Auth, Transacciones, Voz, OCR)
│   │   ├── services/
│   │   │   ├── auth_service.py   # Servicio de autenticación
│   │   │   ├── transaction_service.py # Lógica de movimientos, saldo y balance
│   │   │   ├── voice_service.py  # Reconocimiento y extracción precisa de montos por voz
│   │   │   └── ocr_service.py    # Preprocesamiento, OCR y clasificación de comprobantes
│   │   └── api/                  # Endpoints REST (/auth, /transactions, /voice, /ocr)
│   ├── tests/                    # Pruebas automatizadas con pytest
│   │   ├── test_auth.py          # Pruebas de autenticación y cuenta demo
│   │   ├── test_voice.py         # Pruebas de extracción de montos y tipos por voz
│   │   ├── test_ocr.py           # Pruebas de clasificación de comprobantes y total OCR
│   │   └── test_transactions.py  # Pruebas de persistencia, saldo y no duplicación
│   ├── requirements.txt          # Dependencias de Python
│   └── .env.example              # Variables de entorno de ejemplo
│
├── package.json                  # Scripts globales de conveniencia
├── README.md                     # Documentación general
└── .gitignore
```

---

## 1. Acceso de Prueba (Credenciales Predeterminadas)

El sistema incluye una cuenta de prueba para que los testers ingresen de inmediato sin tener que digitar credenciales:

- **Usuario / Correo:** `maria@gmail.com` (o celular `976345234`)
- **Contraseña:** `comerciante123`
- **Nombre:** María Rodríguez
- **Negocio:** Bodega Mi Esquina
- **Modo:** Al abrir el login, los campos ya aparecen pre-rellenados. Solo debes hacer clic en **«Ingresar»**.
- La cuenta y su contraseña con hash seguro se inicializan automáticamente en la base de datos al arrancar el backend.

---

## 2. Datos de Demostración Coherentes

Al acceder a la cuenta de prueba, se presentan movimientos de ejemplo distribuidos en la última semana:

- **Ingresos:** Sueldo (S/ 1,500.00), ventas diarias (S/ 420.00, S/ 550.00), trabajos independientes (S/ 300.00) y pedidos especiales (S/ 280.00).
- **Gastos:** Alimentación (almuerzo ejecutivo S/ 25.00), transporte (S/ 12.50), compras (libro S/ 49.90), servicios (luz S/ 115.00), entretenimiento (S/ 65.00) y mercadería (S/ 320.00, S/ 180.00).
- **Saldo disponible:** Calculado en tiempo real: `Ingresos - Gastos` (S/ 2,282.60).
- **Consistencia y no duplicación:** Si la cuenta ya tiene transacciones registradas, el sistema evita duplicar los registros al reiniciar o volver a iniciar sesión.

---

## 3. Reconocimiento de Voz Corregido

El módulo de voz (`app/services/voice_service.py`) analiza transcripciones habladas o escritas y extrae con alta precisión:

- **Tipo de operación:** Distingue ingresos («recibí», «cobré», «me depositaron», «ingresé») de gastos («gasté», «compré», «pagué»).
- **Monto y decimales:** Soporta números dígitos y números en texto («veinticinco soles» -> `25.00`, «12 soles con 50 céntimos» -> `12.50`, «49.90 soles» -> `49.90`).
- **Desambiguación:** No confunde números de fecha (ej. «15 de marzo»), números de comprobante o cantidades de productos (ej. «compré 3 cuadernos por 45 soles») con el monto real.
- **Categorización sugerida:** Asigna automáticamente Alimentación, Transporte, Compras, Sueldo, etc.
- **Vista previa editable:** Permite al usuario revisar y ajustar los valores antes de confirmar el registro.

---

## 4. Reconocimiento de Comprobantes por OCR Corregido

El módulo de OCR (`app/services/ocr_service.py`) clasifica la imagen antes de intentar registrar un movimiento:

1. **Preprocesamiento:** Corrección de orientación EXIF, ajuste de contraste, reducción de ruido y mejora de nitidez con PIL y OpenCV.
2. **Motor OCR:** RapidOCR basado en ONNX, ejecutándose en local sin requerir binarios externos de sistema.
3. **Clasificación semántica del documento:**
   - **Boleta o factura de compra:** Registrado como gasto.
   - **Voucher de pago o billetera digital (Yape / Plin / BCP / BBVA):** Transferencia enviada clasificada como gasto.
   - **Comprobante de ingreso:** Transferencia recibida o abono clasificado como ingreso.
   - **Imagen no financiera:** Fotografías personales, paisajes o textos genéricos son rechazados y **no se registran como gasto**.
4. **Extracción del importe total real:**
   - Prioriza etiquetas de total (`TOTAL`, `TOTAL A PAGAR`, `IMPORTE TOTAL`, `MONTO PAGADO`, `MONTO TRANSFERIDO`).
   - Penaliza y excluye subtotales, IGV (18%), vueltos, números de celular o números de operación.
   - Formatos numéricos interpretados con precisión: `S/ 25.00`, `S/ 1,250.50`, `S/ 1.250,50`, `PEN 89.90`, etc.
5. **Validación previa:** Pantalla de revisión con tipo de documento, importe, entidad detectada, selector de importes alternativos y visualización del texto OCR reconocido.

---

## 5. Instalación de Dependencias

### Backend (Python):
```bash
cd backend
python -m pip install -r requirements.txt
```

### Frontend (Node.js):
```bash
cd frontend
npm install
```

---

## 6. Comandos para Iniciar los Servidores

### Iniciar Backend (FastAPI en puerto 8000):
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Swagger interactiva disponible en: `http://localhost:8000/docs`

### Iniciar Frontend (Vite en puerto 8443 o 5173):
```bash
cd frontend
npm run dev
```
O desde la raíz:
```bash
npm run dev
```

---

## 7. Ejecución de Pruebas Automatizadas

Para ejecutar las 20 pruebas automáticas que validan autenticación, voz, OCR y transacciones:

```bash
cd backend
python -m pytest tests -v
```

Todas las pruebas pasan con éxito verificando los 12 casos obligatorios requeridos por la especificación.
