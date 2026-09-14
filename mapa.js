// Creamos el mapa centrado en Mérida, Yucatán (puedes ajustar estas coordenadas)
const mapa = L.map("mapa").setView([20.9674, -89.6237], 13);

// Agregamos las "tiles" (las imágenes del mapa) de OpenStreetMap
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; colaboradores de OpenStreetMap"
}).addTo(mapa);

// Guardamos los marcadores de tiendas para poder usarlos después
const marcadoresTiendas = [];

// Dibuja un marcador por cada tienda ya cargada
function dibujarMarcadoresTiendas() {
  tiendas.forEach((tienda) => {
    const marcador = L.marker([tienda.lat, tienda.lng]).addTo(mapa);

    marcador.bindPopup(`
      <strong>${tienda.nombre}</strong><br>
      ${tienda.direccion}
    `);

    marcadoresTiendas.push({ tienda, marcador });
  });
}

// Ícono azul para diferenciar al usuario de las tiendas
const iconoUsuario = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "icono-usuario"
});

let ubicacionUsuario = null;
let marcadorUsuario = null;

const inputRendimiento = document.getElementById("input-rendimiento");
const inputPrecioGasolina = document.getElementById("input-precio-gasolina");

function calcularDistanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calcularCostoGasolina(distanciaKm) {
  const rendimiento = parseFloat(inputRendimiento.value) || 12;
  const precioLitro = parseFloat(inputPrecioGasolina.value) || 24;
  const litrosUtilizados = distanciaKm / rendimiento;
  return litrosUtilizados * precioLitro;
}

function calcularDistanciasATiendas() {
  if (!ubicacionUsuario) return [];

  tiendas.forEach((tienda) => {
    tienda.distanciaKm = calcularDistanciaKm(
      ubicacionUsuario.lat,
      ubicacionUsuario.lng,
      tienda.lat,
      tienda.lng
    );
    tienda.costoGasolina = calcularCostoGasolina(tienda.distanciaKm);
  });

  return [...tiendas].sort((a, b) => a.distanciaKm - b.distanciaKm);
}

function mostrarListaDistancias(tiendasOrdenadas) {
  const contenedor = document.getElementById("lista-distancias");

  const itemsTiendas = tiendasOrdenadas
    .map(
      (tienda) => `
        <li>
          <span>🏪 ${tienda.nombre}</span>
          <span>
            <span class="distancia-km">${tienda.distanciaKm.toFixed(1)} km</span>
            &nbsp;—&nbsp;
            <span class="costo-gasolina">Gasolina: $${tienda.costoGasolina.toFixed(2)}</span>
          </span>
        </li>
      `
    )
    .join("");

  contenedor.innerHTML = `
    <ul>
      <li><span>📍 Tu ubicación</span></li>
      ${itemsTiendas}
    </ul>
  `;
}

function actualizarCalculos() {
  if (!ubicacionUsuario) return;

  const tiendasOrdenadas = calcularDistanciasATiendas();
  mostrarListaDistancias(tiendasOrdenadas);

  const textoBusquedaActual = inputBuscador.value;
  if (textoBusquedaActual.trim() === "") {
    renderizarProductos(productos.slice(0, 3));
  } else {
    renderizarProductos(filtrarProductos(textoBusquedaActual));
  }
}

function obtenerUbicacionUsuario() {
  if (!navigator.geolocation) {
    alert("Tu navegador no soporta geolocalización. El resto de la app seguirá funcionando normal.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (posicion) => {
      const { latitude, longitude } = posicion.coords;

      ubicacionUsuario = { lat: latitude, lng: longitude };

      if (marcadorUsuario) {
        mapa.removeLayer(marcadorUsuario);
      }

      marcadorUsuario = L.marker([latitude, longitude], { icon: iconoUsuario })
        .addTo(mapa)
        .bindPopup("📍 Tu ubicación")
        .openPopup();

      mapa.setView([latitude, longitude], 13);

      actualizarCalculos();
    },
    (error) => {
      let mensaje = "No se pudo obtener tu ubicación.";
      if (error.code === error.PERMISSION_DENIED) {
        mensaje = "No diste permiso de ubicación. Puedes seguir usando la app normalmente, solo no verás tu posición en el mapa.";
      }
      alert(mensaje);
    }
  );
}

const botonUbicacion = document.getElementById("boton-ubicacion");
botonUbicacion.addEventListener("click", obtenerUbicacionUsuario);

inputRendimiento.addEventListener("input", actualizarCalculos);
inputPrecioGasolina.addEventListener("input", actualizarCalculos);

// Dibuja la lista de tiendas registradas, cada una con su botón de solicitar borrado
function renderizarListaTiendasAdmin() {
  const contenedor = document.getElementById("lista-tiendas-admin-items");

  contenedor.innerHTML = tiendas
    .map(
      (tienda) => `
        <li>
          <span>${tienda.nombre}</span>
          <button class="boton-borrar-tienda" data-clave="${tienda.clave}" title="Solicitar borrado">🗑</button>
        </li>
      `
    )
    .join("");
}

// Escucha clics en "borrar tienda": SOLO ENVÍA UNA SOLICITUD, no borra directo
document.getElementById("lista-tiendas-admin-items").addEventListener("click", async (evento) => {
  if (!evento.target.classList.contains("boton-borrar-tienda")) return;

  const claveTienda = evento.target.dataset.clave;
  const confirmar = confirm("¿Enviar solicitud para borrar esta tienda? Un administrador debe aprobarla.");
  if (!confirmar) return;

  try {
    const respuesta = await fetch(`${URL_SERVIDOR}/api/tiendas/${claveTienda}/solicitar-borrado`, {
      method: "POST"
    });

    const resultado = await respuesta.json();
    alert(resultado.mensaje || "Solicitud enviada.");
  } catch (error) {
    alert("No se pudo conectar con el servidor.");
  }
});

