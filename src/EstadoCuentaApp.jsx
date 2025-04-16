import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

const API_PROXY_URL = "/api/marcarPagada";
const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbyYz7Cqx-QNaYataaXpoBeZ3sLv8N1IDnAts14hLcxDOI1-zLBzjmagDS0BarLvgmClfQ/exec";

const TABS = [
  { name: "Todas", icon: "📋" },
  { name: "> 30 días", icon: "⏰" },
  { name: "< 30 días", icon: "🗓️" },
  { name: "Pagadas", icon: "✅" },
  { name: "Adeudadas", icon: "⚠️" },
  { name: "Resumen", icon: "📈" }
];

function formatCurrency(num) {
  return num.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2
  });
}

export default function EstadoCuentaERP() {
  const [facturas, setFacturas] = useState([]);
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [tabActiva, setTabActiva] = useState("Todas");
  const [resumenAnual, setResumenAnual] = useState({});
  const [resumenClientes, setResumenClientes] = useState({});
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "";
    const fecha = new Date(fechaStr);
    if (isNaN(fecha)) return fechaStr;
    const dd = String(fecha.getDate()).padStart(2, "0");
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    const yy = String(fecha.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  useEffect(() => {
    fetch(GOOGLE_SHEET_API_URL)
      .then((res) => res.json())
      .then((data) => {
        const hoy = new Date();
        const adaptadas = data.map((row, index) => {
          try {
            const cliente = typeof row["CLIENTE"] === "string" ? row["CLIENTE"] : "";
            const fechaRaw = row["FECHA"] || "";
            const vencimientoRaw = row["VENCIMIENTO"] || "";
            let dias = 0;
            const fechaObj = new Date(fechaRaw);
            if (!isNaN(fechaObj)) {
              dias = (hoy - fechaObj) / (1000 * 60 * 60 * 24);
            }

            const debe = (row["DEBE"] || "").toString().toUpperCase();
            let estado = "PAGADO";
            if (debe === "SI") estado = "IMPAGO";
            else if (debe === "NO") estado = "PENDIENTE";

            return {
              id: index,
              fecha: formatearFecha(fechaRaw),
              fechaRaw,
              nroFactura: row["FACTURA"] || "",
              importe: parseFloat((row["IMPORTE"] || "0").toString().replace(/[^0-9.-]+/g, "")),
              cliente,
              condicion: row["CONDICION"] || "",
              recibo: row["RECIBO"] || "",
              vencimiento: formatearFecha(vencimientoRaw),
              estado,
              dias,
              debe,
              detalle: row["DETALLE"] || "",
              patente: row["PATENTE"] || ""
            };
          } catch (error) {
            return null;
          }
        }).filter(Boolean);

        setFacturas(adaptadas);

        const resumenMensual = {};
        const resumenCliente = {};
        const currentYear = new Date().getFullYear();

        adaptadas.forEach(f => {
          const fecha = new Date(f.fechaRaw);
          if (isNaN(fecha)) return;
          const anio = fecha.getFullYear();
          const mes = fecha.getMonth() + 1;
          const key = `${anio}-${String(mes).padStart(2, '0')}`;

          if (anio === currentYear) {
            resumenMensual[key] = (resumenMensual[key] || 0) + f.importe;
          }

          resumenCliente[f.cliente] = (resumenCliente[f.cliente] || 0) + f.importe;
        });

        setResumenAnual(resumenMensual);
        setResumenClientes(resumenCliente);
      })
      .catch((err) => console.error("❌ Error en fetch de facturas:", err));
  }, []);

  const facturasFiltradas = facturas
    .filter((f) => f.cliente.toLowerCase().includes(clienteFiltro.toLowerCase()))
    .filter((f) => {
      if (filtroFechaDesde) {
        const desde = new Date(filtroFechaDesde);
        if (!isNaN(desde) && new Date(f.fechaRaw) < desde) return false;
      }
      if (filtroFechaHasta) {
        const hasta = new Date(filtroFechaHasta);
        if (!isNaN(hasta) && new Date(f.fechaRaw) > hasta) return false;
      }
      if (tabActiva === "> 30 días") return f.estado !== "PAGADO" && f.dias > 30;
      if (tabActiva === "< 30 días") return f.estado !== "PAGADO" && f.dias <= 30;
      if (tabActiva === "Pagadas") return f.estado === "PAGADO";
      if (tabActiva === "Adeudadas") return f.estado === "IMPAGO" || f.estado === "PENDIENTE";
      return true;
    });

  const totalGeneral = facturasFiltradas.reduce((acc, f) => acc + (f.importe || 0), 0);
  const totalPagado = facturasFiltradas.filter((f) => f.estado === "PAGADO").reduce((acc, f) => acc + (f.importe || 0), 0);
  const totalAdeudado = facturasFiltradas.filter((f) => f.estado === "IMPAGO" || f.estado === "PENDIENTE").reduce((acc, f) => acc + (f.importe || 0), 0);

  function marcarComoPagada(factura) {
    fetch(API_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nroFactura: factura.nroFactura })
    })
      .then((res) => res.text())
      .then(() => {
        setFacturas((prev) =>
          prev.map((f) =>
            f.nroFactura === factura.nroFactura ? { ...f, estado: "PAGADO" } : f
          )
        );
      })
      .catch((err) => console.error("❌ Error al marcar como pagada:", err));
  }

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-900 text-white p-4 space-y-4">
        <h2 className="text-xl font-bold mb-4">Menú</h2>
        {TABS.map((tab) => (
          <button
            key={tab.name}
            className={`w-full text-left px-4 py-2 rounded hover:bg-gray-700 ${tabActiva === tab.name ? "bg-gray-700" : ""}`}
            onClick={() => setTabActiva(tab.name)}
          >
            {tab.icon} {tab.name}
          </button>
        ))}
        <input
          className="w-full p-2 mt-4 rounded text-black"
          placeholder="Buscar cliente..."
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
        />
        <input
          type="date"
          className="w-full mt-2 p-2 rounded text-black"
          value={filtroFechaDesde}
          onChange={(e) => setFiltroFechaDesde(e.target.value)}
        />
        <input
          type="date"
          className="w-full mt-2 p-2 rounded text-black"
          value={filtroFechaHasta}
          onChange={(e) => setFiltroFechaHasta(e.target.value)}
        />
      </aside>

      <main className="flex-1 p-6 overflow-y-auto bg-gray-100">
        <div className="mb-4 text-lg font-semibold">Total: {formatCurrency(totalGeneral)}</div>
        <div className="mb-4 text-green-600">Pagado: {formatCurrency(totalPagado)}</div>
        <div className="mb-4 text-red-600">Adeudado: {formatCurrency(totalAdeudado)}</div>

        {facturasFiltradas.map((f) => (
          <div key={f.id} className="bg-white shadow p-4 rounded mb-4 border border-gray-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><strong>Fecha:</strong> {f.fecha}</div>
              <div><strong>Factura:</strong> {f.nroFactura}</div>
              <div><strong>Importe:</strong> {formatCurrency(f.importe)}</div>
              <div><strong>Estado:</strong> {f.estado}</div>
              <div><strong>Cliente:</strong> {f.cliente}</div>
              <div><strong>Vencimiento:</strong> {f.vencimiento}</div>
              {f.detalle && <div><strong>Detalle:</strong> {f.detalle}</div>}
              {f.patente && <div><strong>Patente:</strong> {f.patente}</div>}
            </div>
            {f.estado !== "PAGADO" && (
              <button
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={() => marcarComoPagada(f)}
              >
                Marcar como pagada
              </button>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
