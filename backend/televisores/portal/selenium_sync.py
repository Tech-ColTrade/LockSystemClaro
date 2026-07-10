"""Automatización del portal WhaleTV Lock Management con Selenium.

Portado (recortado) de whaletv/portal_sync.py: solo habilitar/inhabilitar.
Flujo: login -> buscar el MAC -> abrir Detail -> Edit -> fijar Lock/Unlock (+
Next Installment Date) -> Save. Es la única vía que permite BLOQUEAR.

El portal es una SPA en Vue + Element-UI; se controla como un humano. Los
selectores se basan en texto/atributos estables (no en los data-v-* dinámicos).
"""
from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass, field

from django.conf import settings
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


@dataclass
class ResultadoSync:
    ok: bool = False
    error: str = ''
    aplicado: bool = False
    remoto_inhabilitado: bool | None = None
    log: list = field(default_factory=list)

    def paso(self, msg: str):
        self.log.append(msg)


def _esperar_carga(driver, timeout=20):
    """Espera a que desaparezcan las máscaras de carga de Element-UI.

    El portal muestra overlays `.el-loading-mask` que interceptan los clics; hay
    que esperar a que se oculten antes de interactuar.
    """
    try:
        WebDriverWait(driver, timeout).until(
            lambda d: all(
                not m.is_displayed()
                for m in d.find_elements(By.CSS_SELECTOR, '.el-loading-mask')
            )
        )
    except Exception:  # noqa: BLE001
        pass


def _click(driver, el):
    """Clic robusto: intenta el clic normal y cae a JS si algo lo intercepta."""
    try:
        el.click()
    except Exception:  # noqa: BLE001
        driver.execute_script("arguments[0].click();", el)


def _build_service() -> Service:
    """Servicio de chromedriver, silencioso y sin ventana de consola.

    En Windows, chromedriver arranca con una consola propia que aparece como un
    recuadro negro por encima de todo, aunque Chrome vaya en headless. Se evita
    con CREATE_NO_WINDOW, que hay que pasar dentro de `popen_kw`: el constructor
    de Service lo saca de ahí (`popen_kw.pop('creation_flags')`), no lo acepta
    como argumento suelto.
    """
    kwargs = {}

    chromedriver = os.environ.get('CHROMEDRIVER')
    if chromedriver:
        kwargs['executable_path'] = chromedriver
    # Sin executable_path, Selenium Manager resuelve el driver solo.

    if sys.platform == 'win32':
        kwargs['popen_kw'] = {'creation_flags': subprocess.CREATE_NO_WINDOW}

    # Los logs del driver no aportan nada y ensucian la salida de gunicorn.
    return Service(log_output=subprocess.DEVNULL, **kwargs)


def _build_driver(headless: bool):
    options = Options()
    if headless:
        options.add_argument('--headless=new')
    options.add_argument('--window-size=1280,800')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--disable-extensions')
    options.add_argument('--no-first-run')
    options.add_argument('--mute-audio')
    options.add_argument('--blink-settings=imagesEnabled=false')
    options.add_experimental_option('excludeSwitches', ['enable-automation'])

    chrome_bin = os.environ.get('CHROME_BIN')
    if chrome_bin:
        options.binary_location = chrome_bin

    return webdriver.Chrome(service=_build_service(), options=options)


def _login(driver, wait, cfg, res):
    res.paso('Abriendo login...')
    driver.get(cfg['LOGIN_URL'])

    email = wait.until(EC.presence_of_element_located((By.NAME, 'account')))
    password = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
    email.clear()
    email.send_keys(cfg['EMAIL'])
    password.clear()
    password.send_keys(cfg['PASSWORD'])

    # El portal muestra un overlay de carga al abrir; esperar antes de clicar.
    _esperar_carga(driver)
    boton = wait.until(EC.element_to_be_clickable(
        (By.XPATH, "//button[.//span[normalize-space(text())='Login']]")
    ))
    _click(driver, boton)
    wait.until(EC.url_contains('deviceManage'))
    res.paso('Sesión iniciada.')


def _macs_visibles(driver):
    selectores = [
        '.el-table__fixed .el-table__fixed-body-wrapper .el-table__row',
        '.el-table__body-wrapper .el-table__row',
    ]
    for sel in selectores:
        filas = driver.find_elements(By.CSS_SELECTOR, sel)
        macs = [f.text.strip().upper() for f in filas]
        if any(m for m in macs):
            return macs
    return []


