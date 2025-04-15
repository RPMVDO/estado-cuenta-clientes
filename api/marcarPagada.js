export default async function handler(req, res) {
  const scriptUrl = "https://script.google.com/macros/s/AKfycbybaSy-ZVcNJjbmQtUhAQlj9OOCysx4AV2rvsAPzuAxHFHZFkwd5z0gxh7JOiBNDgo3KQ/exec";

  if (req.method === "POST") {
    try {
      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });

      const text = await response.text();
      res.status(200).send(text);
    } catch (error) {
      res.status(500).send("Error en el proxy: " + error.message);
    }
  } else {
    res.status(405).send("Método no permitido");
  }
}
