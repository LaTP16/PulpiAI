# PulpiAI - Sistema de Gestión de Gastos e Ingresos con IA

> **Desafío 4:** *"Asistente de IA por voz e imagen que digitaliza ingresos y gastos de pequeños negocios informales para ordenar sus finanzas y facilitar su acceso al crédito."*

**PulpiAI** es una aplicación de gestión financiera para emprendedores y microempresas informales, equipada con reconocimiento de transacciones por voz, análisis inteligente de comprobantes mediante OCR y un asistente financiero conversacional impulsado por Inteligencia Artificial (Gemini).

---

## Estructura del Proyecto

El proyecto está organizado en dos módulos independientes listos para despliegue en **Vercel** (Frontend) y **Render** (Backend):

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
│   ├── vercel.json               # Configuración de despliegue en Vercel
│   └── vite.config.ts            # Configuración de Vite con proxy /api -> backend:8000
│
├── backend/                      # API REST con Python y FastAPI
│   ├── app/
│   │   ├── main.py               # Aplicación principal FastAPI, CORS y ciclo de vida
│   │   ├── core/
│   │   │   ├── config.py         # Configuración y variables de entorno (incluye GEMINI_API_KEY)
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
│   │   │   ├── ocr_service.py    # Preprocesamiento, OCR y clasificación de comprobantes
│   │   │   └── ai_service.py     # Asistente financiero conversacional con Gemini API
│   │   └── api/                  # Endpoints REST (/auth, /transactions, /voice, /ocr, /assistant)
│   ├── tests/                    # Pruebas automatizadas con pytest
│   ├── Procfile                  # Comando de inicio para Render / PaaS
│   ├── requirements.txt          # Dependencias de Python
│   └── .env.example              # Variables de entorno de ejemplo
│
├── render.yaml                   # Blueprint para despliegue automático en Render
├── vercel.json                   # Configuración para despliegue en Vercel desde la raíz
├── package.json                  # Scripts globales de conveniencia
├── README.md                     # Documentación general
└── .gitignore
```

---

## 1. Acceso de Prueba (Credenciales Predeterminadas)

El sistema incluye una cuenta de prueba para que los evaluadores ingresen de inmediato sin tener que digitar credenciales:

- **Usuario / Correo:** `maria@gmail.com` (o celular `976345234`)
- **Contraseña:** `comerciante123`
- **Nombre:** María Rodríguez
- **Negocio:** Bodega Mi Esquina
- **Modo:** Al abrir el login, los campos ya aparecen pre-rellenados. Solo debes hacer clic en **«Ingresar»**.

---

## 2. Datos de Demostración Coherentes

Al acceder a la cuenta de prueba, se presentan movimientos de ejemplo distribuidos en la última semana:

- **Ingresos:** Sueldo (S/ 1,500.00), ventas diarias (S/ 420.00, S/ 550.00), trabajos independientes (S/ 300.00) y pedidos especiales (S/ 280.00).
- **Gastos:** Alimentación (almuerzo ejecutivo S/ 25.00), transporte (S/ 12.50), compras (libro S/ 49.90), servicios (luz S/ 115.00), entretenimiento (S/ 65.00) y mercadería (S/ 320.00, S/ 180.00).
- **Saldo disponible:** Calculado en tiempo real: `Ingresos - Gastos` (S/ 2,282.60).
- **Consistencia y no duplicación:** Si la cuenta ya tiene transacciones registradas, el sistema evita duplicar los registros al reiniciar o volver a iniciar sesión.

---

## 3. Reconocimiento de Voz

El módulo de voz (`app/services/voice_service.py`) analiza transcripciones habladas o escritas y extrae con alta precisión:

- **Tipo de operación:** Distingue ingresos («recibí», «cobré», «me depositaron», «ingresé») de gastos («gasté», «compré», «pagué»).
- **Monto y decimales:** Soporta números dígitos y números en texto («veinticinco soles» -> `25.00`, «12 soles con 50 céntimos» -> `12.50`, «49.90 soles» -> `49.90`).
- **Desambiguación:** No confunde números de fecha (ej. «15 de marzo»), números de comprobante o cantidades de productos (ej. «compré 3 cuadernos por 45 soles») con el monto real.

---

## 4. Reconocimiento de Comprobantes por OCR

El módulo de OCR (`app/services/ocr_service.py`) clasifica la imagen antes de intentar registrar un movimiento:

1. **Preprocesamiento:** Corrección de orientación EXIF, ajuste de contraste, reducción de ruido y mejora de nitidez con PIL y OpenCV.
2. **Motor OCR:** RapidOCR basado en ONNX, ejecutándose en local sin requerir binarios externos de sistema.
3. **Clasificación semántica del documento:**
   - **Boleta o factura de compra:** Registrado como gasto.
   - **Voucher de pago o billetera digital (Yape / Plin / BCP / BBVA):** Transferencia enviada clasificada como gasto.
   - **Comprobante de ingreso:** Transferencia recibida o abono clasificado como ingreso.
   - **Imagen no financiera:** Fotografías personales, paisajes o textos genéricos son rechazados y **no se registran como gasto**.

---

## 5. Instalación y Ejecución Local

### Backend (Python):
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Swagger interactiva disponible en: `http://localhost:8000/docs`

### Frontend (Node.js):
```bash
cd frontend
npm install
npm run dev
```

---

## 6. Despliegue en Producción (Render + Vercel)

### Backend en Render:
1. Crea un nuevo **Web Service** en [Render](https://render.com) conectado a este repositorio.
2. Configura:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. En **Environment Variables**, agrega:
   - `GEMINI_API_KEY`: Tu API Key de Google Gemini.
   - `DEMO_MODE`: `true`

### Frontend en Vercel:
1. Importa el repositorio en [Vercel](https://vercel.com).
2. En **Environment Variables**, agrega:
   - `VITE_API_BASE_URL`: La URL de tu servicio en Render (ejemplo: `https://pulpiai-backend.onrender.com/api`).
3. Haz clic en **Deploy**.

---

## 7. Ejecución de Pruebas Automatizadas

```bash
cd backend
python -m pytest tests -v
```
