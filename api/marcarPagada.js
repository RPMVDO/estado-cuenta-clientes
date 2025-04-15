export default async function handler(req, res) {
  const scriptUrl = "https://script.google.com/macros/s/AKfycbybaSy-ZVcNJjbmQtUhAQlj9OOCysx4AV2rvsAPzuAxHFHZFkwd5z0gxh7JOiBNDgo3KQ/exec";

  if (req.method !== "POST") {
    return res.status(405).send("Solo se permiten POST requests");
  }

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      body: JSON.stringify(req.body),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const text = await response.text();
    return res.status(200).send(text);
  } catch (error) {
    console.error("❌ Error en proxy:", error);
    return res.status(500).send("Error en proxy: " + error.message);
  }
}
