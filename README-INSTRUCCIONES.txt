723 ORDER STATION — INSTRUCCIONES
=================================

1. Entra a https://github.com/723CafecitoSt e inicia sesión.
2. Crea un repositorio PUBLICO nuevo llamado exactamente: orders
   (No modifiques el repositorio de tu menú actual).
3. Dentro de orders selecciona Add file > Upload files.
4. Descomprime el ZIP y sube los CUATRO archivos directamente a la RAÍZ del repositorio:
   index.html, sw.js, manifest.webmanifest, icon.svg
   (NO subas la carpeta que los contiene; los archivos deben quedar en la raíz).
5. Confirma los cambios (Commit changes).
6. Ve a Settings > Pages. En Build and deployment selecciona Deploy from a branch,
   Branch: main, Folder: /(root). Presiona Save.
7. Espera unos minutos y abre https://723cafecitost.github.io/orders/
8. En tu Samsung: abre esa dirección en Chrome > menú de tres puntos > Add to Home screen
   o Install app (el nombre puede variar).
9. Para probar modo sin internet: abre la aplicación con internet al menos una vez,
   espera a que cargue, ciérrala, activa modo avión y vuelve a abrirla.
10. Para Jesús en iPhone: abre la misma dirección en Safari > Share > Add to Home Screen.
    Los datos NO se sincronizan entre ambos celulares; Menu Manager > Export menu e
    Import menu permite pasar la configuración manualmente.

USO
---
- New Order: agrega productos, temperatura, sabores, extras, toppings y notas.
- Escribe el pager. La fecha/hora se propone automáticamente y el número de orden avanza
  al presionar Save order.
- Copy ticket: copia todo el texto para pegarlo en Fun Print.
- Print: abre el diálogo de impresión del teléfono (requiere impresora compatible).
- Save order: guarda la comanda en History y abre una orden nueva.
- History: Copy, Print o Load para revisar una orden anterior.
- Menu Manager: agregar, editar, ocultar, borrar, exportar o importar productos.

IMPORTANTE
----------
- El funcionamiento offline requiere que la aplicación se haya instalado/cacheado
  correctamente en el teléfono; no funcionará offline en su primera visita.
- Las órdenes y el menú se guardan en el almacenamiento local del navegador.
  Borrar datos del sitio, reinstalar, usar incógnito o perder el teléfono puede borrarlos.
  Exporta respaldos regularmente.
- El número de orden es local a cada teléfono: si ambos capturan pedidos,
  podrían repetirse números. Coordinen un dispositivo principal o series distintas.
- La impresora Cabaro/Fun Print no está verificada para impresión directa de Android.
  El botón Copy ticket es el flujo previsto con Fun Print.
- El papel de 2 pulgadas puede requerir ajustar fuente y formato en Fun Print.
- La aplicación no cobra, no se conecta a Square y no guarda datos en un servidor.
- En algunas versiones de iOS las PWAs pueden tener limitaciones de almacenamiento.
- Para actualizar código offline, vuelve a subir archivos y cambia el nombre CACHE en sw.js.