def _abrir_detalle_en_indice(driver, wait, indice, mac, res):
    detalles = driver.find_elements(
        By.XPATH,
        "//div[contains(@class,'el-table__fixed-right')]//a[contains(@class,'toDetail')]",
    )
    if not detalles:
        detalles = driver.find_elements(By.XPATH, "//a[contains(@class,'toDetail')]")
    if indice >= len(detalles):
        raise RuntimeError('No encontré el link Detail de la fila localizada.')

    link = detalles[indice]
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", link)
    try:
        link.click()
    except Exception:  # noqa: BLE001
        driver.execute_script("arguments[0].click();", link)

    wait.until(EC.presence_of_element_located(
        (By.XPATH, "//strong[normalize-space(text())='Device Info']")
    ))

    mac_norm = mac.strip().upper()
    try:
        WebDriverWait(driver, 12).until(
            lambda d: mac_norm in d.find_element(By.CSS_SELECTOR, '.device-info').text.upper()
        )
        res.paso('Datos del dispositivo cargados en Detail.')
        return True
    except Exception:  # noqa: BLE001
        res.paso('Detail sin datos del dispositivo (el click no llevó el MAC).')
        return False


def _abrir_detalle_por_mac(driver, wait, cfg, mac, res, max_paginas=20):
    if 'deviceList' not in driver.current_url:
        driver.get(cfg['DEVICE_LIST_URL'])
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.el-table__row')))

    mac_norm = mac.strip().upper()
    pagina = 0
    for pagina in range(1, max_paginas + 1):
        macs = _macs_visibles(driver)
        res.paso(f'Página {pagina}: {len(macs)} dispositivos.')
        for i, m in enumerate(macs):
            if mac_norm in m:
                res.paso(f'MAC {mac} encontrado (página {pagina}, fila {i + 1}).')
                return _abrir_detalle_en_indice(driver, wait, i, mac, res)
        try:
            siguiente = driver.find_element(By.CSS_SELECTOR, '.el-pagination .btn-next')
            if siguiente.get_attribute('disabled'):
                break
            driver.execute_script("arguments[0].click();", siguiente)
            wait.until(EC.staleness_of(
                driver.find_element(By.CSS_SELECTOR, '.el-table__row')
            ))
        except Exception:  # noqa: BLE001
            break

    res.paso(f'MAC {mac} NO encontrado (revisé hasta {pagina} páginas).')
    return False


def _leer_estado_remoto(driver, res):
    inhabilitado = None
    try:
        uses = driver.find_elements(By.CSS_SELECTOR, '.save-mode use')
        for u in uses:
            h = (u.get_attribute('xlink:href') or u.get_attribute('href') or '').lower()
            if 'unlock' in h:
                inhabilitado = False
                break
            if 'lock' in h:
                inhabilitado = True
                break
    except Exception:  # noqa: BLE001
        pass
    res.remoto_inhabilitado = inhabilitado
    return inhabilitado


def _set_lock_select(driver, deseado, res):
    selects = driver.find_elements(By.CSS_SELECTOR, '.el-select')
    if not selects:
        raise RuntimeError('No encontré el select de Lock Status en modo Edit.')

    lock_select = selects[0]
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", lock_select)
    lock_select.click()

    xpath_item = (
        "//div[contains(@class,'el-select-dropdown') and not(contains(@style,'display: none'))]"
        f"//*[contains(@class,'el-select-dropdown__item')][normalize-space(.)='{deseado}']"
    )
    opcion = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, xpath_item))
    )
    opcion.click()

    nuevo = lock_select.find_element(By.CSS_SELECTOR, 'input').get_attribute('value')
    res.paso(f'Lock Status quedó en: "{nuevo}".')
    if nuevo != deseado:
        raise RuntimeError(f'No pude fijar Lock Status en "{deseado}" (quedó "{nuevo}").')


