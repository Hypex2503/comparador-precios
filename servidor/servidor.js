const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const db = require("./basedatos");

const app = express();
const PUERTO = 3000;
const CONTRASENA_ADMIN = "Hypex2503"; // Tu contraseña

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const almacenamiento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const nombreUnico = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, nombreUnico);
  }
});
const subirImagen = multer({ storage: almacenamiento });

function verificarAdmin(req, res, next) {
  const contrasena = req.headers["x-admin-password"];
  if (contrasena !== CONTRASENA_ADMIN) {
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }
  next();
}

app.get("/", (req, res) => {
  res.send("¡El servidor está funcionando! 🎉");
});

// TIENDAS

app.get("/api/tiendas", (req, res) => {
  const tiendas = db.prepare("SELECT * FROM tiendas WHERE estado = 'aprobado'").all();
  res.json(tiendas);
});

app.post("/api/tiendas", (req, res) => {
  const { clave, nombre, direccion, lat, lng } = req.body;

  if (!clave || !nombre || !direccion || !lat || !lng) {
    return res.status(400).json({ error: "Faltan datos. Revisa que llenaste todos los campos." });
  }

  try {
    const insertar = db.prepare(
      "INSERT INTO tiendas (clave, nombre, direccion, lat, lng, estado) VALUES (?, ?, ?, ?, ?, 'pendiente')"
    );
    insertar.run(clave, nombre, direccion, parseFloat(lat), parseFloat(lng));
    res.status(201).json({ mensaje: "Tienda enviada. Quedará pendiente de aprobación." });
  } catch (error) {
    res.status(400).json({ error: "Esa clave de tienda ya existe. Usa una diferente." });
  }
});

app.post("/api/tiendas/:clave/solicitar-borrado", (req, res) => {
  db.prepare("INSERT INTO solicitudes_borrado (tipo, referencia) VALUES ('tienda', ?)").run(req.params.clave);
  res.json({ mensaje: "Solicitud enviada. Un administrador debe aprobarla." });
});

// PRODUCTOS

app.get("/api/productos", (req, res) => {
  const productos = db.prepare("SELECT * FROM productos WHERE estado = 'aprobado'").all();

  const consultaPrecios = db.prepare(
    "SELECT tienda_clave AS nombre, precio FROM precios WHERE producto_id = ?"
  );

  const productosConTiendas = productos.map((producto) => ({
    id: producto.id,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    marca: producto.marca,
    imagen: producto.imagen ? `http://localhost:3000/uploads/${producto.imagen}` : null,
    tiendas: consultaPrecios.all(producto.id)
  }));

  res.json(productosConTiendas);
});

app.post("/api/productos", subirImagen.single("imagen"), (req, res) => {
  const { nombre, descripcion, marca, precios } = req.body;
  const archivoImagen = req.file ? req.file.filename : null;

  let listaPrecios;
  try {
    listaPrecios = JSON.parse(precios);
  } catch {
    return res.status(400).json({ error: "Los precios no llegaron en el formato correcto." });
  }

  if (!nombre || !Array.isArray(listaPrecios) || listaPrecios.length === 0) {
    return res.status(400).json({ error: "Faltan datos: el producto necesita un nombre y al menos un precio." });
  }

  try {
    const insertarProducto = db.prepare(
      "INSERT INTO productos (nombre, descripcion, marca, imagen, estado) VALUES (?, ?, ?, ?, 'pendiente')"
    );
    const idNuevoProducto = insertarProducto.run(nombre, descripcion || null, marca || null, archivoImagen).lastInsertRowid;

    const insertarPrecio = db.prepare(
      "INSERT INTO precios (producto_id, tienda_clave, precio) VALUES (?, ?, ?)"
    );

    listaPrecios.forEach((item) => {
      insertarPrecio.run(idNuevoProducto, item.tienda_clave, parseFloat(item.precio));
    });

    res.status(201).json({ mensaje: "Producto enviado. Quedará pendiente de aprobación antes de aparecer en la lista." });
  } catch (error) {
    console.error("ERROR REAL:", error.message)
    res.status(400).json({ error: "No se pudo agregar el producto. Revisa que las claves de tienda existan." });
  }
});

