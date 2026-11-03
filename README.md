# Infinity Glass — demo de la tienda

Demo navegable de la tienda de iPhones **Infinity Glass**, para revisión del
cliente antes de implementarla en Tiendanube.

Sitio estático: HTML, CSS y JavaScript, sin servidor ni base de datos.

## Verlo publicado

Cada push a `main` lo publica solo en GitHub Pages (ver
`.github/workflows/pages.yml`). Para que funcione la primera vez hay que
entrar una sola vez a **Settings → Pages** y poner, en *Build and deployment*,
la fuente en **GitHub Actions**.

## Pantallas

| Archivo | Pantalla |
|---|---|
| `index.html` | Inicio, con el iPhone en 3D del banner |
| `catalogo.html` | Catálogo, con filtros y buscador |
| `producto.html` | Ficha de equipo usado, con visor 360 |
| `producto-nuevo.html` | Ficha de equipo nuevo sellado, con color y capacidad |
| `accesorios.html` | Accesorios |
| `carrito.html` | Carrito |
| `nosotros.html` | Nosotros |
| `producto-movil.html` | Ficha de producto dibujada para teléfono; pantalla de referencia del diseño — las demás ya se adaptan solas |

## Cómo está armado

El diseño vive en un lienzo aparte, donde cada pantalla es una plantilla con
huecos `{{...}}`, repeticiones y condicionales. Fuera de ese lienzo no existe
el motor que los resuelve, así que `motor.js` (unas 180 líneas, sin
dependencias) hace ese trabajo: resuelve los huecos, repite las listas, decide
los condicionales, engancha los eventos y vuelve a dibujar cuando cambia el
estado. Por eso las páginas son interactivas de verdad y no capturas.

El iPhone del banner es un modelo 3D real que se dibuja con WebGL:

- `3d/iphone.glb` — el modelo, comprimido con meshopt y texturas WebP
  (3,9 MB → 578 KB, sin diferencia visible).
- `3d/tres.min.js` — three.js recortado a lo que usa esta página.
- `3d/fono3d.js` — monta el modelo, lo encuadra y lo deja girar arrastrándolo.
- `3d/iphone-datos.js` — el mismo modelo escrito como texto, de respaldo para
  los servidores que no entregan archivos `.glb`.

Nada de eso se descarga hasta que el banner entra en pantalla, y no se
descarga en absoluto si el visitante pidió menos movimiento, va con ahorro de
datos o su equipo no tiene WebGL: en ese caso el banner se queda con un
teléfono dibujado con CSS.

## Peso

Primera visita al inicio: ~1,8 MB (con el 3D) o ~950 KB sin él. Las demás
pantallas, entre 276 y 380 KB.

## Qué NO hace, por ser una demo

- No hay pasarela de pago ni checkout real.
- Los productos, precios y existencias son datos de ejemplo.
- El buscador solo recorre los equipos de ejemplo de la demo.
- Faltan fotos reales: donde dice "FOTO PENDIENTE" va material del cliente.
- Las páginas llevan `noindex` para que no las indexen mientras sea una demo.
  **Hay que quitarlo al pasar a producción.**

## Pendiente antes de publicar como algo más que demo

- Confirmar la licencia del modelo 3D (viene de Sketchfab). Si es CC-BY hay
  que acreditar al autor.
- Decidir si la ficha de equipo nuevo es un iPhone 18 Pro o el 17 Pro Max al
  que pertenecen las especificaciones actuales.

---

Diseñado y desarrollado por [daniandre18](https://daniandre18.github.io/portfolio/)
