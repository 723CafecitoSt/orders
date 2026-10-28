# Corrección de autenticación en Workers: PBKDF2

## Evidencia y alcance

En el Worker remoto, la creación inicial devolvió primero 409 genérico y, tras desplegar el diagnóstico autorizado, HTTP 503 `password_hash_unavailable`. Se verificaron 0 empleados y 0 inicializaciones antes de ese diagnóstico. El error identifica el paso de derivación, no revela su excepción interna. Cloudflare documenta en workerd#1346 una diferencia entre los límites nativos de PBKDF2 en local y en su servicio. La prueba del fallback en el Worker remoto sigue pendiente de autorización/despliegue; no se afirma que el administrador ya exista.

## Cambio integrado

`auth.mjs` utiliza `password-kdf.mjs`: mantiene PBKDF2-HMAC-SHA256, 600000 iteraciones, salt aleatorio y resultado hexadecimal de 32 bytes. Prefiere WebCrypto nativo. Solo si recibe `NotSupportedError` deriva el mismo resultado con `@noble/hashes` 2.0.1 (versión exacta y lockfile). No reduce iteraciones ni inventa un KDF encadenado. Otros errores siguen fallando de forma cerrada con `password_hash_unavailable`. La librería queda empaquetada en el Worker: no se descarga del navegador ni en cada solicitud. Los buffers propios de contraseña/salt/resultado se limpian al salir.

No requiere migraciones, cambiar contraseñas existentes, publicar tokens, cambiar frontend, reducir permisos ni habilitar pagos. El único cambio de límite es CPU por solicitud de 1000 a 5000 ms en la configuración de pruebas para dar margen al cálculo JavaScript. No es un techo de factura: siguen aplicando los cargos por uso del plan. Sesiones, CSRF, restricciones de bootstrap, límites de login y bloqueo por cuenta permanecen.

## Pruebas ejecutadas

- `npm test`: 35 aprobadas. Incluye igualdad con `node:crypto.pbkdf2Sync` a 600000 iteraciones para ASCII y UTF8; simulación de límite nativo; creación, login correcto e incorrecto y preservación del formato anterior; errores inesperados no revelan detalles ni crean parcialmente al administrador.
- `npm run test:integration`: 7 suites aprobadas con Wrangler/workerd y D1 local real. Nueva suite invoca bootstrap/login a través del Worker real con un rechazo nativo `NotSupportedError` inyectado únicamente en el arnés local. Verifica persistencia, rechazo de clave incorrecta, verificación nativa del hash creado por fallback y rechazo del segundo bootstrap. Las seis suites anteriores conservan catálogo/impuestos, órdenes, permisos, Ready/Delivered, pagers, reintentos, concurrencia y paginación.
- Tres derivaciones fallback en la suite local: 6049 ms de tiempo de pared total, incluyendo D1/HTTP. **No mide CPU remota ni latencia de cada derivación**. El límite de 5s debe comprobarse en Cloudflare tras despliegue autorizado.
- `wrangler deploy --dry-run --config wrangler.private-test.jsonc`: compilación local 62.39 KiB, gzip 16.41 KiB; no publicación. Configuración base mantiene TEST_ENABLED=false, workers_dev=false y pagos=false. El archivo temporal del operador conserva la activación que autorizó separadamente.

## Próximo cambio remoto, no ejecutado aquí

Tras autorización específica: actualizar módulos, manifest y lockfile de la rama de pruebas, ejecutar npm ci, mantener la D1 verificada, conservar los secretos ya cargados y el estado autorizado de TEST_ENABLED/workers.dev; actualizar el límite CPU a 5000ms en la configuración temporal y desplegar solo este Worker. No volver a aplicar migraciones.

Antes de repetir bootstrap comprobar que el estado sigue sin inicializar si hubo una respuesta incierta. No copiar claves desde máscaras. El operador conserva el secreto aleatorio en memoria local y lo envía sin mostrarlo; nunca compartirlo por chat. Confirmar la respuesta y el registro de administrador antes de eliminar BOOTSTRAP_SECRET. No afirmar éxito de un login remoto ni habilitar el frontend conectado hasta comprobarlo.
