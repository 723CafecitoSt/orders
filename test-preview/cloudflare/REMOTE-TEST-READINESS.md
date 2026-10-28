# Estado actual: revisión de un despliegue de pruebas aislado

Este documento sustituye las listas antiguas de bloqueos. El código integrado permite configurar un Worker HTTPS de pruebas, pero **no está desplegado ni habilitado**. No se modificó main, producción, una D1 remota ni Square. La autorización para una migración o un despliegue sigue siendo necesaria.

## Implementado

- `wrangler.private-test.jsonc` utiliza el Worker real, una sola D1, orígenes HTTPS exactos y pagos deshabilitados. `TEST_ENABLED=false`, workers.dev y previews desactivados. UUID ficticio y marcador de identidad impiden activarlo sin configurar la base verificada.
- Autenticación de empleados con PBKDF2 de 600000 iteraciones, contraseña de 14+ caracteres, sesiones aleatorias de una hora y CSRF independiente. Solo hashes de sesión/CSRF se guardan en D1; los tokens permanecen en memoria del navegador. Logout y revocación/inhabilitación están implementados y auditados. No hay registro público de empleados.
- Permisos Administrator, Cashier, Beverages y Food. Cocina no puede consultar catálogo, precios, órdenes completas ni otra estación. Cashier no puede editar catálogo ni administrar empleados.
- CORS de origen exacto, sin cookies de terceros, cabeceras CSRF, límites de cuerpo por bytes, límites de solicitudes atómicos en D1 por IP seudonimizada y por empleado, bloqueo de intentos de contraseña y respuestas sin secretos. Los límites por IP requieren el encabezado confiable que Cloudflare añade en el despliegue real.
- Catálogo D1 autorizado. Menu Manager y Modifier Manager publican cambios solo para Administrator mediante una transacción con control de versión. Cambios concurrentes de catálogo se rechazan. Productos nuevos usan 825 bps si se omite la tasa; editar sin enviar tasa conserva la existente. Se admiten 725 y 0. El impuesto durante una venta no se puede cambiar libremente: UI deshabilitada y validación en servidor.
- Caja real conectada al catálogo del servidor, con almacenamiento separado por API para no sobrescribir el historial offline anterior. Borradores y órdenes pendientes se restauran al recargar; los reintentos conservan ID y contenido. D1 devuelve el número de orden. Un conflicto de contenido requiere revisión, no crea otra orden automáticamente.
- Copias inmutables, números de orden de pruebas, distribución transaccional por estación, estados con versión y auditoría, consultas periódicas y paginación sin tope total de 500. El usuario que está en páginas antiguas debe volver a las nuevas para ver pedidos recién ingresados.
- Print Kitchen Ticket de 80 mm, aviso de REPRINT y registro local de intentos de diálogo. No equivale a impresión física confirmada ni evita una reimpresión desde otro dispositivo.
- CSP con hashes del script de la caja y cocina. El service worker no intercepta ni cachea respuestas de API/autenticadas. Las simulaciones existentes de efectivo y Square se conservan; el Worker no importa un cliente Square y bloquea las rutas de operaciones de pago en modo remoto.

## Despliegue pendiente, no asumir valores

1. Verificar cuenta, nombre y UUID de la D1 de pruebas ya creada, esquema y migraciones aplicadas. No crear una segunda base por suposición. Revisar copia/restauración antes de autorizar cambios.
2. Sustituir el nombre y UUID ficticios de la configuración y el marcador TEST_DATABASE_ID por la identidad verificada; mantener TEST_ENABLED=false. Ejecutar `node scripts/check-private-config.mjs --configured`.
3. Confirmar dos orígenes HTTPS de pruebas. Los dominios orders-test.723cafecitost.com y orders-api-test.723cafecitost.com son **propuestas**, no recursos existentes verificados. La fuente y publicación de GitHub Pages de producción no deben cambiarse. Para Pages con otro origen hace falta un host de publicación separado (por ejemplo, un repositorio que reciba solamente los archivos estáticos compilados y un subdominio de prueba). Crear ese recurso/DNS requiere autorización; no se ha hecho.
4. Configurar personalmente los secretos RATE_LIMIT_SECRET (aleatorio, 32+ caracteres) y BOOTSTRAP_SECRET (aleatorio, 48+ caracteres) en Cloudflare, nunca en GitHub, configuración pública ni chat. No hace falta ningún secreto de Square. BOOTSTRAP_SECRET solo sirve para crear el primer administrador una vez; después se elimina. Los secretos no están configurados todavía.
5. Revisar permisos, migraciones 0001–0011 y recuperación; obtener autorización específica para la D1 de prueba. Solo después aprobar despliegue inicialmente deshabilitado, ruta/TLS, inicialización de administrador y activación de pruebas. No activar Workers Paid ni contratar nada sin permiso.
6. Completar la prueba manual con Samsung y un segundo dispositivo antes de considerar el flujo verificado en navegador. CSP, orígenes, almacenamiento, TLS público y reconexión no se han validado en un teléfono real.

## Verificación local

Consultar PREDEPLOY-SECURITY-REVIEW.md para los resultados y las limitaciones. `npm test`, `npm run test:integration`, `npm run check:test-config` y `npm run build:test-frontend` son operaciones locales. El paquete Worker se comprobó con `wrangler deploy --dry-run`; no se publicó. El registro histórico de imposibilidad de instalar Chromium no se ha transformado en una afirmación de prueba visual.

Actualización integrada de Order/Pager/Delivered: ver [PAGER-DELIVERY.md](PAGER-DELIVERY.md). La migración 0011 solo se ejecutó en D1 local.
