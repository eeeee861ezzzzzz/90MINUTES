
const express = require("express");
const path = require("path");
const equipes = require("./equipes.json");

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(express.static(__dirname));

const alias = {
  psg: [
    "psg",
    "paris saint-germain",
    "paris sg"
  ],
  "real-madrid": [
    "real madrid",
    "réal madrid"
  ],
  barcelone: [
    "barcelone",
    "barcelona",
    "barça",
    "barca"
  ],
  "manchester-city": [
    "manchester city",
    "man city"
  ]
};

function normaliser(texte) {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function trouverEquipes(question) {
  const texte = normaliser(question);

  return Object.keys(alias).filter(id =>
    alias[id].some(nom => {
      const recherche = normaliser(nom);
      const debut = texte.indexOf(recherche);

      if (debut === -1) return false;

      const avant = texte[debut - 1] || " ";
      const apres = texte[debut + recherche.length] || " ";

      return !/[a-z0-9]/.test(avant) &&
             !/[a-z0-9]/.test(apres);
    })
  );
}

function liste(elements) {
  return elements
    .map(element => "• " + element)
    .join("\n");
}

function ficheEquipe(id) {
  const equipe = equipes[id];

  return `
━━━━━━━━━━━━━━━━━━━━

⚽ ${equipe.nom.toUpperCase()}

🏆 Championnat : ${equipe.championnat}
📋 Système de référence : ${equipe.systeme}

STYLE DE JEU
${equipe.style}

✅ POINTS FORTS
${liste(equipe.pointsForts)}

⚠️ POINTS FAIBLES
${liste(equipe.pointsFaibles)}
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

1. Observer quelle équipe contrôle
   le milieu de terrain.

2. Étudier l'efficacité du pressing
   et la sortie de balle adverse.

3. Identifier les espaces disponibles
   lors des transitions.

4. Analyser les déplacements des
   joueurs entre les lignes.

5. Observer les ajustements tactiques
   pendant la rencontre.

━━━━━━━━━━━━━━━━━━━━

🔮 SCÉNARIOS POSSIBLES

• Une équipe pourrait imposer
  son rythme grâce à la possession.

• Les contre-attaques pourraient
  créer des occasions importantes.

• Les changements de système
  pourraient modifier l'équilibre.

• Le pressing pourrait provoquer
  des récupérations dangereuses.
`;
}

app.post("/api/analyze", (req, res) => {
  try {
    const question = req.body?.question;

    if (
      typeof question !== "string" ||
      !question.trim()
    ) {
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

Cette équipe n'est pas encore
disponible dans notre base.

Équipes actuellement disponibles :

• Paris Saint-Germain
• Real Madrid
• FC Barcelone
• Manchester City

De nouveaux clubs seront ajoutés.
`
      });
    }

    let analyse = `
PITCH'AURA V2.1
ANALYSE TACTIQUE
`;

    ids.forEach(id => {
      analyse += ficheEquipe(id);
    });

    if (ids.length >= 2) {
      analyse += comparerEquipes(ids[0], ids[1]);
    }

    analyse += `

━━━━━━━━━━━━━━━━━━━━

ℹ️ INFORMATIONS

Cette analyse est construite à partir
de profils tactiques simplifiés.

Les formations et les styles peuvent
évoluer selon les matchs.

Il ne s'agit pas d'une analyse en
temps réel ni d'une prédiction fiable.
`;

    res.json({ analysis: analyse });

  } catch (error) {
    console.error("Erreur PITCH'AURA :", error);

    res.status(500).json({
      erreur: "Impossible de générer l'analyse."
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

app.listen(process.env.PORT || 3000, () => {
  console.log("PITCH'AURA V2.1 démarré !");
});
