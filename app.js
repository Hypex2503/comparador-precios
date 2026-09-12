let productos = [];

async function cargarProductos() {
  const respuesta = await fetch(`${URL_SERVIDOR}/api/productos`);
  productos = await respuesta.json();
}

function obtenerPrecioMasBajo(tiendasProducto) {
  return Math.min(...tiendasProducto.map(t => t.precio));
}

function buscarUbicacionTienda(nombreTiendaProducto) {
  if (typeof tiendas === "undefined") return null;
  return tiendas.find((t) => t.clave === nombreTiendaProducto) || null;
}

function crearTarjetaProducto(producto) {
  const precioMasBajo = obtenerPrecioMasBajo(producto.tiendas);

  const tiendasConTotal = producto.tiendas.map((tiendaProducto) => {
    const ubicacionTienda = buscarUbicacionTienda(tiendaProducto.nombre);
    const tieneCostoGasolina =
      ubicacionTienda && typeof ubicacionTienda.costoGasolina === "number";

    const costoTotal = tieneCostoGasolina
      ? tiendaProducto.precio + ubicacionTienda.costoGasolina
      : null;

    return { ...tiendaProducto, costoTotal };
  });

  const todasTienenTotal = tiendasConTotal.every((t) => t.costoTotal !== null);
  const totalMasBajo = todasTienenTotal
    ? Math.min(...tiendasConTotal.map((t) => t.costoTotal))
    : null;

  const itemsTiendas = tiendasConTotal
    .map((tienda) => {
      const esMasBaratoEnPrecio = tienda.precio === precioMasBajo;
      const claseExtraPrecio = esMasBaratoEnPrecio ? "precio-mas-bajo" : "";

      let lineaTotal = "";
      if (tienda.costoTotal !== null) {
        const esMasBaratoEnTotal = tienda.costoTotal === totalMasBajo;
        const claseExtraTotal = esMasBaratoEnTotal ? "total-mas-bajo" : "";
        lineaTotal = `<br><small class="${claseExtraTotal}">Total c/gasolina: $${tienda.costoTotal.toFixed(2)}</small>`;
      }

      return `
        <li>
          <span>${tienda.nombre}</span>
          <span class="columna-precio">
            <span class="${claseExtraPrecio}">$${tienda.precio}</span>
            ${lineaTotal}
          </span>
        </li>
      `;
    })
    .join("");

  return `
    <div class="tarjeta-producto">
      <button class="boton-borrar-producto" data-id="${producto.id}" title="Solicitar borrado">🗑</button>
      <h2>${producto.nombre}</h2>
      <ul class="lista-tiendas">
        ${itemsTiendas}
      </ul>
    </div>
  `;
}

function renderizarProductos(listaProductos) {
  const contenedor = document.getElementById("contenedor-productos");

  if (listaProductos.length === 0) {
    contenedor.innerHTML = "<p>No se encontraron productos.</p>";
    return;
  }

  contenedor.innerHTML = listaProductos
    .map(producto => crearTarjetaProducto(producto))
    .join("");
}

function filtrarProductos(textoBusqueda) {
  const texto = textoBusqueda.toLowerCase();
  return productos.filter(producto =>
    producto.nombre.toLowerCase().includes(texto)
  );
}

const inputBuscador = document.getElementById("buscador");

inputBuscador.addEventListener("input", (evento) => {
  const texto = evento.target.value;

  if (texto.trim() === "") {
    // Si el buscador está vacío, mostramos solo los primeros 3
    renderizarProductos(productos.slice(0, 3));
  } else {
    // Si hay texto, buscamos entre TODOS los productos
    const productosFiltrados = filtrarProductos(texto);
    renderizarProductos(productosFiltrados);
  }
});

// Escucha clics en "borrar producto": SOLO ENVÍA UNA SOLICITUD, no borra directo
document.getElementById("contenedor-productos").addEventListener("click", async (evento) => {
  if (!evento.target.classList.contains("boton-borrar-producto")) return;

  const idProducto = evento.target.dataset.id;
  const confirmar = confirm("¿Enviar solicitud para borrar este producto? Un administrador debe aprobarla.");
  if (!confirmar) return;

  try {
  const respuesta = await fetch(`${URL_SERVIDOR}/api/productos/${idProducto}/solicitar-borrado`, {
      method: "POST"
    });

    const resultado = await respuesta.json();
    alert(resultado.mensaje || "Solicitud enviada.");
  } catch (error) {
    alert("No se pudo conectar con el servidor.");
  }
});

async function iniciarApp() {
  const contenedor = document.getElementById("contenedor-productos");
  contenedor.innerHTML = "<p>Cargando productos...</p>";

  await cargarProductos();
  renderizarProductos(productos.slice(0, 3)); // Solo mostramos los primeros 3 al inicio
}

iniciarApp();