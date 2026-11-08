
const express = require("express");
const path = require("path");
const equipes = require("./equipes.json");

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(express.static(__dirname));

/* =========================================
   PITCH'AURA - ENTRAÎNEURS DES 20 CLUBS
========================================= */

const entraineurs = {
  "psg": "Luis Enrique",
  "real-madrid": "José Mourinho",
  "barcelone": "Hansi Flick",
  "manchester-city": "Enzo Maresca",
  "arsenal": "Mikel Arteta",
  "liverpool": "Andoni Iraola",
  "chelsea": "Xabi Alonso",
  "manchester-united": "Michael Carrick",
  "tottenham": "Roberto De Zerbi",
  "bayern": "Vincent Kompany",
  "dortmund": "Niko Kovač",
  "inter": "Cristian Chivu",
  "ac-milan": "Rúben Amorim",
  "juventus": "Luciano Spalletti",
  "naples": "Massimiliano Allegri",
  "marseille": "Bruno Genesio",
  "monaco": "Filipe Luís",
  "lyon": "Paulo Fonseca",
  "atletico": "Diego Simeone",
  "leverkusen": "Carles Martínez Novell"
};

/* =========================================
   RECONNAISSANCE DES CLUBS
========================================= */

const alias = {
  psg: ["psg", "paris", "paris saint germain"],
  "real-madrid": ["real madrid", "real"],
  barcelone: ["barca", "barça", "barcelone", "barcelona"],
  "manchester-city": ["man city", "manchester city"],
  arsenal: ["arsenal"],
  liverpool: ["liverpool"],
  chelsea: ["chelsea"],
  "manchester-united": [
    "man utd",
    "man united",
    "manchester united"
  ],
  tottenham: ["tottenham", "spurs"],
  bayern: ["bayern", "bayern munich"],
  dortmund: ["dortmund", "bvb"],
  inter: ["inter", "inter milan"],
  "ac-milan": ["ac milan", "milan ac"],
  juventus: ["juventus", "juve"],
  naples: ["naples", "napoli"],
  marseille: ["om", "marseille"],
  monaco: ["monaco"],
  lyon: ["ol", "lyon"],
  atletico: ["atletico", "atletico madrid"],
  leverkusen: ["leverkusen", "bayer leverkusen"]
};

function normaliser(texte) {
  return String(texte)
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
  const trouves = [];

  for (const [id, equipe] of Object.entries(equipes)) {
    const noms = [
      equipe.nom,
      id,
      ...(alias[id] || [])
    ];

    let premierePosition = Infinity;

    for (const nom of noms) {
      const valeur = normaliser(nom);

      if (!valeur) continue;

      const regex = new RegExp(
        "(^|[^a-z0-9])" +
        valeur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "(?=$|[^a-z0-9])"
      );

      const match = regex.exec(texte);

      if (match) {
        premierePosition = Math.min(
          premierePosition,
          match.index
        );
      }
    }

    if (premierePosition !== Infinity) {
      trouves.push({
        id,
        position: premierePosition
      });
    }
  }

  return trouves
    .sort((a, b) => a.position - b.position)
    .map(item => item.id);
}

/* =========================================
   INFORMATIONS DES ÉQUIPES
========================================= */

function liste(elements) {
  return (elements || [])
    .map(item => "• " + item)
    .join("\n");
}

function nomEntraineur(id) {
  const equipe = equipes[id];

  return (
    entraineurs[id] ||
    equipe.entraineur ||
    "À confirmer"
  );
}

function fiche(id) {
  const e = equipes[id];

  return `
━━━━━━━━━━━━━━━━━━━━
⚽ ${e.nom.toUpperCase()}

🏆 Championnat : ${e.championnat}
📋 Formation : ${e.systeme}
👔 Entraîneur : ${nomEntraineur(id)}

STYLE DE JEU
${e.style}

POINTS FORTS
${liste(e.pointsForts)}

POINTS FAIBLES
${liste(e.pointsFaibles)}
`;
}

/* =========================================
   COMPARAISON TACTIQUE
========================================= */