def _set_next_date(driver, fecha, res):
    fecha_str = fecha.strftime('%m/%d/%Y')

    def _inp():
        return driver.find_element(By.CSS_SELECTOR, '.el-date-editor input')

    try:
        inp = _inp()
    except Exception:  # noqa: BLE001
        res.paso('No encontré el campo de fecha; lo omito.')
        return

    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", inp)
    inp.click()
    inp.send_keys(Keys.CONTROL, 'a')
    inp.send_keys(Keys.DELETE)
    inp.send_keys(fecha_str)
    inp.send_keys(Keys.ENTER)

    try:
        neutro = driver.find_element(
            By.XPATH, "//strong[normalize-space(text())='Device Info']"
        )
        driver.execute_script("arguments[0].click();", neutro)
    except Exception:  # noqa: BLE001
        driver.execute_script("document.body.click();")

    actual = ''
    try:
        actual = _inp().get_attribute('value') or ''
    except Exception:  # noqa: BLE001
        pass

    if fecha_str not in actual:
        try:
            inp = _inp()
            driver.execute_script(
                """
                const el = arguments[0], val = arguments[1];
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', {bubbles: true}));
                el.dispatchEvent(new Event('change', {bubbles: true}));
                """,
                inp, fecha_str,
            )
            inp.send_keys(Keys.ENTER)
            driver.execute_script("document.body.click();")
            actual = _inp().get_attribute('value') or ''
        except Exception as e:  # noqa: BLE001
            res.paso(f'Fallback de fecha por JS falló: {e}')

    res.paso(
        f'Next Installment Date: {fecha_str}'
        + ('' if fecha_str in actual else f' (⚠ quedó "{actual}")')
    )


def _aplicar_estado(driver, wait, televisor, res, sincronizar_fecha=True):
    _esperar_carga(driver)
    edit = wait.until(EC.element_to_be_clickable(
        (By.XPATH, "//button[.//span[normalize-space(text())='Edit']]")
    ))
    _click(driver, edit)
    wait.until(EC.presence_of_element_located(
        (By.XPATH, "//button[.//span[normalize-space(text())='Save']]")
    ))
    _esperar_carga(driver)

    deseado = 'Lock' if televisor.inhabilitado else 'Unlock'
    _set_lock_select(driver, deseado, res)

    if sincronizar_fecha and televisor.fecha_sincronizar:
        _set_next_date(driver, televisor.fecha_sincronizar, res)

    _esperar_carga(driver)
    save = driver.find_element(
        By.XPATH, "//button[.//span[normalize-space(text())='Save']]"
    )
    driver.execute_script("arguments[0].click();", save)

    WebDriverWait(driver, 15).until(EC.presence_of_element_located(
        (By.XPATH, "//button[.//span[normalize-space(text())='Edit']]")
    ))
    res.paso('Cambios guardados en el portal.')
    res.aplicado = True


def abrir_sesion(headless=None):
    """Abre un navegador y hace login. Devuelve (driver, wait) reutilizable."""
    cfg = settings.WHALETV_PORTAL
    if headless is None:
        headless = cfg.get('HEADLESS', True)
    driver = _build_driver(headless)
    wait = WebDriverWait(driver, cfg.get('TIMEOUT', 30))
    _login(driver, wait, cfg, ResultadoSync())
    return driver, wait


def aplicar_en_sesion(driver, wait, televisor, sincronizar_fecha=True) -> ResultadoSync:
    """Con una sesión ya iniciada: busca el MAC y aplica el estado. Reutilizable
    para lotes (un solo login para muchos televisores)."""
    cfg = settings.WHALETV_PORTAL
    res = ResultadoSync()
    try:
        if not _abrir_detalle_por_mac(driver, wait, cfg, televisor.mac_address, res):
            res.ok = False
            res.error = f'No se encontró el MAC {televisor.mac_address} en el portal.'
            return res
        _aplicar_estado(driver, wait, televisor, res, sincronizar_fecha=sincronizar_fecha)
        _leer_estado_remoto(driver, res)
        res.ok = True
        return res
    except Exception as e:  # noqa: BLE001
        res.ok = False
        res.error = f'{type(e).__name__}: {e}'
        res.paso(f'ERROR: {res.error}')
        return res


def sincronizar_estado(
    televisor, sincronizar_fecha=True, headless=None, progreso=None
) -> ResultadoSync:
    """Aplica el estado (inhabilitado -> Lock / habilitado -> Unlock) en el portal.

    Devuelve un ResultadoSync. Bloqueante (~15-20s): abre un navegador headless.
    `progreso(pct, msg)` (opcional) se llama en cada fase para reportar avance.
    """
    def avisar(pct, msg=''):
        if progreso:
            progreso(pct, msg)

    driver = None
    try:
        avisar(10, 'Abriendo navegador…')
        driver, wait = abrir_sesion(headless)
        avisar(50, 'Sesión iniciada.')
        res = aplicar_en_sesion(driver, wait, televisor, sincronizar_fecha)
        avisar(90, 'Cambios guardados.')
        return res
    except Exception as e:  # noqa: BLE001
        res = ResultadoSync()
        res.ok = False
        res.error = f'{type(e).__name__}: {e}'
        return res
    finally:
        if driver is not None:
            driver.quit()
