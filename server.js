
const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.post("/api/analyze", (req, res) => {
  const question = req.body.question;

  if (!question || typeof question !== "string" ||
      !question.trim()) {
    return res.status(400).json({
      erreur: "Écris une demande d'analyse."
    });
  }

  const sujet = question.trim().slice(0, 300);

  const analyse = `
PITCH'AURA — ANALYSE TACTIQUE

Sujet : ${sujet}

1. SYSTÈMES DE JEU
Observer les formations des deux équipes,
leur organisation avec et sans ballon.

2. PHASE OFFENSIVE
Étudier la construction, les déplacements,
la largeur et l'utilisation des espaces.

3. PHASE DÉFENSIVE
Observer le pressing, le bloc défensif
et la protection des espaces.

4. TRANSITIONS
Examiner les réactions à la récupération
et à la perte du ballon.

5. POINTS CLÉS
Identifier les duels, les zones importantes
et les éventuels déséquilibres.

6. SCÉNARIOS
Étudier comment les changements tactiques
pourraient influencer le match.

Cette première version fournit une grille
d'analyse générale. Elle ne dispose pas
encore de données réelles sur les matchs.
`;

  res.json({ analysis: analyse });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(process.env.PORT || 3000, () => {
  console.log("PITCH'AURA est en ligne !");
});
