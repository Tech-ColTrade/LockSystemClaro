# Modo portal (sin llaves de la Device Lock API)

> Tema aparte pero relacionado: los jobs que se quedaban colgados en
> `corriendo` tras un reinicio están resueltos. Ver "Jobs huérfanos" al final.

> Estado actual: **modo portal activo**. Es una solución temporal hasta que
> Zeasn entregue las credenciales de la Device Lock API del entorno ACC.

## Por qué existe

La app habla con WhaleTV por **dos caminos distintos**, con credenciales
distintas:

| Camino | Para qué | Credenciales |
|---|---|---|
| **Device Lock API** (`saas.zeasn.tv`) | Leer estado, listar y resolver Códigos Pin | `WHALETV_LOCK_API_ACCESS_KEY` / `_SECRET_KEY` |
| **Portal web** (`lockservice.whaletv.com`, Selenium) | Bloquear y desbloquear | `WHALETV_PORTAL_EMAIL` / `_PASSWORD` |

Las credenciales son **por entorno** (PROD y ACC son instalaciones separadas,
cada una con su propia bolsa de códigos). Al mover el portal a ACC pero dejar la
API en producción, los dos caminos quedaron en entornos distintos y los Códigos
Pin dejaron de funcionar: el televisor mostraba `0276`, que existe en ACC, y la
API de producción respondía con otros 36 códigos entre los que no estaba.

Comprobado el 2026-08-05:

- `acc-saas.zeasn.tv` existe, pero rechaza la AccessKey de producción con
  `HTTP 401 — AUTHORIZATION ACCESSKEY NON-EXISTENT`.
- Un passcode que la API de producción da como disponible (`0062`) es rechazado
  por el portal ACC con *"Incorrect passcode"*. Son bolsas distintas.

Como no hay llaves de ACC, todo lo que se leía por API se saca ahora del portal
web, que sí está en el entorno correcto.

## Cómo se activa y cómo se revierte

**Solo depende de si las llaves están puestas.** No hay una variable de modo:

```
WHALETV_LOCK_API_ACCESS_KEY=      # vacías -> modo portal (Selenium)
WHALETV_LOCK_API_SECRET_KEY=
```

Cuando lleguen las de ACC, en `.env` y en Render:

```
WHALETV_LOCK_API_HOST=acc-saas.zeasn.tv
WHALETV_LOCK_API_ACCESS_KEY=<la de ACC>
WHALETV_LOCK_API_SECRET_KEY=<la de ACC>
```

Y vuelve solo al modo API. **No hay que tocar código ni desplegar nada más**;
basta reiniciar el servicio. Las credenciales del entorno de producción están
guardadas en `.env.portal-produccion`.

Aviso: las dos llaves van juntas. Si defines una sola, el arranque falla a
propósito con `ImproperlyConfigured` (una configuración a medias solo daría
errores de firma en la primera petición real).

## Qué cambia en modo portal

| Operación | Modo API | Modo portal |
|---|---|---|
| `GET .../estado-portal/` | ~1 s | **~15 s**; `payment_status` y `clear_status` llegan en `null` |
| `GET .../pincodes/` | lista los grupos disponibles | **HTTP 501**: el portal no publica esa lista |
| `POST .../pincodes/usar/` | busca el passcode en la lista | usa "Generate Pin Code" del portal; ~15 s |
| `GET .../validar/` | ~1 s | ~15 s |
| `POST .../validar-masivo/` | ~1 s por equipo | ~10 s por equipo (un solo login para el lote) |
| Bloquear / desbloquear | (ya era Selenium) | igual, sin cambios |

Los códigos de estado y los mensajes de error se mantienen: un passcode que el
portal rechaza sigue devolviendo `404` con el mismo texto de siempre.

### La única pérdida real: listar los códigos disponibles

El portal no expone la bolsa de códigos del dispositivo, solo permite pedir el
Pin de **un** passcode concreto y ver el historial de los ya entregados. Por eso
`GET .../pincodes/` responde `501` con una explicación, en vez de una lista
vacía (que se confundiría con "el equipo se quedó sin códigos").

Esto **no afecta al panel**: la pantalla de detalle del televisor nunca listó
los grupos, solo pide el Código de Acceso que muestra la pantalla y devuelve su
Pin. Afecta únicamente a quien consuma la **API de integración**, y hay que
avisarlo en `Guia_API_Integracion_Locking_System.docx` (sección 6).

## Cómo está hecho

```
televisores/portal/
├── client.py        # Device Lock API (HMAC-SHA1). Sin cambios.
├── scraper.py       # NUEVO: las mismas operaciones, raspando el portal.
├── proveedor.py     # NUEVO: elige uno u otro y unifica la interfaz.
└── selenium_sync.py # Bloquear/desbloquear. Sin cambios.
```

`proveedor.proveedor()` devuelve el adaptador que toque; las vistas y la
validación masiva ya no instancian `PortalClient` directamente. Para lotes está
`proveedor.sesion_proveedor()`, que en modo portal abre **un** navegador para
todo el lote en vez de uno por televisor.

Todo el uso del navegador pasa por `scraper.NAVEGADOR_LOCK`: dos Chromium a la
vez en Render (~400 MB cada uno) tumbarían el servicio por falta de memoria. En
la práctica esto **serializa** las peticiones que tocan el portal: si dos
operadores piden un Código Pin a la vez, el segundo espera al primero.

Gunicorn corre con `--timeout 120`, así que una operación de ~15 s cabe de
sobra; pero si se encolan varias, la última podría acercarse al límite.

