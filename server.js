
const express = require("express");
const path = require("path");
const equipes = require("./equipes.json");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

function trouverEquipe(texte) {
  const recherche = texte.toLowerCase();

  const alias = {
    psg: ["psg", "paris saint-germain", "paris sg"],
    "real-madrid": ["real madrid", "réal madrid"],
    barcelone: ["barcelone", "barcelona", "barça", "barca"],
    "manchester-city": ["manchester city", "man city"]
  };

  return Object.keys(alias).filter(id =>
    alias[id].some(nom => recherche.includes(nom))
  );
}

function ficheEquipe(id) {
  const equipe = equipes[id];

  return `
${equipe.nom.toUpperCase()}

Système de référence : ${equipe.systeme}
Style : ${equipe.style}

POINTS FORTS
${equipe.pointsForts.map(p => "• " + p).join("\n")}

POINTS À SURVEILLER
${equipe.pointsFaibles.map(p => "• " + p).join("\n")}
`;
}

app.post("/api/analyze", (req, res) => {
  const question = req.body?.question;

  if (typeof question !== "string" ||
      !question.trim()) {
    return res.status(400).json({
      erreur: "Écris une demande d'analyse."
    });
  }

  const ids = trouverEquipe(question);

  if (ids.length === 0) {
    return res.json({
      analysis:
        "Cette équipe n'est pas encore dans la base PITCH'AURA. " +
        "Essaie PSG, Real Madrid, Barcelone ou Manchester City."
    });
  }

  let analyse = "PITCH'AURA — ANALYSE TACTIQUE\n";
  analyse += "\n" + ids.map(ficheEquipe).join("\n");

  if (ids.length >= 2) {
    const a = equipes[ids[0]];
    const b = equipes[ids[1]];

    analyse += `
COMPARAISON TACTIQUE

${a.nom} : ${a.style}
${b.nom} : ${b.style}

DUEL À OBSERVER

${a.nom} devra chercher à exploiter les
espaces laissés par ${b.nom}.

${b.nom} devra adapter son organisation
pour limiter les points forts adverses.

SCÉNARIOS POSSIBLES

• Une équipe pourrait dominer la possession.
• Les transitions pourraient être décisives.
• Le pressing pourrait influencer le rythme.
`;
  }

  analyse += `

Note : cette analyse repose sur des profils
tactiques simplifiés, pas sur des données
en direct ni sur un match précisément identifié.
`;

  res.json({ analysis: analyse });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(process.env.PORT || 3000, () => {
  console.log("PITCH'AURA V2 démarré !");
});
