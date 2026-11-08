
const express = require("express");
const path = require("path");
const equipes = require("./equipes.json");

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(express.static(__dirname));

const alias = {
  psg: ["psg", "paris saint germain", "paris sg"],
  "real-madrid": ["real madrid", "real"],
  barcelone: ["barcelone", "barcelona", "barca", "fc barcelone"],
  "manchester-city": ["manchester city", "man city", "city"],
  arsenal: ["arsenal"],
  liverpool: ["liverpool"],
  chelsea: ["chelsea"],
  "manchester-united": ["manchester united", "man united", "man utd"],
  tottenham: ["tottenham", "spurs"],
  bayern: ["bayern", "bayern munich"],
  dortmund: ["dortmund", "borussia dortmund", "bvb"],
  inter: ["inter", "inter milan", "internazionale"],
  "ac-milan": ["ac milan", "milan ac"],
  juventus: ["juventus", "juve"],
  naples: ["naples", "napoli"],
  marseille: ["marseille", "om", "olympique de marseille"],
  monaco: ["monaco", "as monaco"],
  lyon: ["lyon", "ol", "olympique lyonnais"],
  atletico: ["atletico", "atletico madrid", "atletico de madrid"],
  leverkusen: ["leverkusen", "bayer leverkusen"]
};

function normaliser(texte) {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trouverEquipes(question) {
  const texte = " " + normaliser(question) + " ";
  const resultats = [];

  for (const id of Object.keys(equipes)) {
    const noms = [
      equipes[id].nom,
      id,
      ...(alias[id] || [])
    ];

    let position = Infinity;

    for (const nom of noms) {
      const recherche = normaliser(nom);
      const regex = new RegExp(
        "(^|[^a-z0-9])" +
        recherche.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "(?=$|[^a-z0-9])",
        "g"
      );

      const match = regex.exec(texte);
      if (match && match.index < position) {
        position = match.index;
      }
    }

    if (position !== Infinity) {
      resultats.push({ id, position });
    }
  }

  return resultats
    .sort((a, b) => a.position - b.position)
    .map(resultat => resultat.id);
}

function liste(elements) {
  return elements.map(item => "• " + item).join("\n");
}

function ficheEquipe(id) {
  const e = equipes[id];

  return `
━━━━━━━━━━━━━━━━━━━━

⚽ ${e.nom.toUpperCase()}

🏆 Championnat : ${e.championnat}
📋 Système de référence : ${e.systeme}

STYLE DE JEU
${e.style}

✅ POINTS FORTS
${liste(e.pointsForts)}

⚠️ POINTS FAIBLES
${liste(e.pointsFaibles)}
`;
}

function comparerEquipes(idA, idB) {
  const a = equipes[idA];
  const b = equipes[idB];

  return `
━━━━━━━━━━━━━━━━━━━━

⚔️ COMPARAISON TACTIQUE

${a.nom}
Système : ${a.systeme}
Style : ${a.style}

${b.nom}
Système : ${b.systeme}
Style : ${b.style}

━━━━━━━━━━━━━━━━━━━━

🎯 DUELS TACTIQUES

ATTAQUE DE ${a.nom.toUpperCase()}

Points forts :
${liste(a.pointsForts)}

Faiblesses adverses à étudier :
${liste(b.pointsFaibles)}

ATTAQUE DE ${b.nom.toUpperCase()}

Points forts :
${liste(b.pointsForts)}

Faiblesses adverses à étudier :
${liste(a.pointsFaibles)}

━━━━━━━━━━━━━━━━━━━━

🧠 CLÉS DU MATCH

1. Observer la bataille du milieu de terrain.

2. Étudier le pressing et les sorties de balle.

3. Identifier les espaces en transition.

4. Observer les déplacements entre les lignes.

5. Analyser les ajustements tactiques.

━━━━━━━━━━━━━━━━━━━━

🔮 SCÉNARIOS POSSIBLES

• La possession pourrait permettre à une équipe
  d'imposer son rythme.

• Les transitions rapides pourraient créer
  des occasions dangereuses.

• Le pressing pourrait provoquer des pertes
  de balle dans des zones importantes.

• Les changements tactiques pourraient
  modifier l'équilibre de la rencontre.
`;
}

app.post("/api/analyze", (req, res) => {
  try {
    const question = req.body?.question;

    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        erreur: "Écris une demande d'analyse."
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        erreur: "Ta demande est trop longue."
      });
    }

    const ids = trouverEquipes(question);

    if (ids.length === 0) {
      return res.json({
        analysis: `
PITCH'AURA

Aucune équipe reconnue dans ta demande.

${Object.values(equipes).map(e => "• " + e.nom).join("\n")}

Essaie avec le nom d'un club de cette liste.
`
      });
    }

    let analyse = `
PITCH'AURA V6.1
ANALYSE TACTIQUE
`;

    ids.slice(0, 2).forEach(id => {
      analyse += ficheEquipe(id);
    });

    if (ids.length >= 2) {
      analyse += comparerEquipes(ids[0], ids[1]);
    }

    analyse += `

━━━━━━━━━━━━━━━━━━━━

ℹ️ INFORMATIONS

Cette analyse utilise des profils tactiques
simplifiés enregistrés dans PITCH'AURA.

Les systèmes et les styles peuvent évoluer
selon les matchs et les entraîneurs.

Ce résultat n'est pas une analyse en temps réel
ni une prédiction fiable.
`;

    res.json({ analysis: analyse });

  } catch (erreur) {
    console.error("Erreur PITCH'AURA :", erreur);
    res.status(500).json({
      erreur: "Impossible de générer l'analyse."
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(process.env.PORT || 3000, () => {
  console.log("PITCH'AURA V6.1 démarré !");
});
