# Revisión previa al despliegue de pruebas

## Resultado

El código principal de acceso remoto está integrado y se ejercita localmente; la configuración de despliegue está separada y deshabilitada. **No se declara listo ni seguro un despliegue real todavía**: faltan identidad/esquema D1, orígenes/TLS, secretos, revisión de configuración y pruebas manuales en navegadores. Esta es una revisión propia del código y pruebas automatizadas; no una auditoría independiente ni una certificación.

## Controles implementados

- Un solo Worker de pruebas y una sola D1, pagos bloqueados por ruta y configuración, sin cliente Square en el bundle. Sin fixtures ni contraseñas de pruebas en el bundle desplegable.
- Sesiones de una hora, hashes en D1, tokens y CSRF solo en memoria del cliente. Sin cookies cross-site ni dependencia de cookies de terceros. El PIN antiguo sigue siendo solo un bloqueo de pantalla, no autentica al backend.
- Empleados aprovisionados por Administrator; roles separados; primer administrador requiere secreto aleatorio de uso único y base sin empleados. No hay registro público. Revocar/inhabilitar borra sesiones y se audita en una transacción.
- CORS exacto, validación de Origin, CSRF y bearer en rutas autenticadas; rechazo de origen/configuración de producción, tamaño JSON acotado por bytes y errores sin tokens o SQL. CSP de scripts con hashes; estilos inline se conservan por el diseño actual. No se debe atribuir protección frame-ancestors a una meta CSP.
- Rate limit centralizado en D1: 120 solicitudes/minuto por IP seudonimizada, 180 por empleado, 5 logins/minuto por IP en modo remoto y bloqueo de cuenta tras 5 fallos por 15 minutos. Limpieza incremental de contadores viejos; los nombres de cuenta inexistentes no generan registros persistentes. Se confía en CF-Connecting-IP solo en el Worker real de Cloudflare, no como encabezado de confianza en un servidor de origen sin protección.
- Precios, tasas, modificadores y estaciones del servidor; publicación de catálogo con revisión transaccional. Nuevos productos 825 bps por API; las tasas de productos existentes no son alteradas por migraciones. Se validan temperatura/Light Ice y selección. No hay override de impuesto autorizado durante la venta: se rechaza y debe cambiarse el producto mediante un administrador.
- Identidad estable de solicitud, copia inmutable y número del servidor; reintentos idénticos devuelven la misma orden. Cambios de contenido/empleado con el mismo ID se rechazan. Órdenes históricas sin huella no se convierten en nuevas por reintento.
- Estado de cocina con versión, auditoría del actor y paginación por cursor; cocina no recibe importes, pagos ni identificadores de sesión/empleado. El service worker no cachea respuestas autenticadas, API o de otro origen.

## Comprobado localmente

- `npm test`: 28 pruebas aprobadas, 0 fallidas. Incluye las tres tasas y orden mixta, default 825, cambios 725/0, persistencia histórica, revisión de catálogo y componentes reales de Menu Manager en VM.
- `npm run test:integration`: cinco suites con Wrangler 4.154.0 y una D1 desechable real local, migraciones 0001–0010. Se ejercita el código del Worker remoto sin desplegarlo, dos sesiones, permisos/denegaciones, revocación, source rate limit, catálogo, copias históricas, reintentos/concurrencia, Ready y más de 500 artículos paginados.
- `npm run check:test-config`: aislamiento propuesto, sin secretos en vars y activación bloqueada. `npm run build:test-frontend`: empaqueta la caja y cocina reales, no otro frontend. `wrangler deploy --dry-run --config wrangler.private-test.jsonc`: compila localmente sin publicar ni usar una base remota.
- La verificación del certificado se desactiva solo en los tests HTTPS de localhost; no se ha validado TLS público. No se ejecutaron botones ni vistas en un navegador real, no se probó impresión física ni una operación Square Sandbox.

## Requisitos antes de autorizar una migración o despliegue

1. Confirmar cuenta, nombre y UUID de la D1 de pruebas; inspeccionar esquema, datos y migraciones existentes. El historial no se debe borrar para adaptar el esquema.
2. Revisar el SQL pendiente y preparar export/backup y recuperación; migraciones 0009/0010 son aditivas, pero deben comprobarse contra la base real. Los permisos heredados conservan el acceso anterior; deben revisarse antes de habilitar empleados.
3. Elegir y configurar hosts HTTPS aislados. GitHub Pages de orders no se puede cambiar a otra fuente sin afectar su publicación actual: se necesita un destino de publicación de pruebas separado y un origen distinto. El paquete estático ya está preparado; no se creó ese recurso ni DNS.
4. Actualizar el nombre/UUID de D1 y los orígenes de frontend/Worker/config/CSP; ejecutar `check-private-config.mjs --configured`. Configurar RATE_LIMIT_SECRET y BOOTSTRAP_SECRET personalmente como secretos de Cloudflare, no enviarlos por chat ni guardarlos en GitHub. No configurar secretos Square. Autorizar el uso del plan Paid si todavía no está activo.
5. Autorizar por separado migración a esa D1 y despliegue inicialmente deshabilitado. Revisar ruta pública, TLS, credenciales y controles antes de TEST_ENABLED=true. Crear el primer administrador mediante el procedimiento seguro y eliminar BOOTSTRAP_SECRET. La API tendrá un login HTTPS accesible, pero sus datos requerirán sesión y permisos; no es una red privada ni está configurada con Cloudflare Access.
6. Revisar métricas de CPU y D1 tras la prueba autorizada, sin reducir la protección de contraseñas. El límite de CPU del paquete es 1000 ms por petición; no implica un techo de facturación ni se ha medido CPU en Cloudflare remoto.
7. Ejecutar pruebas manuales en Samsung y otro dispositivo. Revisar modificaciones de impuestos, pérdida de red, recarga y permisos. Confirmar impresión solo después de inspeccionar físicamente el papel. Los registros de impresión son locales, no una exclusión mutua global entre impresoras/dispositivos.

## Prueba manual prevista

Con datos únicamente de pruebas: administrador revisa catálogo/tasas, cajero crea Latte Iced + Caramel y Waffle + Nutella. Si ambos están configurados a 8.25%, sus precios de prueba $8 y $8 deben producir $17.32. Beverages y Food ven solo su parte; uno marca Ready y otra sesión observa el estado. Repetir tras recarga/pérdida de conexión sin cambiar ID. Administrador cambia un producto a 7.25% y otro a 0%; una nueva orden usa esas tasas y la antigua conserva su total. Verificar rechazo de una cuenta sin permiso, logout/revocación y vistas de 80 mm con REPRINT. No se procesa ningún cobro.