## Verificado

Pruebas del 2026-08-05 contra `ACC-lockservice.whaletv.com`, por HTTP y con
API-key, sobre `3C:BE:8E:BD:EF:01`:

- `estado-portal` → `200`, `lock_status: 0`, `modo: "portal"` (14,7 s)
- `pincodes` → `501` con el mensaje explicativo (1,3 s)
- `validar` → `200`, "Coinciden (Habilitado)" (14,9 s)
- `pincodes/usar` con passcode inválido → `404`, mismo mensaje de siempre (14,7 s)
- `pincodes/usar` sin passcode → `400`
- `validar-masivo` → job completo, `coincide: true`

### Dónde publica el portal el Pin generado

Al generar, el portal **no** añade la fila al historial de inmediato: pinta un
panel arriba con el resultado.

```
Pin Code                                    [Generate Pin Code]
    Your Pin Code:  292807
                                Mac Address: 3C:BE:8E:BD:EF:01
                                Serial Number:
                                Passcode: 0568

Passcode & Pin Code History
NO.  Passcode   Pin Code   Date                  Status
1    0321       705346     08/05/2026 11:51:18   used
2    0276       179996     08/05/2026 11:08:27   used
```

La primera versión leía solo el historial y por eso agotaba el tiempo de espera
aunque el Pin sí se hubiera generado. Ahora `_pin_generado()` lee ese panel, y
el historial queda como respaldo.

El panel **sobrevive a generaciones anteriores**, así que se comprueba que el
`Passcode:` que muestra sea el pedido. Sin esa comprobación se podría devolver
el Pin de otro Código de Acceso, que es el peor error posible aquí: un pin que
no abre el televisor y un código quemado.

**Pendiente**: una generación con éxito de punta a punta desde la app. Hace
falta un Código de Acceso válido y sin usar, que solo se ve en la pantalla del
televisor. El camino de error (código inválido o ya usado) sí está verificado
contra el portal, y el parser del panel está probado con el texto real.

---

# Jobs huérfanos (sincronizaciones colgadas en "corriendo")

## El problema

Las sincronizaciones corren en hilos daemon dentro del proceso web
(`sync_runner.py`, `bulk_sync.py`). Si el proceso muere a mitad —redespliegue de
Render, gunicorn reciclando un worker, un Ctrl-C en local— el hilo se va con él,
pero la fila del job se queda en `corriendo`. Quien haga polling espera un final
que ya nunca llega.

Y no había forma de distinguirlo: los modelos tenían un campo `actualizado` con
`auto_now`, pero **nunca se movía**, porque los runners actualizan el progreso
con `QuerySet.update()` y eso **no dispara `auto_now`**. Un job trabajando y uno
muerto se veían exactamente igual.

## La solución

**1. Latido real.** `sync_runner.py` y `bulk_sync.py` escriben
`actualizado=timezone.now()` a mano en cada avance. Un job vivo late cada
10-40 s; un lote late en cada televisor.

> Si alguien quita esos `actualizado=timezone.now()`, todo esto deja de
> funcionar **en silencio** y vuelven los jobs colgados.

**2. Watchdog** (`televisores/watchdog.py`). Un job en `pendiente`/`corriendo`
que lleve más de `JOBS_TIMEOUT_MINUTOS` (por defecto 10) sin latir se marca como
`error` con un mensaje claro. Se dispara:

- al **arrancar** el servicio: `entrypoint.sh` ejecuta
  `manage.py cerrar_jobs_huerfanos` antes de gunicorn, así que un redespliegue
  limpia lo que dejó el anterior;
- al **consultar** cualquier job (polling individual, polling de lote,
  historial, cancelar): una sola UPDATE por tabla, barata.

No hay cron ni proceso extra. El barrido de arranque usa el mismo umbral, así
que un worker que arranca no puede cerrar los jobs vivos de otro worker.

*(El barrido NO va en `AppConfig.ready()`: Django desaconseja consultar la base
durante la inicialización, y además correría una vez por worker.)*

**3. Descartar a mano.**

    POST /api/televisores/{id}/sync/{job}/cancelar/
    POST /api/integracion/televisores/{serial}/sync/{job}/cancelar/

Un sync individual es **una sola operación de Selenium que no se puede
interrumpir**. Por eso solo descarta jobs sin latido:

- job sin latido → lo cierra y responde `200` con el job ya finalizado;
- job **vivo** → `409 Conflict` con "sigue en curso, espera";
- job ya terminado → `200` (idempotente);
- job inexistente → `404`.

Se rechaza el vivo a propósito: marcarlo cancelado no mataría el hilo, que al
terminar sobrescribiría el estado. Sería un cancelar que miente.

En los lotes, `cancelar` ya existía pero solo ponía `cancelar_solicitado=true`
esperando a un bucle que en un lote muerto ya no existe. Ahora, si no late, se
cierra directamente.

## Verificado (2026-08-05)

- Sync real: el latido avanza 10% → 50% → 100% y termina.
- Cancelar con el job **vivo** al 50% → `409` con el mensaje de "sigue en curso".
- Cancelar un job ya terminado → `200`, sin cambios.
- Job huérfano simulado (latido de hace 20 min): el primer polling lo devuelve
  ya como `finalizado: true` con el mensaje de interrupción.
- Lote huérfano: igual, y su `cancelar` lo cierra en vez de no hacer nada.
- El job 15312 que estaba realmente colgado quedó cerrado.

El frontend no necesitó cambios: ya paraba el polling con `finalizado` y muestra
el error cuando el estado no es `terminado`.
