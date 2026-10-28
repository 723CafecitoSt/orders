# Efectivo solo en 723: preparación local, pendiente de autorización remota

## Decisión vigente

Las ventas en efectivo se registrarán únicamente en 723 Order Station/D1. No se enviarán a Square Orders ni Payments. Square queda reservado para la futura integración de tarjetas. No se necesita Access Token, Application ID ni Location ID de Square para este flujo. La preparación provisional de red Square Sandbox CASH fue descartada antes de cualquier commit, despliegue o migración. El módulo antiguo de construcción de payloads Square es código de referencia no importado por el Worker; no autoriza registrar efectivo en Square.

## Integración

La migración aditiva `0013_internal_cash.sql` crea un libro de efectivo inmutable, separado de los snapshots de órdenes. Guarda número/fecha de negocio, empleado, subtotal, impuesto, total, recibido, cambio, hash del snapshot y ambiente `test`. No modifica órdenes ni tickets anteriores. Los registros no se pueden editar/borrar; ajustes, devoluciones y anulaciones requieren una fase explícita posterior.

`internal-cash.mjs` reutiliza exclusivamente los importes del snapshot persistido por el servidor. Los identificadores determinísticos y la reserva única de `payment_attempts.order_id` impiden registros duplicados entre dispositivos y bloquean un cobro diferente mientras ya exista otra operación. Registro, reserva y auditoría se confirman en la misma transacción. Un reintento idéntico devuelve el comprobante original; cambiar el recibido tras registrarlo produce conflicto y no sobrescribe datos. El actor original se conserva aunque otra sesión consulte/reintente.

Endpoints integrados bajo autenticación/CSRF/CORS/rate limits existentes:

- GET `/api/cash/config`: disponibilidad del modo de prueba; sin secretos.
- POST `/api/cash`: solo `orderId` y `receivedCents`; recibido y cambio se validan en centavos. Se rechazan totales/tasas enviados por el cliente.
- GET `/api/cash?orderId=...`: recuperar el resultado tras perder una respuesta o recargar.
- GET `/api/cash/history`: paginación por cursor, filtro opcional de fecha; registros sincronizados.
- GET `/api/cash/summary?date=YYYY-MM-DD`: resumen por fecha de negocio, solo Administrator.

Cashier/Administrator pueden registrar/consultar; Beverages/Food/Kitchen no reciben efectivo ni sus reportes. Las rutas y payloads de cocina siguen sin información de pago.

## Interfaz real preparada

Se modifica el botón Cash Payment de la caja existente, sin otra demostración. La simulación sigue seleccionada al abrir/iniciar sesión. `Record in 723 · TEST ONLY · no Square` solo se puede seleccionar si el backend lo habilita y el empleado tiene permiso. Se guarda la orden en D1 una vez, y el efectivo se registra sobre su ID existente; no se crea otra orden ni se reenvían tickets de cocina. También se puede seleccionar una orden desde D1 History.

El modal muestra número/fecha/pager, total autorizado, recibido/cambio y confirmación explícita de TEST. Cancelar antes de confirmar no registra nada. Una solicitud incierta conserva ID y recibido en almacenamiento separado por API; Resume pending cash consulta el servidor antes de reintentar. No se marca como registrado offline. Un resultado ya guardado muestra el comprobante anterior en vez de iniciar otro cobro. Se prepararon historial de efectivo, resumen diario de administrador y exportación JSON paginada del ledger; la exportación del ledger no sustituye un respaldo completo de D1 ni contiene por sí sola todos los snapshots de productos.

Para respetar la autorización por despliegue, la modificación de la página y sus dos pruebas VM se conservan en `review/internal-cash-ui.patch`. **No se aplicó este patch al frontend publicado**. El backend puede guardarse en la rama sin modificar la página pública; las compilaciones automáticas del Worker continúan deshabilitadas según confirmación previa del operador.

## Pruebas realizadas

- 49 pruebas Node aprobadas en la copia de trabajo completa: incluye dos pruebas VM de los handlers y calculador reales del HTML pendiente, cuatro pruebas del ledger y una prueba de la API privada. Las dos pruebas de UI se incluyen en el patch; el código backend guardado sin aplicar el patch contiene 47 pruebas Node.
- 9 suites Wrangler/workerd con D1 local real, HTTPS/HTTP, migraciones 0001–0013. Nueva suite verifica $17.32, recibido $20, cambio $2.68; dos sesiones simultáneas, respuesta perdida/reintento, recibido distinto rechazado, permisos/CSRF, persistencia y resumen diario, conservación de órdenes/cocina y logout.
- Pruebas unitarias adicionales: tasas 825/725/0 combinadas, cantidades/topping incluido, fallo de auditoría con rollback de recibo y reserva, snapshots inalterados, registros inmutables, paginación y flag cerrado por defecto. El test API intercepta fetch y confirma cero llamadas externas.
- Build estático de la caja/cocina reales, hashes CSP y revisión de configuración comprobados. Compilación con Wrangler `--dry-run`, sin publicación.
- No se ejecutó navegador real para los nuevos botones. No se aplicó 0013 remotamente, no se registró efectivo remoto, no se configuraron secretos Square y no se realizaron cobros reales. Los anteriores ensayos manuales caja/cocina remotos siguen siendo válidos para su versión desplegada.

## Activación pendiente

Mantener `PAYMENTS_ENABLED=false`. La configuración base incluye `CASH_RECORDING_ENABLED=false`: sin el flag explícito las rutas de escritura siguen cerradas y la UI continúa en simulación. Se requiere bookmark reciente y autorización específica para aplicar exclusivamente 0013 a la D1 verificada de pruebas. Después se necesita autorización de despliegue del backend y del patch de frontend y de habilitación de `CASH_RECORDING_ENABLED=true` solo para pruebas. Ningún secreto nuevo es necesario. No recrear BOOTSTRAP_SECRET ni activar Square.

Primera prueba remota propuesta: orden guardada con total $17.32; seleccionar modo de registro interno TEST, recibido $20, cambio $2.68; confirmar una vez, consultar desde segundo dispositivo, reintentar y comprobar un único recibo/resumen. Verificar Cancel y desconexión/reconexión. Antes de uso con clientes faltan habilitación/datos de producción separados, prueba de navegador de este flujo y procedimiento de ajustes/devoluciones/cierre de caja. No confundir un registro administrativo de efectivo con verificación física del dinero recibido.