app.post("/api/productos/:id/solicitar-borrado", (req, res) => {
  db.prepare("INSERT INTO solicitudes_borrado (tipo, referencia) VALUES ('producto', ?)").run(req.params.id);
  res.json({ mensaje: "Solicitud enviada. Un administrador debe aprobarla." });
});

// ADMIN

app.get("/api/admin/pendientes", verificarAdmin, (req, res) => {
  const tiendasPendientes = db.prepare("SELECT * FROM tiendas WHERE estado = 'pendiente'").all();

  const productosPendientes = db.prepare("SELECT * FROM productos WHERE estado = 'pendiente'").all();
  const consultaPrecios = db.prepare(
    "SELECT tienda_clave AS nombre, precio FROM precios WHERE producto_id = ?"
  );
  const productosConTiendas = productosPendientes.map((producto) => ({
    id: producto.id,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    marca: producto.marca,
    imagen: producto.imagen ? `http://localhost:3000/uploads/${producto.imagen}` : null,
    tiendas: consultaPrecios.all(producto.id)
  }));

  res.json({ tiendas: tiendasPendientes, productos: productosConTiendas });
});

app.patch("/api/admin/tiendas/:clave/aprobar", verificarAdmin, (req, res) => {
  db.prepare("UPDATE tiendas SET estado = 'aprobado' WHERE clave = ?").run(req.params.clave);
  res.json({ mensaje: "Tienda aprobada." });
});

app.patch("/api/admin/productos/:id/aprobar", verificarAdmin, (req, res) => {
  db.prepare("UPDATE productos SET estado = 'aprobado' WHERE id = ?").run(req.params.id);
  res.json({ mensaje: "Producto aprobado." });
});

app.get("/api/admin/solicitudes-borrado", verificarAdmin, (req, res) => {
  const solicitudes = db.prepare("SELECT * FROM solicitudes_borrado").all();

  const solicitudesConNombre = solicitudes.map((solicitud) => {
    if (solicitud.tipo === "tienda") {
      const tienda = db.prepare("SELECT nombre FROM tiendas WHERE clave = ?").get(solicitud.referencia);
      return { ...solicitud, nombre: tienda ? tienda.nombre : "(tienda ya no existe)" };
    } else {
      const producto = db.prepare("SELECT nombre FROM productos WHERE id = ?").get(solicitud.referencia);
      return { ...solicitud, nombre: producto ? producto.nombre : "(producto ya no existe)" };
    }
  });

  res.json(solicitudesConNombre);
});

app.patch("/api/admin/solicitudes-borrado/:id/aprobar", verificarAdmin, (req, res) => {
  const solicitud = db.prepare("SELECT * FROM solicitudes_borrado WHERE id = ?").get(req.params.id);

  if (!solicitud) {
    return res.status(404).json({ error: "Esa solicitud ya no existe." });
  }

  if (solicitud.tipo === "tienda") {
    db.prepare("DELETE FROM precios WHERE tienda_clave = ?").run(solicitud.referencia);
    db.prepare("DELETE FROM tiendas WHERE clave = ?").run(solicitud.referencia);
  } else {
    db.prepare("DELETE FROM precios WHERE producto_id = ?").run(solicitud.referencia);
    db.prepare("DELETE FROM productos WHERE id = ?").run(solicitud.referencia);
  }

  db.prepare("DELETE FROM solicitudes_borrado WHERE id = ?").run(req.params.id);

  res.json({ mensaje: "Borrado aprobado y aplicado." });
});

app.delete("/api/admin/solicitudes-borrado/:id", verificarAdmin, (req, res) => {
  db.prepare("DELETE FROM solicitudes_borrado WHERE id = ?").run(req.params.id);
  res.json({ mensaje: "Solicitud rechazada." });
});

app.listen(PUERTO, () => {
  console.log(`Servidor corriendo en http://localhost:${PUERTO}`);
});