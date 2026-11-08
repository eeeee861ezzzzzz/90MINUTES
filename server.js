
const express = require("express");
const path = require("path");
const equipes = require("./equipes.json");

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(express.static(__dirname));

/* NOMS DES ENTRAÎNEURS
   À compléter ou actualiser dans equipes.json.
   Un nom non renseigné apparaît "À confirmer".
*/

const entraineurs = {
  "psg": "Luis Enrique",
  "barcelone": "Hansi Flick",
  "arsenal": "Mikel Arteta",
  "bayern": "Vincent Kompany",
  "atletico": "Diego Simeone",
  "lyon": "Paulo Fonseca"
};

const alias = {
  psg: ["psg", "paris", "paris saint germain"],
  "real-madrid": ["real madrid", "real"],
  barcelone: ["barca", "barça", "barcelone", "barcelona"],
  "manchester-city": ["man city", "manchester city"],
  arsenal: ["arsenal"],
  liverpool: ["liverpool"],
  chelsea: ["chelsea"],
  "manchester-united": [
    "man utd", "man united", "manchester united"
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

/* RECONNAISSANCE DES CLUBS */

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

/* INFORMATIONS DES CLUBS */

function liste(elements) {
  return (elements || [])
    .map(item => "• " + item)
    .join("\n");
}

function nomEntraineur(id) {
  const equipe = equipes[id];

  return equipe.entraineur ||
    entraineurs[id] ||
    "À confirmer";
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

/* COMPARAISON TACTIQUE */

function comparaison(idA, idB) {
  const a = equipes[idA];
  const b = equipes[idB];

  return `
━━━━━━━━━━━━━━━━━━━━
COMPARAISON TACTIQUE

${a.nom} : ${a.systeme}
${a.style}

${b.nom} : ${b.systeme}
${b.style}

━━━━━━━━━━━━━━━━━━━━
DUELS TACTIQUES

${a.nom} peut chercher à exploiter :
${liste(b.pointsFaibles)}

${b.nom} peut chercher à exploiter :
${liste(a.pointsFaibles)}

━━━━━━━━━━━━━━━━━━━━
CLÉS DU MATCH

• Observer la bataille du milieu de terrain.
• Étudier les sorties de balle sous pression.
• Identifier les espaces derrière les défenses.
• Comparer les transitions offensives.
• Observer les ajustements des entraîneurs.

━━━━━━━━━━━━━━━━━━━━
SCÉNARIOS POSSIBLES

• Une équipe pourrait contrôler la possession.
• Le pressing pourrait provoquer des récupérations hautes.
• Les contre-attaques pourraient créer des occasions.
• Les changements tactiques pourraient modifier le match.
`;
}

/* GÉNÉRATION DES ANALYSES */

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
INFORMATIONS

Analyse indicative basée sur des profils
tactiques simplifiés.

Les systèmes peuvent évoluer selon les matchs.
Les entraîneurs peuvent également changer.

Il ne s'agit pas de données en direct.
`;

  return texte;
}

/* API : LISTE DES ÉQUIPES */

app.get("/api/teams", (req, res) => {
  const clubs = Object.entries(equipes)
    .map(([id, e]) => ({
      id,
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

/* API : ANALYSE */

app.post("/api/analyze", (req, res) => {
  try {
    let ids = [];

    if (Array.isArray(req.body?.teams)) {
      ids = req.body.teams.filter(
        id =>
          typeof id === "string" &&
          Object.prototype.hasOwnProperty.call(
            equipes, id
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

    res.json({
      analysis: genererAnalyse(ids)
    });

  } catch (erreur) {
    console.error(erreur);

    res.status(500).json({
      erreur: "Erreur lors de l'analyse."
    });
  }
});

/* PAGE D'ACCUEIL */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* DÉMARRAGE DU SERVEUR */

app.listen(process.env.PORT || 3000, () => {
  console.log("PITCH'AURA est en ligne !");
});
