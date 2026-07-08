from django.contrib.auth import get_user_model
from django.test import TestCase

User = get_user_model()


class UserModelTests(TestCase):
    def test_create_user_normaliza_email_y_hashea_password(self):
        user = User.objects.create_user(email='  Juan@Example.COM ', password='Secreta123')

        self.assertEqual(user.email, 'juan@example.com')
        self.assertTrue(user.check_password('Secreta123'))
        self.assertNotEqual(user.password, 'Secreta123')
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.is_active)

    def test_create_user_sin_email_falla(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email='', password='x')

    def test_create_superuser(self):
        admin = User.objects.create_superuser(email='admin@example.com', password='Secreta123')

        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)

    def test_pk_es_uuid(self):
        import uuid

        user = User.objects.create_user(email='pk@example.com', password='Secreta123')
        self.assertIsInstance(user.pk, uuid.UUID)

    def test_full_name(self):
        user = User.objects.create_user(
            email='n@example.com', password='x', first_name='Ada', last_name='Lovelace'
        )
        self.assertEqual(user.full_name, 'Ada Lovelace')