function comparaison(idA, idB) {
  const a = equipes[idA];
  const b = equipes[idB];

  return `
━━━━━━━━━━━━━━━━━━━━
⚔️ DUEL TACTIQUE

${a.nom.toUpperCase()}
📋 ${a.systeme}
👔 ${nomEntraineur(idA)}

CONTRE

${b.nom.toUpperCase()}
📋 ${b.systeme}
👔 ${nomEntraineur(idB)}

━━━━━━━━━━━━━━━━━━━━
ANALYSE DES STYLES

${a.nom}
${a.style}

${b.nom}
${b.style}

━━━━━━━━━━━━━━━━━━━━
POINTS À EXPLOITER

${a.nom} pourrait exploiter :
${liste(b.pointsFaibles)}

${b.nom} pourrait exploiter :
${liste(a.pointsFaibles)}

━━━━━━━━━━━━━━━━━━━━
CLÉS TACTIQUES

• La bataille du milieu de terrain.
• Le pressing et les sorties de balle.
• Les espaces laissés derrière les défenses.
• Les transitions offensives et défensives.
• Les ajustements des entraîneurs.

━━━━━━━━━━━━━━━━━━━━
SCÉNARIOS POSSIBLES

• Une équipe pourrait dominer la possession.
• Le pressing pourrait provoquer des erreurs.
• Les contre-attaques pourraient être décisives.
• Les changements tactiques pourraient
  modifier le déroulement du match.
`;
}

/* =========================================
   GÉNÉRATION DES ANALYSES
========================================= */

function genererAnalyse(ids) {
  let texte = "PITCH'AURA — ANALYSE TACTIQUE\n";

  ids.slice(0, 2).forEach(id => {
    texte += fiche(id);
  });

  if (ids.length >= 2) {
    texte += comparaison(ids[0], ids[1]);
  }

  texte += `
━━━━━━━━━━━━━━━━━━━━
NOTE PITCH'AURA

Cette analyse est indicative et repose
sur des profils tactiques simplifiés.

Les formations et les entraîneurs
peuvent évoluer au cours de la saison.

Il ne s'agit pas d'une analyse
automatique de données de match en direct.
`;

  return texte;
}

/* =========================================
   API - LISTE DES CLUBS
========================================= */

app.get("/api/teams", (req, res) => {
  const clubs = Object.entries(equipes)
    .map(([id, e]) => ({
      id: id,
      nom: e.nom,
      championnat: e.championnat,
      systeme: e.systeme,
      entraineur: nomEntraineur(id)
    }));

  res.json({
    total: clubs.length,
    equipes: clubs
  });
});

/* =========================================
   API - ANALYSE TACTIQUE
========================================= */

app.post("/api/analyze", (req, res) => {
  try {
    let ids = [];

    if (Array.isArray(req.body?.teams)) {
      ids = req.body.teams.filter(
        id =>
          typeof id === "string" &&
          Object.prototype.hasOwnProperty.call(
            equipes,
            id
          )
      );

      ids = [...new Set(ids)].slice(0, 2);

    } else if (
      typeof req.body?.question === "string"
    ) {
      const question = req.body.question.trim();

      if (!question || question.length > 1000) {
        return res.status(400).json({
          erreur: "Écris une demande valide."
        });
      }

      ids = trouverEquipes(question).slice(0, 2);

    } else {
      return res.status(400).json({
        erreur: "Demande invalide."
      });
    }

    if (ids.length === 0) {
      return res.json({
        analysis:
          "Aucune équipe reconnue.\n" +
          "Choisis un club disponible dans PITCH'AURA."
      });
    }

    return res.json({
      analysis: genererAnalyse(ids)
    });

  } catch (erreur) {
    console.error(erreur);

    return res.status(500).json({
      erreur: "Erreur lors de l'analyse."
    });
  }
});

/* =========================================
   PAGE D'ACCUEIL
========================================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =========================================
   DÉMARRAGE DE PITCH'AURA
========================================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `PITCH'AURA est en ligne sur le port ${PORT}`
  );
});
