const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/analyser", async (req, res) => {
  try {
    const { question } = req.body;

    const response = await client.responses.create({
      model: "gpt-5",
      instructions: "Tu es PITCH'AURA, un analyste spécialisé dans le football. Analyse les matchs, les tactiques, les joueurs et les équipes. N'invente jamais de statistiques.",
      input: question
    });

    res.json({ analyse: response.output_text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erreur: "Erreur pendant l'analyse." });
  }
});

app.listen(process.env.PORT || 3000);
