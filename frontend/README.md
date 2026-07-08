# frontend — React + TypeScript (Vite)

Interfaz del proyecto **core / Locking System**. Consume la API de Django REST
Framework que vive en [`../backend`](../backend).

## Stack

- React 19 + TypeScript
- Vite 8
- oxlint (linter)

## Estructura

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts     # Cliente fetch de la API (itemsApi)
│   ├── types.ts          # Tipos compartidos con el backend (Item, Paginated…)
│   ├── App.tsx           # UI: listar / crear / eliminar items
│   ├── App.css
│   ├── index.css
│   └── main.tsx
├── vite.config.ts        # Proxy /api -> http://127.0.0.1:8000
├── .env.example
└── package.json
```

## Puesta en marcha

```powershell
# 1. Instalar dependencias
npm install

# 2. Levantar el servidor de desarrollo
npm run dev
```

Abre http://localhost:5173.

> **Importante:** el backend Django debe estar corriendo en el puerto 8000
> (`cd ../backend; .\env\Scripts\Activate.ps1; python manage.py runserver`).
> Vite hace proxy de todas las rutas `/api/*` hacia `http://127.0.0.1:8000`,
> así que en desarrollo no hay problemas de CORS.

## Conexión con la API

- La capa de datos está en [`src/api/client.ts`](src/api/client.ts) (`itemsApi`).
- Los tipos en [`src/types.ts`](src/types.ts) reflejan el modelo `Item` del backend.
- La lectura (`GET /api/items/`) es pública; crear/editar/borrar requieren
  autenticación JWT (permiso `IsAuthenticatedOrReadOnly` en el backend).

## Producción

Define `VITE_API_URL` (ver `.env.example`) con la URL completa del backend y
compila con `npm run build` (genera `dist/`).

## Scripts

| Comando           | Descripción                          |
|-------------------|--------------------------------------|
| `npm run dev`     | Servidor de desarrollo con HMR       |
| `npm run build`   | Type-check + build de producción     |
| `npm run preview` | Sirve el build de `dist/`            |
| `npm run lint`    | Linter (oxlint)                      |
