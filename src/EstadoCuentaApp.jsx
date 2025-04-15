import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

const API_PROXY_URL = "/api/marcarPagada";
const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbyYz7Cqx-QNaYataaXpoBeZ3sLv8N1IDnAts14hLcxDOI1-zLBzjmagDS0BarLvgmClfQ/exec";

const TABS = [
  { name: "Todas", icon: "📋" },
  { name: "> 30 días", icon: "⏰" },
  { name: "< 30 días", icon: "🗓️" },
  { name: "Pagadas", icon: "✅" },
  { name: "Adeudadas", icon: "⚠️" }
];

export default function EstadoCuentaERP() {
  const [facturas, setFacturas] = useState([]);
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [tabActiva, setTabActiva] = useState("Todas");

  const formatearFecha = (str) => {
    if (!str) return "";
    const partes = str.split("/");
    if (partes.length === 3) return str;
    const d = new Date(str);
    if (isNaN(d)) return str;
    const dd = d.getDate().toString().padStart(2, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const yy = d.getFullYear().toString().slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  useEffect(() => {
    fetch(GOOGLE_SHEET_API_URL)
      .then((res) => res.json())
      .then((data) => {
        const hoy = new Date();
        const adaptadas = data.map((row, index) => {
          const cliente = typeof row["CLIENTE"] === "string" ? row["CLIENTE"] : "";
          const fechaRaw = row["FECHA"] || "";
          const vencimientoRaw = row["VENCIMIENTO"] || "";
          let dias = 0;
          try {
            const fechaObj = new Date(fechaRaw);
            dias = (hoy - fechaObj) / (1000 * 60 * 60 * 24);
            if (isNaN(dias)) dias = 0;
          } catch {
            dias = 0;
          }
          const debe = row["DEBE"]?.toUpperCase();

          let estado = "PAGADO";
          if (debe === "SI") estado = "IMPAGO";
          else if (debe === "NO") estado = "PENDIENTE";

          return {
            id: index,
            fecha: formatearFecha(fechaRaw),
            nroFactura: row["FACTURA"] || "",
            importe: parseFloat((row["IMPORTE"] || "0").toString().replace(/[^0-9.-]+/g, "")),
            cliente,
            condicion: row["CONDICION"] || "",
            recibo: row["RECIBO"] || "",
            vencimiento: formatearFecha(vencimientoRaw),
            estado,
            dias,
            debe
          };
        });
        setFacturas(adaptadas);
      });
  }, []);

  const marcarComoPagada = (factura) => {
    console.log("🟢 Click en botón Marcar como pagada:", factura);
    const nuevaFactura = { ...factura, estado: "PAGADO", debe: "" };
    fetch(API_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevaFactura)
    })
      .then((res) => res.text())
      .then((res) => {
        console.log("🔄 Respuesta del servidor:", res);
        setFacturas((prev) =>
          prev.map((f) => (f.id === factura.id ? { ...f, estado: "PAGADO", debe: "" } : f))
        );
      })
      .catch((err) => console.error("❌ Error al marcar como pagada:", err));
  };

  const filtrarFacturas = () => {
    return facturas.filter((f) => {
      const cliente = typeof f.cliente === "string" ? f.cliente : "";
      const cumpleCliente = cliente.toLowerCase().includes(clienteFiltro.toLowerCase());

      switch (tabActiva) {
        case "> 30 días":
          return cumpleCliente && f.dias > 30;
        case "< 30 días":
          return cumpleCliente && f.dias <= 30;
        case "Pagadas":
          return cumpleCliente && f.estado === "PAGADO";
        case "Adeudadas":
          return cumpleCliente && (f.estado === "IMPAGO" || f.estado === "PENDIENTE");
        default:
          return cumpleCliente;
      }
    });
  };

  const getEstadoColor = (estado) => {
    if (estado === "PAGADO") return "text-green-500";
    if (estado === "PENDIENTE") return "text-yellow-500";
    if (estado === "IMPAGO") return "text-red-500";
    return "text-gray-500";
  };

  const facturasFiltradas = filtrarFacturas();
  const totalPorEstado = facturasFiltradas.reduce((acc, f) => {
    acc[f.estado] = (acc[f.estado] || 0) + f.importe;
    return acc;
  }, {});

  const agrupadasPorCliente = clienteFiltro
    ? {
        pagadas: facturas.filter(
          (f) => f.cliente.toLowerCase().includes(clienteFiltro.toLowerCase()) && f.estado === "PAGADO"
        ),
        adeudadas: facturas.filter(
          (f) => f.cliente.toLowerCase().includes(clienteFiltro.toLowerCase()) && (f.estado === "IMPAGO" || f.estado === "PENDIENTE")
        )
      }
    : null;

  return (
    <div className="flex bg-gray-100 min-h-screen font-sans w-full">
      <aside className="w-64 bg-white shadow p-4">
        <h2 className="text-lg font-bold mb-4">Menú</h2>
        <div className="space-y-2">
          {TABS.map((tab) => (
            <button
              key={tab.name}
              className={`w-full text-left px-3 py-2 rounded ${
                tabActiva === tab.name ? "bg-blue-600 text-white" : "hover:bg-gray-100"
              }`}
              onClick={() => setTabActiva(tab.name)}
            >
              {tab.icon} {tab.name}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        <h1 className="text-2xl font-bold mb-4">Estado de Cuenta</h1>

        <input
          type="text"
          placeholder="Buscar cliente..."
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
          className="mb-4 p-2 border rounded w-full max-w-sm"
        />

        <div className="mb-4 flex gap-4">
          {Object.entries(totalPorEstado).map(([estado, total]) => (
            <div key={estado} className={`text-sm font-medium ${getEstadoColor(estado)}`}>
              {estado}: ${total.toFixed(2)}
            </div>
          ))}
        </div>

        {agrupadasPorCliente ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">Adeudadas</h2>
              {agrupadasPorCliente.adeudadas.map((f, i) => (
                <div key={i} className="bg-white p-4 rounded shadow mb-2">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm font-semibold">{f.fecha} - {f.nroFactura}</p>
                      <p className="text-xs">${f.importe}</p>
                    </div>
                    <button
                      onClick={() => marcarComoPagada(f)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Marcar como pagada
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-2">Pagadas</h2>
              {agrupadasPorCliente.pagadas.map((f, i) => (
                <div key={i} className="bg-white p-4 rounded shadow mb-2">
                  <p className="text-sm font-semibold">{f.fecha} - {f.nroFactura}</p>
                  <p className="text-xs">${f.importe}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {facturasFiltradas.map((f, i) => (
              <div key={i} className="bg-white p-4 rounded shadow">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div><strong>Fecha:</strong> {f.fecha}</div>
                  <div><strong>Factura:</strong> {f.nroFactura}</div>
                  <div><strong>Cliente:</strong> {f.cliente}</div>
                  <div className={getEstadoColor(f.estado)}><strong>Estado:</strong> {f.estado}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
