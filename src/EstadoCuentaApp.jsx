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
          } catch (error) {
            return null;
          }
        }).filter(Boolean);

        setFacturas(adaptadas);
      })
      .catch((err) => console.error("❌ Error en fetch de facturas:", err));
  }, []);

  const facturasFiltradas = facturas
    .filter((f) => f.cliente.toLowerCase().includes(clienteFiltro.toLowerCase()))
    .filter((f) => {
      if (tabActiva === "> 30 días") return f.estado !== "PAGADO" && f.dias > 30;
      if (tabActiva === "< 30 días") return f.estado !== "PAGADO" && f.dias <= 30;
      if (tabActiva === "Pagadas") return f.estado === "PAGADO";
      if (tabActiva === "Adeudadas") return f.estado === "IMPAGO" || f.estado === "PENDIENTE";
      return true;
    });

  const totalGeneral = facturasFiltradas.reduce((acc, f) => acc + (f.importe || 0), 0);
  const totalPagado = facturasFiltradas
    .filter((f) => f.estado === "PAGADO")
    .reduce((acc, f) => acc + (f.importe || 0), 0);
  const totalAdeudado = facturasFiltradas
    .filter((f) => f.estado === "IMPAGO" || f.estado === "PENDIENTE")
    .reduce((acc, f) => acc + (f.importe || 0), 0);

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
      </aside>

      <main className="flex-1 p-6 overflow-y-auto bg-gray-100">
        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-2">Facturas - {tabActiva}</h1>
          <p className="text-gray-700 font-medium">Total: ${totalGeneral.toFixed(2)}</p>
          <p className="text-green-700 font-medium">Pagadas: ${totalPagado.toFixed(2)}</p>
          <p className="text-red-700 font-medium">Adeudadas: ${totalAdeudado.toFixed(2)}</p>
        </div>

        <table className="min-w-full bg-white rounded shadow">
          <thead className="bg-gray-200 text-gray-700">
            <tr>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2 text-left">Factura</th>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Importe</th>
              <th className="p-2 text-left">Vencimiento</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {facturasFiltradas.map((factura) => (
              <tr key={factura.id} className="border-t">
                <td className="p-2">{factura.cliente}</td>
                <td className="p-2">{factura.nroFactura}</td>
                <td className="p-2">{factura.fecha}</td>
                <td className="p-2">${factura.importe.toFixed(2)}</td>
                <td className="p-2">{factura.vencimiento}</td>
                <td className="p-2">{factura.estado}</td>
                <td className="p-2">
                  {factura.estado !== "PAGADO" && (
                    <button
                      onClick={() => marcarComoPagada(factura)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                    >
                      Marcar como pagada
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );

  function marcarComoPagada(factura) {
    fetch(API_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nroFactura: factura.nroFactura })
    })
      .then((res) => res.text())
      .then((msg) => {
        setFacturas((prev) =>
          prev.map((f) =>
            f.nroFactura === factura.nroFactura ? { ...f, estado: "PAGADO" } : f
          )
        );
      })
      .catch((err) => console.error("❌ Error al marcar como pagada:", err));
  }
}
