export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  try {
    const response = await fetch("https://script.google.com/macros/s/AKfycbyYz7Cqx-QNaYataaXpoBeZ3sLv8N1IDnAts14hLcxDOI1-zLBzjmagDS0BarLvgmClfQ/exec");

    if (!response.ok) {
      throw new Error("Error al obtener datos de Google Sheets");
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: "Error interno", error: err.message });
  }
}
