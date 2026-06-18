# MT5 Tournament Demo Intake

Completa este documento para preparar la integracion minima del cockpit, arena y bridge MT5 para la demo.

## 1. Objetivo De La Demo

- Fecha objetivo: viernes 12 de junnio de 2023
- Torneo demo principal: Bullfy Tournament Open
- Usuario/trader demo principal: Nando Trader
- Tipo de cuenta MT5: El bridge por si mismo no decide si es demo o real, solo crea cuentas y ya.
- Simbolos permitidos: EURUSD, GBPUSD, XAUUSD
- Lotaje minimo: 0.01
- Lotaje maximo: 1
- Riesgo maximo por orden: Decidelo por ti

## 2. Variables De Entorno

No pegues secretos directamente en este documento si se va a compartir. Colocalos en `.env.local` y deja aqui solo los nombres.

```env
MT5_BRIDGE_BASE_URL=http://3.92.223.216:8000
MT5_BRIDGE_TOKEN=bullfy-bridge-sk-2026
MT5_BRIDGE_TIMEOUT_MS=15000
```

## 3. Bridge MT5

### Crear Cuenta MT5

```txt
Method: POST
Path: Users
Headers:

Request body:
{
    "name": "Bridge Test User",
    "group": "broker\\TEST-B NUEVO ERICK CRM",
    "leverage": 100,
    "password": "TestPass123!",
    "email": "test@bullfy.com"
}
Response body:
{
    "login": 121734,
    "name": "Bridge Test User",
    "group": "broker\\TEST-B NUEVO ERICK CRM",
    "leverage": 100,
    "email": "test@bullfy.com",
    "comment": "",
    "rights": 355
}
Notas:
```

### Consultar Cuenta MT5

Debe permitir obtener balance, equity, margin, free margin y estado de conexion.

```txt
Method: GET
Path: /accounts/{login}
Headers:

Request body o query params:
No hay body para este endpoint 
No hay query params para este endpoint
Response body:
{
  "login": 121734,
  "balance": 0,
  "equity": 0,
  "margin": 0,
  "margin_free": 0,
  "profit": 0,
  "credit": 0,
  "currency_digits": 2
}
Notas:
```

### Listar Posiciones Abiertas

```txt
Method: GET
Path: /users/{login}/deals
Headers:

Request body o query params:

Response body:
[{
    "deal_id": 3533119,
    "order_id": 3644284,
    "position_id": 3644283,
    "login": 121734,
    "symbol": "EURUSD",
    "action": 1,
    "entry": 1,
    "volume": 0.1,
    "price": 1.15537,
    "profit": -46.3,
    "commission": 0,
    "swap": 0,
    "comment": "[so -41.85%/-48.55/116.00]",
    "time": 1781142207
  }]
Notas:
Hay un enpoint igual pero que termina en /orders, pero no trae nada, en cambio probe abrir una orden y el 
enppint de deals si trajo una lista de ordenes, no se cual es la diferencia en este bridge.
```

### Abrir Operacion

Debe cubrir orden market al menos. Si soporta pending orders, indicarlo.

```txt
Method: POST
Path: /users/{login}/orders
Headers:

Request body:
{
    "symbol": "EURUSD",
    "type": 0,
    "volume": 0.1,
    "comment": "",
    "price": 1.16,
    "sl": 1.17,
    "tp": 1.18
}
Response body:
{
    "deal": 3533179,
    "login": 121734,
    "symbol": "EURUSD",
    "action": 0,
    "volume": 0.1,
    "price": 1.16,
    "comment": ""
}
Errores esperados:

Notas:
```

### Cerrar Operacion

```txt
Method: DELETE
Path: /users/{login}/positions/{ticket}/close
Headers:

Request body:

Response body:

Errores esperados:

Notas:
No se cual es el body por que no puedo cerrar las operaciones, de hecho obtengo un error que dice que no se encontraron posiciones abiertas para el login.
```

### Historial / Deals Cerrados

Si no existe todavia, marcar como pendiente.

```txt
Method:
Path:
Headers:

Request body o query params:

Response body:

Notas:
Pendiente
```

## 4. Reglas Del Torneo Demo

- Duracion: 1 hora
- Balance inicial: 10000
- Cuenta demo o fondeada: Como ya te dije el bridge no decide, solo creas cuentas
- Max drawdown: Decide por ti
- Max daily loss: Decide por ti
- Max operaciones abiertas: Decide por ti
- Max lotaje total: Decide por ti
- Simbolos permitidos: EURUSD, GBPUSD, XAUUSD
- Como se calcula ranking: Decide por ti
- Como se calcula score: Decide por ti
- Condiciones de eliminacion: Decide por ti

## 5. Datos Minimos De DB Local

### Trader Demo

```txt
id: 1
nombre: Nando Trader
handle: nando
email: nando@bullfy.com
clan: Bullfy Clan
pais: VE
membresia: elite
```

### Torneo Demo

```txt
id: 1
slug: bullfy-tournament-open
nombre: Torneo de Bullfy Open
estado: SCHEDULED
inicio: 2023-06-12T00:00:00.000Z
fin: 2023-06-12T01:00:00.000Z
prize pool: 10000
max participantes: 10
```

### Cuenta MT5 Demo

```txt
login:
server:
password/investor password:
balance inicial:
equity inicial:

NOTA: Luego podemos crear cuentas de prueba en la app para que no tengamos que crear cuentas reales.

```

## 6. Flujo Que Queremos Mostrar

Marca lo que debe quedar listo para la demo.

- [ X] Crear o cargar torneo desde DB local.
- [ X] Inscribir trader demo en torneo.
- [ X] Crear cuenta MT5 desde bridge.
- [X ] Asociar cuenta MT5 al participante.
- [X ] Entrar al cockpit.
- [X ] Abrir operacion desde ticket MT5.
- [ X] Guardar orden en DB.
- [ X] Mostrar posicion abierta en cockpit.
- [ X] Mostrar evento en actividad reciente.
- [ X] Cerrar operacion desde cockpit.
- [ X] Actualizar PnL.
- [ X] Actualizar ranking.
- [ X] Mostrar ArenaTV con ranking y actividad.

## 7. Criterios De Exito

- La demo debe poder correr localmente sin depender de datos manuales.
- Si el bridge MT5 falla, debe existir fallback mock controlado.
- Las credenciales no deben quedar hardcodeadas.
- Las migraciones deben estar versionadas.
- El flujo debe ser repetible despues de reiniciar la DB local.

## 8. Dudas / Riesgos

- 

