
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const equipes = require("./equipes.json");

const app = express();

const SITE_URL = "https://nine0minutes-spca.onrender.com";

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

app.use(express.json({ limit: "10kb" }));
app.use(express.static(__dirname));

/* =========================================
   90MINUTES - CONNEXION GITHUB
========================================= */

function lireCookies(req) {
  const cookies = {};

  for (const partie of (req.headers.cookie || "").split(";")) {
    const position = partie.indexOf("=");

    if (position === -1) continue;

    const nom = partie.slice(0, position).trim();
    const valeur = partie.slice(position + 1).trim();

    cookies[nom] = valeur;
  }

  return cookies;
}

function pageMessage(message) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>90MINUTES</title>
    </head>
    <body>
      <h2>${message}</h2>
    </body>
    </html>
  `;
}

app.get("/auth", (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(503).send(
      pageMessage("Connexion GitHub non configurée.")
    );
  }

  const state = crypto.randomBytes(32).toString("hex");

  res.cookie("cms_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/"
  });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${SITE_URL}/callback`,
    scope: "public_repo",
    state
  });

  res.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  );
});

app.get("/callback", async (req, res) => {
  const cookies = lireCookies(req);

  const stateRecu =
    typeof req.query.state === "string"
      ? req.query.state
      : "";

  const stateAttendu = cookies.cms_oauth_state || "";

  res.clearCookie("cms_oauth_state", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/"
  });

  if (
    !stateRecu ||
    !stateAttendu ||
    stateRecu.length !== stateAttendu.length ||
    !crypto.timingSafeEqual(
      Buffer.from(stateRecu),
      Buffer.from(stateAttendu)
    )
  ) {
    return res.status(403).send(
      pageMessage("Session expirée. Réessaie de te connecter.")
    );
  }

  if (
    typeof req.query.code !== "string" ||
    !req.query.code
  ) {
    return res.status(400).send(
      pageMessage("Autorisation GitHub annulée.")
    );
  }

  try {
    const reponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: req.query.code,
          redirect_uri: `${SITE_URL}/callback`
        }),
        signal: AbortSignal.timeout(15000)
      }
    );

    if (!reponse.ok) {
      throw new Error("Échange OAuth impossible");
    }

    const donnees = await reponse.json();

    if (!donnees.access_token) {
      throw new Error("GitHub n'a pas fourni de jeton");
    }

    const message =
      "authorization:github:success:" +
      JSON.stringify({
        token: donnees.access_token
      });

    res.type("html").send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Connexion 90MINUTES</title>
      </head>
      <body>
        <p>Connexion réussie. Retour à l'administration...</p>
        <script>
          (function () {
            const message = ${JSON.stringify(message)};
            const origine = ${JSON.stringify(SITE_URL)};

            if (window.opener) {
              window.opener.postMessage(message, origine);
              window.close();
            } else {
              document.body.textContent =
                "Retourne à l'administration 90MINUTES.";
            }
          })();
        </script>
      </body>
      </html>
    `);
  } catch (erreur) {
    console.error("Erreur de connexion GitHub");

    res.status(500).send(
      pageMessage(
        "Connexion impossible. Réessaie depuis l'administration."
      )
    );
  }
});

/* =========================================
   90MINUTES - ENTRAÎNEURS
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
  let texte = "90MINUTES — ANALYSE TACTIQUE\n";

  ids.slice(0, 2).forEach(id => {
    texte += fiche(id);
  });

  if (ids.length >= 2) {
    texte += comparaison(ids[0], ids[1]);
  }

  texte += `
━━━━━━━━━━━━━━━━━━━━
NOTE 90MINUTES

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
          "Choisis un club disponible dans 90MINUTES."
      });
    }

    return res.json({
      analysis: genererAnalyse(ids)
    });

  } catch (erreur) {
    console.error("Erreur d'analyse");

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
   DÉMARRAGE DE 90MINUTES
========================================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `90MINUTES est en ligne sur le port ${PORT}`
  );
});