async function iniciarListaTiendasAdmin() {
  await cargarTiendas();
  renderizarListaTiendasAdmin();
}

// Iniciamos: primero cargamos las tiendas del servidor, y hasta que lleguen, dibujamos los marcadores
async function iniciarMapa() {
  await cargarTiendas();
  dibujarMarcadoresTiendas();
  renderizarListaTiendasAdmin();
}

iniciarMapa();

// Menú de opciones (⋮): abrir/cerrar y mostrar el formulario elegido
const botonMenuOpciones = document.getElementById("boton-menu-opciones");
const menuOpciones = document.getElementById("menu-opciones");
const formAgregarTienda = document.getElementById("form-agregar-tienda");
const formAgregarProducto = document.getElementById("form-agregar-producto");

botonMenuOpciones.addEventListener("click", (evento) => {
  evento.stopPropagation();
  menuOpciones.classList.toggle("oculto");
});

document.addEventListener("click", () => {
  menuOpciones.classList.add("oculto");
});

document.getElementById("opcion-agregar-tienda").addEventListener("click", () => {
  formAgregarTienda.classList.remove("oculto");
  formAgregarProducto.classList.add("oculto");
  menuOpciones.classList.add("oculto");
  formAgregarTienda.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Genera un campo de precio por cada tienda registrada
function generarCamposPrecios() {
  const contenedor = document.getElementById("precios-por-tienda");

  if (tiendas.length === 0) {
    contenedor.innerHTML = "<p>Aún no hay tiendas registradas.</p>";
    return;
  }

  contenedor.innerHTML = tiendas
    .map(
      (tienda) => `
        <label>
          Precio en ${tienda.nombre}:
          <input type="number" class="precio-input" data-clave="${tienda.clave}" step="0.01" />
        </label>
      `
    )
    .join("");
}

document.getElementById("opcion-agregar-producto").addEventListener("click", () => {
  generarCamposPrecios();
  formAgregarProducto.classList.remove("oculto");
  formAgregarTienda.classList.add("oculto");
  menuOpciones.classList.add("oculto");
  formAgregarProducto.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Conecta el formulario de "Agregar tienda" con el servidor
const botonAgregarTienda = document.getElementById("boton-agregar-tienda");
const mensajeAgregarTienda = document.getElementById("mensaje-agregar-tienda");

botonAgregarTienda.addEventListener("click", async () => {
  const nuevaTienda = {
    clave: document.getElementById("nueva-tienda-clave").value.trim(),
    nombre: document.getElementById("nueva-tienda-nombre").value.trim(),
    direccion: document.getElementById("nueva-tienda-direccion").value.trim(),
    lat: document.getElementById("nueva-tienda-lat").value,
    lng: document.getElementById("nueva-tienda-lng").value
  };

  try {
    const respuesta = await fetch(`${URL_SERVIDOR}/api/tiendas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevaTienda)
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      mensajeAgregarTienda.textContent = resultado.error;
      mensajeAgregarTienda.className = "error";
      return;
    }

    mensajeAgregarTienda.textContent = resultado.mensaje;
    mensajeAgregarTienda.className = "exito";
  } catch (error) {
    mensajeAgregarTienda.textContent = "No se pudo conectar con el servidor.";
    mensajeAgregarTienda.className = "error";
  }
});

// Conecta el formulario de "Agregar producto" con el servidor
const botonAgregarProducto = document.getElementById("boton-agregar-producto");
const mensajeAgregarProducto = document.getElementById("mensaje-agregar-producto");

botonAgregarProducto.addEventListener("click", async () => {
  const datosFormulario = new FormData();
  datosFormulario.append("nombre", document.getElementById("nuevo-producto-nombre").value.trim());
  datosFormulario.append("descripcion", document.getElementById("nuevo-producto-descripcion").value.trim());
  datosFormulario.append("marca", document.getElementById("nuevo-producto-marca").value.trim());

  const camposPrecios = document.querySelectorAll(".precio-input");
  const precios = [];

  camposPrecios.forEach((campo) => {
    if (campo.value.trim() !== "") {
      precios.push({ tienda_clave: campo.dataset.clave, precio: campo.value });
    }
  });

  if (precios.length === 0) {
    mensajeAgregarProducto.textContent = "Pon el precio en al menos una tienda.";
    mensajeAgregarProducto.className = "error";
    return;
  }

  datosFormulario.append("precios", JSON.stringify(precios));

  const archivoImagen = document.getElementById("nuevo-producto-imagen").files[0];
  if (archivoImagen) {
    datosFormulario.append("imagen", archivoImagen);
  }

  try {
    const respuesta = await fetch(`${URL_SERVIDOR}/api/productos`, {
      method: "POST",
      body: datosFormulario
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      mensajeAgregarProducto.textContent = resultado.error;
      mensajeAgregarProducto.className = "error";
      return;
    }

    mensajeAgregarProducto.textContent = resultado.mensaje;
    mensajeAgregarProducto.className = "exito";
  } catch (error) {
    mensajeAgregarProducto.textContent = "No se pudo conectar con el servidor.";
    mensajeAgregarProducto.className = "error";
  }
});