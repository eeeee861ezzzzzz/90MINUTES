

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        erreur: "Veuillez écrire une question."
      });
    }

    const response = await client.responses.create({
      model: "gpt-5",
      instructions: `
Tu es PITCH'AURA, un analyste de football.
Tu analyses les matchs, les tactiques,
les joueurs et les équipes.

Présente des analyses structurées et claires.
Explique les systèmes de jeu, les points forts,
les points faibles et les choix tactiques.

N'invente jamais de statistiques ni de
faits sur des matchs que tu ne connais pas.
Signale lorsque les données sont insuffisantes.
Réponds en français.
      `,
      input: question
    });

    res.json({
      analysis: response.output_text
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      erreur: "Erreur pendant l'analyse."
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(process.env.PORT || 3000, () => {
  console.log("PITCH'AURA est démarré !");
});
