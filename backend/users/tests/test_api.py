from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import SesionActiva

User = get_user_model()

STRONG_PASSWORD = 'ClaveSegura123'


class NoPublicRegisterTests(APITestCase):
    """El auto-registro público quedó deshabilitado (endpoint eliminado)."""

    def test_ruta_de_registro_no_existe(self):
        from django.urls import NoReverseMatch

        with self.assertRaises(NoReverseMatch):
            reverse('users:register')


class AdminUserCreateApiTests(APITestCase):
    """Alta de usuarios: reservada a administradores (POST /api/usuarios/)."""

    def setUp(self):
        self.url = reverse('users:usuarios')
        self.admin = User.objects.create_superuser(
            email='admin@correo.com', password=STRONG_PASSWORD
        )
        self.consulta = User.objects.create_user(
            email='consulta@correo.com', password=STRONG_PASSWORD
        )

    def test_anonimo_no_puede_crear(self):
        resp = self.client.post(
            self.url,
            {'email': 'x@correo.com', 'password': STRONG_PASSWORD},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(User.objects.filter(email='x@correo.com').exists())

    def test_no_admin_no_puede_crear(self):
        self.client.force_authenticate(user=self.consulta)
        resp = self.client.post(
            self.url,
            {'email': 'x@correo.com', 'password': STRONG_PASSWORD},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(email='x@correo.com').exists())

    def test_admin_crea_usuario_sin_devolver_password(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            self.url,
            {
                'email': 'nuevo@correo.com',
                'password': STRONG_PASSWORD,
                'first_name': 'Ada',
                'last_name': 'Lovelace',
                'role': 'operador',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('password', resp.data)
        self.assertEqual(resp.data['email'], 'nuevo@correo.com')
        self.assertEqual(resp.data['role'], 'operador')

    def test_password_debil_rechazada(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            self.url,
            {'email': 'debil@correo.com', 'password': '123'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email='debil@correo.com').exists())

    def test_no_permite_escalar_privilegios(self):
        # Aunque envíe is_staff/is_superuser, no son asignables desde la API.
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            self.url,
            {
                'email': 'attacker@correo.com',
                'password': STRONG_PASSWORD,
                'first_name': 'Mallory',
                'last_name': 'Atacante',
                'is_staff': True,
                'is_superuser': True,
            },
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email='attacker@correo.com')
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_no_crea_usuario_sin_nombre_ni_apellido(self):
        """Misma regla que en el perfil: una cuenta no nace a medio identificar."""
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            self.url,
            {'email': 'anonimo@correo.com', 'password': STRONG_PASSWORD},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('first_name', resp.data)
        self.assertIn('last_name', resp.data)
        self.assertFalse(User.objects.filter(email='anonimo@correo.com').exists())

    def test_email_duplicado_rechazado(self):
        self.client.force_authenticate(user=self.admin)
        User.objects.create_user(email='dup@correo.com', password=STRONG_PASSWORD)
        resp = self.client.post(
            self.url,
            {'email': 'DUP@correo.com', 'password': STRONG_PASSWORD},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class TokenApiTests(APITestCase):
    def setUp(self):
        cache.clear()  # aísla el throttle de login (5/min) entre tests
        self.user = User.objects.create_user(
            email='login@correo.com', password=STRONG_PASSWORD
        )

    def test_obtiene_token_con_email(self):
        resp = self.client.post(
            reverse('users:token_obtain_pair'),
            {'email': 'login@correo.com', 'password': STRONG_PASSWORD},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)

    def test_credenciales_invalidas(self):
        resp = self.client.post(
            reverse('users:token_obtain_pair'),
            {'email': 'login@correo.com', 'password': 'incorrecta'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class SesionPorNavegadorApiTests(APITestCase):
    """Un navegador = una cuenta (la otra mitad de la sesión única).

    El navegador se identifica por IP + familia (Chrome/Edge/…), no por nada que
    el cliente guarde: así dos PERFILES del mismo Chrome, o una ventana de
    incógnito, cuentan como el mismo navegador — que es justo el caso que hay
    que impedir.
    """

    BASE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    CHROME = BASE + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    EDGE = CHROME + ' Edg/120.0.0.0'
    EQUIPO = '190.10.20.30'
    OTRO_EQUIPO = '190.10.20.99'

    def setUp(self):
        cache.clear()  # aísla el throttle de login (5/min) entre tests
        self.ana = User.objects.create_user(
            email='ana@correo.com', password=STRONG_PASSWORD
        )
        self.beto = User.objects.create_user(
            email='beto@correo.com', password=STRONG_PASSWORD
        )

    def _login(self, email, *, navegador=CHROME, ip=EQUIPO):
        return self.client.post(
            reverse('users:token_obtain_pair'),
            {'email': email, 'password': STRONG_PASSWORD},
            format='json',
            HTTP_USER_AGENT=navegador,
            REMOTE_ADDR=ip,
        )

    def test_otra_cuenta_en_el_mismo_navegador_es_rechazada(self):
        self.assertEqual(self._login('ana@correo.com').status_code, 200)

        resp = self._login('beto@correo.com')
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data['code'], 'navegador_ocupado')
        self.assertEqual(resp.data['navegador'], 'Chrome')
        # El correo del ocupante va ofuscado, no en claro.
        self.assertNotIn('ana@correo.com', str(resp.data))

    def test_otro_perfil_del_mismo_chrome_tambien_es_rechazado(self):
        """El caso que motivó la regla: mismo equipo, mismo Chrome, otro perfil.

        Otro perfil de Chrome manda el mismo User-Agent desde la misma IP: para
        el servidor es indistinguible del primero, y eso es exactamente lo que
        se busca.
        """
        self.assertEqual(self._login('ana@correo.com').status_code, 200)

        resp = self._login('beto@correo.com', navegador=self.CHROME + ' ')
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data['code'], 'navegador_ocupado')

    def test_otra_cuenta_en_otro_navegador_si_puede_entrar(self):
        self.assertEqual(self._login('ana@correo.com').status_code, 200)
        self.assertEqual(
            self._login('beto@correo.com', navegador=self.EDGE).status_code, 200
        )

    def test_otra_cuenta_desde_otro_equipo_si_puede_entrar(self):
        self.assertEqual(self._login('ana@correo.com').status_code, 200)
        self.assertEqual(
            self._login('beto@correo.com', ip=self.OTRO_EQUIPO).status_code, 200
        )

    def test_la_misma_cuenta_en_otro_navegador_sigue_bloqueada(self):
        self.assertEqual(self._login('ana@correo.com').status_code, 200)

        resp = self._login('ana@correo.com', navegador=self.EDGE)
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data['code'], 'sesion_activa')

    def test_el_navegador_se_libera_al_cerrar_sesion(self):
        access = self._login('ana@correo.com').data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        self.client.post(reverse('users:logout'))
        self.client.credentials()

        self.assertEqual(self._login('beto@correo.com').status_code, 200)

    def test_el_navegador_se_libera_cuando_la_sesion_caduca(self):
        self._login('ana@correo.com')

        # `update` esquiva el auto_now: simula la falta de actividad.
        vencida = timezone.now() - timedelta(
            minutes=settings.SESSION_INACTIVITY_MINUTOS + 1
        )
        SesionActiva.objects.filter(user=self.ana).update(ultima_actividad=vencida)

        self.assertEqual(self._login('beto@correo.com').status_code, 200)

    def test_sin_navegador_reconocible_no_se_bloquea_nada(self):
        """Un cliente que no es un navegador (curl, un script) no queda fuera."""
        self.assertEqual(self._login('ana@correo.com', navegador='curl/8.0').status_code, 200)
        self.assertEqual(self._login('beto@correo.com', navegador='curl/8.0').status_code, 200)


class LogoutRevocationApiTests(APITestCase):
    """El logout revoca server-side los tokens ya emitidos (versión de token)."""

    def setUp(self):
        cache.clear()  # aísla el throttle de login (5/min) entre tests
        self.user = User.objects.create_user(
            email='revoke@correo.com', password=STRONG_PASSWORD
        )
        resp = self.client.post(
            reverse('users:token_obtain_pair'),
            {'email': 'revoke@correo.com', 'password': STRONG_PASSWORD},
            format='json',
        )
        self.access = resp.data['access']
        self.refresh = resp.data['refresh']

    def _auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_logout_invalida_access_y_refresh(self):
        self._auth(self.access)
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 200)

        # Cierra sesión: revoca en el servidor.
        self.assertEqual(
            self.client.post(reverse('users:logout')).status_code,
            status.HTTP_205_RESET_CONTENT,
        )

        # El access anterior ya no sirve.
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 401)

        # El refresh anterior ya no emite tokens.
        self.client.credentials()
        r = self.client.post(
            reverse('users:token_refresh'), {'refresh': self.refresh}, format='json'
        )
        self.assertEqual(r.status_code, 401)

    def test_reinicio_de_sesion_funciona_tras_logout(self):
        self._auth(self.access)
        self.client.post(reverse('users:logout'))
        self.client.credentials()

        # Un login nuevo debe funcionar de inmediato (sin ambigüedad temporal).
        r = self.client.post(
            reverse('users:token_obtain_pair'),
            {'email': 'revoke@correo.com', 'password': STRONG_PASSWORD},
            format='json',
        )
        self.assertEqual(r.status_code, 200)
        self._auth(r.data['access'])
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 200)


