import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

const Input = (props) => <input {...props} className="border p-2 rounded w-full" />;
const Button = (props) => <button {...props} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" />;
const Card = (props) => <div className="bg-white shadow rounded-lg border border-gray-200">{props.children}</div>;
const CardContent = (props) => <div className="p-4">{props.children}</div>;

const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbzxYNLUYa8Q1dstm-WP7r5hUIOAeOW_KAGI8x4WbzSRJ5AVoCODTJs7Fp14xFekowigdA/exec"; // nueva URL actualizada

export default function EstadoCuentaApp() {
  const [facturas, setFacturas] = useState([]);
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [nuevaFactura, setNuevaFactura] = useState({
    fecha: "",
    nroFactura: "",
    importe: "",
    cliente: "",
    condicion: "",
    recibo: "",
    vencimiento: "",
    estado: ""
  });

  useEffect(() => {
    fetch(GOOGLE_SHEET_API_URL)
      .then((res) => res.json())
      .then((data) => {
        const adaptadas = data.map((row) => ({
          fecha: row["FECHA"] || "",
          nroFactura: row["FACTURA"] || "",
          importe: parseFloat((row["IMPORTE"] || "0").toString().replace(/[^0-9.-]+/g, "")),
          cliente: row["CLIENTE"] || "",
          condicion: row["CONDICION"] || "",
          recibo: row["RECIBO"] || "",
          vencimiento: row["VENCIMIENTO"] || "",
          estado: row["DEBE"] || ""
        }));
        setFacturas(adaptadas);
      })
      .catch((err) => console.error("Error cargando facturas:", err));
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const columnasValidas = data.map((row) => ({
        fecha: row["FECHA"] || "",
        nroFactura: row["FACTURA"] || "",
        importe: parseFloat(row["IMPORTE"] || 0),
        cliente: row["CLIENTE"] || "",
        condicion: row["CONDICION"] || "",
        recibo: row["RECIBO"] || "",
        vencimiento: row["VENCIMIENTO"] || "",
        estado: row["DEBE"] || ""
      }));
      columnasValidas.forEach((factura) => {
        fetch(GOOGLE_SHEET_API_URL, {
          method: "POST",
          body: JSON.stringify(factura),
          headers: { "Content-Type": "application/json" }
        });
      });
      setFacturas((prev) => [...prev, ...columnasValidas]);
    };
    reader.readAsBinaryString(file);
  };

  const facturasFiltradas = facturas.filter((f) =>
    f.cliente?.toLowerCase().includes(clienteFiltro.toLowerCase())
  );

  const resumenPorEstado = facturasFiltradas.reduce((acc, f) => {
    const estado = f.estado || "SIN ESTADO";
    if (!acc[estado]) acc[estado] = 0;
    acc[estado] += parseFloat(f.importe) || 0;
    return acc;
  }, {});

  const totalImpago = Object.entries(resumenPorEstado)
    .filter(([estado]) => estado !== "PAGADO")
    .reduce((sum, [, val]) => sum + val, 0);

  const getEstadoColor = (estado) => {
    if (estado === "PAGADO") return "text-green-600";
    if (estado === "DIFICIL") return "text-yellow-600";
    if (["DEBE", "IMPAGO"].includes(estado)) return "text-red-600";
    return "text-gray-600";
  };

  const handleAgregarFactura = () => {
    const nueva = {
      ...nuevaFactura,
      importe: parseFloat(nuevaFactura.importe || 0)
    };
    fetch(GOOGLE_SHEET_API_URL, {
      method: "POST",
      body: JSON.stringify(nueva),
      headers: { "Content-Type": "application/json" }
    })
      .then(() => setFacturas((prev) => [...prev, nueva]))
      .catch((err) => console.error("Error al guardar:", err));

    setNuevaFactura({
      fecha: "",
      nroFactura: "",
      importe: "",
      cliente: "",
      condicion: "",
      recibo: "",
      vencimiento: "",
      estado: ""
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Estado de Cuenta de Clientes</h1>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
        <Input
          placeholder="Buscar cliente..."
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
        />
      </div>

      <div className="mb-6 space-y-2">
        <h2 className="text-xl font-semibold">Agregar Factura Manualmente</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.keys(nuevaFactura).map((campo) => (
            <Input
              key={campo}
              placeholder={campo}
              value={nuevaFactura[campo]}
              onChange={(e) =>
                setNuevaFactura({ ...nuevaFactura, [campo]: e.target.value })
              }
            />
          ))}
        </div>
        <Button onClick={handleAgregarFactura}>Agregar Factura</Button>
      </div>

      {clienteFiltro && (
        <div className="mb-6">
          <p className="text-lg font-semibold">
            Cliente: <span className="font-normal">{clienteFiltro}</span>
          </p>
          <p className="text-lg font-semibold text-red-600">
            Total Impago: ${totalImpago.toFixed(2)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-4">
            {Object.entries(resumenPorEstado).map(([estado, total]) => (
              <div
                key={estado}
                className={`text-sm font-medium ${getEstadoColor(estado)}`}
              >
                {estado}: ${total.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {facturasFiltradas.map((factura, idx) => (
          <Card key={idx} className="shadow border">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="font-medium">Fecha:</span> {factura.fecha}
                </div>
                <div>
                  <span className="font-medium">Factura:</span> {factura.nroFactura}
                </div>
                <div>
                  <span className="font-medium">Importe:</span> ${factura.importe}
                </div>
                <div>
                  <span className="font-medium">Estado:</span>{" "}
                  <span className={getEstadoColor(factura.estado)}>{factura.estado}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
