# Resultado de esta ejecución local

- `npm test`: **32 pruebas aprobadas, 0 fallidas**. Incluye impuestos 825/725/0, defaults y persistencia del producto, copias históricas, permisos, sesiones y revocación, bloqueo de contraseña, CORS/CSRF, límites/cuerpo, publicación de catálogo con control de revisión y componentes reales de la caja en VM.
- `npm run test:integration`: **6 suites aprobadas** con Wrangler 4.154.0/workerd y una D1 local desechable nueva. Se aplicaron únicamente localmente las migraciones 0001–0011.
- Suite de catálogo/UI por API: mismos IDs que la caja; Latte Iced + Caramel y Waffle + Nutella a $17.32 cuando ambos productos están configurados a 8.25%.
- Suite caja/cocina por API: dos sesiones, reintento/concurrencia, copia de notas/modificadores, Ready persistente, conflicto de versión y acceso no autorizado.
- Suite HTTPS: login, CORS, CSRF, precios de servidor, duplicados, permisos, logout y límite de login.
- Suite del Worker privado real dentro del harness local: 4 permisos, cambio de tasas por administrador a 725/0 y nuevo producto 825, rechazo de tasa arbitraria, historia y números, revocación, pagos bloqueados, límite remoto de login y recorrido paginado de más de 500 artículos (505 añadidos como fixture local).
- Suite HTTP heredada: login, persistencia, concurrencia y logout.
- `npm run check:test-config`: aprobado; configuración de prueba separada, orígenes propuestos aislados y activación bloqueada. `npm run build:test-frontend`: aprobado; paquete de las páginas reales con configuración pública sin secretos.
- `wrangler deploy --dry-run --config wrangler.private-test.jsonc`: aprobado; bundle local de aproximadamente 48 KiB, sin importar fixtures, contraseñas de pruebas ni cliente Square. No se publicó ni se contactó una D1 remota.

No hubo navegador real, dispositivos físicos, impresora, Square Sandbox, credenciales Production, contratación ni modificación de main. Las pruebas locales HTTPS usaron un certificado local y desactivaron su verificación solo dentro del proceso de test. Una prueba de API o VM no demuestra que los botones, el navegador móvil, TLS público, impresión o reconexión funcionen visualmente.

Actualización integrada de Order/Pager/Delivered: ver [PAGER-DELIVERY.md](PAGER-DELIVERY.md). La migración 0011 solo se ejecutó en D1 local.