class MeUpdateApiTests(APITestCase):
    """Edición del propio perfil (PATCH /api/me/)."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='self@correo.com', password=STRONG_PASSWORD
        )
        self.client.force_authenticate(user=self.user)
        self.url = reverse('users:me')

    def test_edita_su_nombre(self):
        resp = self.client.patch(
            self.url, {'first_name': 'Ada', 'last_name': 'Lovelace'}, format='json'
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['full_name'], 'Ada Lovelace')

    def test_no_puede_auto_escalar_rol_ni_staff(self):
        self.client.patch(
            self.url, {'role': 'admin', 'is_staff': True}, format='json'
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, 'consulta')
        self.assertFalse(self.user.is_staff)

    def test_no_puede_dejar_el_apellido_vacio(self):
        """QA: desde el perfil se guardaba el apellido en blanco."""
        self.user.first_name = 'Ada'
        self.user.last_name = 'Lovelace'
        self.user.save()

        resp = self.client.patch(self.url, {'last_name': ''}, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('last_name', resp.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.last_name, 'Lovelace')

    def test_no_puede_dejar_el_nombre_vacio(self):
        resp = self.client.patch(self.url, {'first_name': ''}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('first_name', resp.data)

    def test_solo_espacios_tampoco_cuenta_como_nombre(self):
        resp = self.client.patch(self.url, {'last_name': '   '}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_guardar_solo_el_acento_no_exige_reenviar_el_nombre(self):
        """El PATCH es parcial: el selector de color manda solo `accent`."""
        resp = self.client.patch(self.url, {'accent': 'rosa'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.accent, 'rosa')


class ChangePasswordApiTests(APITestCase):
    """Cambio de la propia contraseña (POST /api/auth/password/)."""

    NEW_PASSWORD = 'NuevaClave-2026'

    def setUp(self):
        cache.clear()  # aísla el throttle 'login' entre tests
        self.user = User.objects.create_user(
            email='pass@correo.com', password=STRONG_PASSWORD
        )
        self.client.force_authenticate(user=self.user)
        self.url = reverse('users:change_password')

    def test_contrasena_actual_incorrecta(self):
        resp = self.client.post(
            self.url,
            {'current_password': 'incorrecta', 'new_password': self.NEW_PASSWORD},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)

    def test_contrasena_nueva_debil_rechazada(self):
        resp = self.client.post(
            self.url,
            {'current_password': STRONG_PASSWORD, 'new_password': '123'},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)

    def test_cambio_exitoso_revoca_y_reemite(self):
        version_previa = self.user.token_version
        resp = self.client.post(
            self.url,
            {'current_password': STRONG_PASSWORD, 'new_password': self.NEW_PASSWORD},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.NEW_PASSWORD))
        self.assertGreater(self.user.token_version, version_previa)


class MeApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='me@correo.com', password=STRONG_PASSWORD, first_name='Ada'
        )
        self.url = reverse('users:me')

    def test_me_requiere_autenticacion(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_devuelve_perfil_autenticado(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['email'], 'me@correo.com')
        self.assertEqual(resp.data['full_name'], 'Ada')
        self.assertNotIn('password', resp.data)
