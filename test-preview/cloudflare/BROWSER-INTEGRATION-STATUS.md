# Interfaz integrada: qué se probó y qué no

La caja sigue siendo `test-preview/index.html`; no hay otra aplicación de caja. La pantalla integrada de cocina es `cloudflare/kitchen/live.html`. `test-backend-config.js` es configuración pública sin secretos, deshabilitada por defecto y restringida al origen de pruebas configurado. El frontend y el Worker normal permanecen cerrados/desconectados hasta autorización y configuración.

## Cambios actuales

La caja conectada carga productos, modificadores, precios y tasas desde D1. Administrator publica cambios desde Menu Manager/Modifier Manager; se aplica control de versión y auditoría. Nuevo producto: 8.25% seleccionado; existentes: conservan sus tasas. Las tasas por venta están bloqueadas; el servidor rechaza un cambio no autorizado. Se mantienen las simulaciones y el historial offline separado; ninguna venta antigua se recalcula.

Las sesiones viven en memoria y expiran a la hora. Recargar exige iniciar sesión otra vez y recupera el borrador/solicitud guardada sin cambiar su identificador. El servidor valida el contenido y devuelve la copia ya guardada en reintentos; no se marca una orden como pagada. Cocina utiliza los permisos de estación, número de orden del servidor, actualizaciones con versión y páginas estables.

Impresión: vista de 80 mm mediante diálogo estándar, registros locales y confirmación explícita de REPRINT. No se probó impresora y no hay garantía de impresión exactamente una vez ni registro de impresiones entre dispositivos.

## Pruebas

- Pruebas Node: lógica de impuestos, catálogo, controles del Worker, permisos, CSRF, sesiones, revocación, auditoría, validación de origen, límites, recuperación/reintentos e historial. Se ejercitó la función real de Menu Manager en VM para comprobar el valor seleccionado y guardado de impuestos; VM no es un navegador.
- Wrangler/workerd + D1 local: rutas reales de la caja/cocina y del Worker privado, dos sesiones independientes, datos Latte Iced + Caramel y Waffle + Nutella, importes, cambios autorizados 725/0 y nuevo producto 825, denegación de tasa arbitraria, reintentos simultáneos, estados, permisos, revocación, rate limit y paginación con más de 500 artículos.
- Sintaxis de scripts/CSP, paquete estático y compilación local del Worker. El proceso de build no despliega nada.
- No hubo prueba visual, de botones reales, de Samsung ni de un segundo dispositivo físico. La instalación previa de Chromium falló con archivos descargados vacíos/truncados. Las pruebas HTTPS usan certificado local y verificación de certificado desactivada solamente en los procesos de prueba.

Antes de declarar el despliegue seguro hay que verificar la identidad de D1, configurar orígenes/secretos y revisar el esquema real, luego autorizar la infraestructura de prueba y ejecutar las pruebas manuales. Ver REMOTE-TEST-READINESS.md y PREDEPLOY-SECURITY-REVIEW.md.
