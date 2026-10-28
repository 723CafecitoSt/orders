# Order Number, Pager Number y entrega final

Integrado en la caja real y `kitchen/live.html`; no se creó otra aplicación. El Worker sigue deshabilitado para despliegue y los pagos permanecen bloqueados.

## Modelo de D1

Order Number procede de `order_numbers`: único, incremental y compartido entre dispositivos. La caja conectada no permite escribirlo; se asigna al guardar en el servidor. Un borrador offline no tiene todavía número definitivo.

La migración **0011_pager_delivery.sql** añade `order_fulfillment`. Pager Number es opcional, numérico 1–9999 y normalizado (007 equivale a 7). Un índice único parcial impide asignarlo a dos órdenes no entregadas, incluso con solicitudes simultáneas. La creación completa de la orden se revierte si el pager ya está ocupado. No se utiliza INSERT OR IGNORE para ocultar ese conflicto dentro de los triggers.

La copia de creación guarda `initialPagerNumber`; los cambios posteriores actualizan metadata separada con versión y actor. El JSON de productos, modificadores, precios e impuestos no se modifica. El pager final permanece en la orden Delivered y en su auditoría cuando otra orden reutiliza el mismo número. Las órdenes previas a la migración reciben metadata sin pager; no se adivina una asignación histórica.

## Estados y permisos

- Estado global derivado en una lectura consistente de los artículos: New, Preparing (algún artículo Preparing/Ready), Ready (todos Ready). Los artículos conservan sus estados individuales.
- Delivered es final y persistente. Solo Cashier o Administrator puede ejecutarlo, con versión de la orden y todos sus artículos Ready. Libera el pager en la misma transacción, pero no borra su número histórico.
- Cashier/Administrator puede asignar, cambiar o quitar un pager de una orden activa. Un conflicto devuelve el número de la orden que lo está utilizando y obliga a resolverlo; no hay botón para sobreescribir otra asignación.
- Beverages y Food modifican únicamente sus artículos. Una cuenta Kitchen (ambas estaciones) recibe esos dos permisos, sin acceso a precios/pagos ni capacidad de entregar/reasignar. Cashier puede consultar cocina unificada, cambiar pager y entregar; no marca artículos Ready sin permiso de estación. Administrator puede realizar todas estas acciones.
- Reintentos de entrega ya completada no generan otra entrega ni liberan el pager de una orden posterior. Actualizaciones obsoletas o posteriores a Delivered se rechazan. Los cambios y la entrega quedan auditados con el empleado.

## Interfaz existente

La misma pantalla de cocina muestra tarjetas por orden con ORDER y PAGER grandes y de colores diferentes, productos Beverages/Food, notas, estado de cada artículo y estado global. Incluye filtros, páginas y una opción Include Delivered para consultar entregas anteriores. La consulta unificada respeta permisos y no devuelve importes ni datos de pago.

La caja conserva su campo Pager Number y muestra el número del servidor al guardar. D1 Order History en la pestaña existente consulta el pager actual/final y estado desde el servidor; permite cambios autorizados y entrega. Las copias locales se etiquetan Pager at capture para distinguirlas de la metadata actual. Polling actualiza cocina e historial abierto cada cinco segundos; no equivale a entrega instantánea garantizada sin conexión.

Print Kitchen Ticket consulta el snapshot/metadata de D1 justo antes de abrir el diálogo de 80 mm, incluye ORDER # y PAGER # y conserva REPRINT e intentos locales. Se puede imprimir la última orden conectada o una orden seleccionada en D1 History. Un pager cambiado después de imprimir requiere una reimpresión manual. No se ha comprobado impresión física ni se garantiza exactamente una vez entre dispositivos.

Si una creación falla por pager ocupado, la caja conserva el ID pendiente; corregir el pager vuelve a enviar ese mismo ID. Nunca crea otro ID automáticamente para saltarse un conflicto. Si una solicitud anterior ya se confirmó con contenido diferente, el servidor exige revisión en el historial en lugar de duplicarla.

## Pruebas realmente realizadas

- **32 pruebas Node aprobadas**: normalización, pager opcional, conflicto, concurrencia, reasignación, versiones, estado global, entrega, reutilización, copia histórica y auditoría, además de las pruebas anteriores.
- **6 suites Wrangler/workerd + D1 local aprobadas**, con migraciones 0001–0011. La suite nueva prueba dos órdenes simultáneas por un pager, conflicto resuelto con el mismo ID, cuenta Kitchen, permisos por estación, Ready desde sesiones diferentes, Delivered bloqueado hasta completar artículos, reutilización, historia y reintentos idempotentes. Permanecen las pruebas de 500+ artículos, catálogo/impuestos y controles de acceso.
- Sintaxis y hashes CSP actualizados; build estático de las páginas reales, comprobación de configuración y empaquetado Worker con `--dry-run` aprobados.

No hubo prueba visual en un navegador real, dispositivo físico, impresora, migración D1 remota, publicación ni pago. La configuración remota y sus comprobaciones siguen pendientes según REMOTE-TEST-READINESS.md. Revisar 0011 contra la D1 real y su copia de seguridad antes de solicitar autorización para aplicarla.
