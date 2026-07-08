# core — API con Django REST Framework

Proyecto base de **Django REST Framework**. El proyecto principal se llama `core`
(la configuración raíz vive en la carpeta `core/`) y la lógica de la API está en
la app `api/`.

## Stack

- Django 6.0
- Django REST Framework
- SimpleJWT (autenticación con tokens)
- django-cors-headers
- python-dotenv (variables de entorno)
- SQLite (por defecto)

## Estructura

```
backend/
├── core/               # Proyecto principal (settings, urls, wsgi/asgi)
│   ├── settings.py
│   └── urls.py
├── api/                # App con la lógica de la API
│   ├── models.py       # Modelo Item
│   ├── serializers.py
│   ├── views.py        # ItemViewSet + health
│   └── urls.py
├── env/                # Entorno virtual
├── manage.py
├── requirements.txt
├── .env.example
└── README.md
```

> **Nota (Windows):** la ruta del proyecto es muy larga y Windows limita las rutas
> a 260 caracteres. Si en otro equipo `pip install` falla al instalar
> `djangorestframework-simplejwt`, habilita el soporte de rutas largas
> (`LongPathsEnabled=1` en el registro, requiere admin) o instala ese paquete
> montando un disco corto con `subst`.

## Puesta en marcha

```powershell
# 1. Activar el entorno virtual (ya creado en ./env)
.\env\Scripts\Activate.ps1

# 2. (Opcional) instalar dependencias en otro equipo
pip install -r requirements.txt

# 3. Copiar variables de entorno
copy .env.example .env

# 4. Aplicar migraciones
python manage.py migrate

# 5. Crear superusuario (para el admin y obtener tokens)
python manage.py createsuperuser

# 6. Levantar el servidor
python manage.py runserver
```

## Endpoints

| Método            | Ruta                     | Descripción                     |
|-------------------|--------------------------|---------------------------------|
| GET               | `/api/health/`           | Chequeo de estado               |
| GET/POST          | `/api/items/`            | Listar / crear items            |
| GET/PUT/PATCH/DEL | `/api/items/{id}/`       | Detalle / editar / borrar item  |
| POST              | `/api/token/`            | Obtener access + refresh token  |
| POST              | `/api/token/refresh/`    | Renovar access token            |
| —                 | `/admin/`                | Panel de administración         |

### Autenticación

```bash
# Obtener token
curl -X POST http://127.0.0.1:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "tu_password"}'

# Usar el token
curl http://127.0.0.1:8000/api/items/ \
  -H "Authorization: Bearer <access_token>"
```

La lectura es pública (`IsAuthenticatedOrReadOnly`); crear/editar/borrar requiere token.
