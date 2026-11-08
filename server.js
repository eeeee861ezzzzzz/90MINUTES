
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const equipes = require("./equipes.json");

const app = express();

const SITE_URL = "https://nine0minutes-spca.onrender.com";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

const ADMIN_LOGIN = "eeeee861ezzzzzz";
const REPO_NAME = "90MINUTES";
const BRANCH = "main";

app.use(express.json({ limit: "50kb" }));

// Pages publiques du site
app.use(express.static(__dirname, {
  dotfiles: "deny",
  index: false
}));

// ======================================
// ARTICLES PUBLICS
// ======================================

const ARTICLES_DIR = path.join(__dirname, "articles");

app.get("/api/articles", (req, res) => {
  try {
    if (!fs.existsSync(ARTICLES_DIR)) {
      return res.json([]);
    }

    const articles = fs.readdirSync(ARTICLES_DIR)
      .filter(nom => nom.endsWith(".json"))
      .map(nom => {
        const contenu = fs.readFileSync(
          path.join(ARTICLES_DIR, nom),
          "utf8"
        );

        return {
          ...JSON.parse(contenu),
          id: nom.replace(/\.json$/, "")
        };
      })
      .sort((a, b) =>
        String(b.date || "").localeCompare(
          String(a.date || "")
        )
      );

    res.json(articles);
  } catch (erreur) {
    console.error("Erreur articles :", erreur);
    res.status(500).json({
      erreur: "Impossible de charger les articles."
    });
  }
});

// ======================================
// CONNEXION PRIVÉE GITHUB
// ======================================

const SESSION_KEY = crypto
  .createHash("sha256")
  .update(
    String(CLIENT_SECRET || "") +
    ":90minutes:session:v1"
  )
  .digest();

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/"
};

function lireCookies(req) {
  const resultat = {};

  for (const partie of (req.headers.cookie || "").split(";")) {
    const position = partie.indexOf("=");

    if (position === -1) continue;

    const nom = partie.slice(0, position).trim();
    const valeur = partie.slice(position + 1).trim();

    resultat[nom] = valeur;
  }

  return resultat;
}

function creerSession(donnees) {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    SESSION_KEY,
    iv
  );

  const contenu = Buffer.concat([
    cipher.update(JSON.stringify(donnees)),
    cipher.final()
  ]);

  return Buffer.concat([
    iv,
    cipher.getAuthTag(),
    contenu
  ]).toString("base64url");
}

function verifierSession(req) {
  try {
    if (!CLIENT_SECRET) return null;

    const valeur = lireCookies(req).minutes_session;

    if (!valeur) return null;

    const contenu = Buffer.from(
      valeur,
      "base64url"
    );

    if (contenu.length < 29) return null;

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      SESSION_KEY,
      contenu.subarray(0, 12)
    );

    decipher.setAuthTag(
      contenu.subarray(12, 28)
    );

    const donnees = JSON.parse(
      Buffer.concat([
        decipher.update(contenu.subarray(28)),
        decipher.final()
      ]).toString()
    );

    if (donnees.exp < Date.now()) return null;

    if (donnees.login !== ADMIN_LOGIN) {
      return null;
    }

    return donnees;
  } catch {
    return null;
  }
}

async function requeteGithub(url, token, options = {}) {
  const reponse = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {})
    },
    signal: AbortSignal.timeout(15000)
  });

  const donnees = await reponse.json()
    .catch(() => ({}));

  return {
    ok: reponse.ok,
    status: reponse.status,
    data: donnees
  };
}

// Ouvrir la connexion GitHub
app.get("/auth", (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(503).send(
      "Connexion GitHub non configurée."
    );
  }

  const state = crypto.randomBytes(32)
    .toString("hex");

  res.cookie(
    "minutes_oauth_state",
    state,
    {
      ...cookieOptions,
      maxAge: 600000
    }
  );

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

// Retour après connexion GitHub
app.get("/callback", async (req, res) => {
  const cookies = lireCookies(req);

  const attendu = cookies.minutes_oauth_state || "";
  const recu = typeof req.query.state === "string"
    ? req.query.state
    : "";

  res.clearCookie(
    "minutes_oauth_state",
    cookieOptions
  );

  if (
    !attendu ||
    !recu ||
    attendu.length !== recu.length ||
    !crypto.timingSafeEqual(
      Buffer.from(attendu),
      Buffer.from(recu)
    )
  ) {
    return res.status(403).send(
      "Session expirée. Recommence la connexion."
    );
  }

  if (
    typeof req.query.code !== "string" ||
    !req.query.code
  ) {
    return res.status(400).send(
      "Autorisation GitHub annulée."
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

    const donnees = await reponse.json();

    if (!reponse.ok || !donnees.access_token) {
      throw new Error("Connexion GitHub refusée.");
    }

    const utilisateur = await requeteGithub(
      "https://api.github.com/user",
      donnees.access_token
    );

    if (
      !utilisateur.ok ||
      utilisateur.data.login !== ADMIN_LOGIN
    ) {
      return res.status(403).send(
        "Ce compte GitHub n'est pas autorisé."
      );
    }

    const duree = 7 * 24 * 60 * 60 * 1000;

    res.cookie(
      "minutes_session",
      creerSession({
        login: ADMIN_LOGIN,
        token: donnees.access_token,
        exp: Date.now() + duree
      }),
      {
        ...cookieOptions,
        maxAge: duree
      }
    );

    res.redirect("/redaction.html");

  } catch (erreur) {
    console.error(
      "Erreur OAuth :",
      erreur.message
    );

    res.status(502).send(
      "Connexion GitHub impossible."
    );
  }
});

// Vérifier si le rédacteur est connecté
app.get("/api/me", (req, res) => {
  res.set("Cache-Control", "no-store");

  res.json({
    authenticated: !!verifierSession(req)
  });
});

// Déconnexion
app.post("/api/logout", (req, res) => {
  res.clearCookie(
    "minutes_session",
    cookieOptions
  );

  res.json({ ok: true });
});

// ======================================
// PUBLIER UN ARTICLE SUR GITHUB
// ======================================

app.post("/api/publish", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const utilisateur = verifierSession(req);

  if (!utilisateur) {
    return res.status(401).json({
      erreur: "Connecte-toi à ton compte GitHub."
    });
  }

  if (req.get("origin") !== SITE_URL) {
    return res.status(403).json({
      erreur: "Origine non autorisée."
    });
  }

  const donnees = req.body;

  if (
    !donnees ||
    typeof donnees !== "object" ||
    Array.isArray(donnees)
  ) {
    return res.status(400).json({
      erreur: "Article invalide."
    });
  }

  const champs = [
    "titre",
    "categorie",
    "championnat",
    "domicile",
    "exterieur",
    "scoreDomicile",
    "scoreExterieur",
    "introduction",
    "analyse",
    "verdict"
  ];

  const article = {};

  for (const champ of champs) {
    const valeur = donnees[champ] ?? "";

    if (
      typeof valeur !== "string" &&
      typeof valeur !== "number"
    ) {
      return res.status(400).json({
        erreur: `Champ invalide : ${champ}`
      });
    }

    article[champ] = String(valeur)
      .trim()
      .slice(0, champ === "analyse" ? 12000 : 4000);
  }

  if (
    !article.titre ||
    !article.introduction ||
    !article.analyse
  ) {
    return res.status(400).json({
      erreur: "Titre, introduction et analyse obligatoires."
    });
  }

  article.date = new Date().toISOString();

  const id = Date.now() + "-" +
    crypto.randomBytes(5).toString("hex");

  const chemin = `articles/${id}.json`;

  const url =
    `https://api.github.com/repos/` +
    `${ADMIN_LOGIN}/${REPO_NAME}/contents/${chemin}`;

  try {
    const resultat = await requeteGithub(
      url,
      utilisateur.token,
      {
        method: "PUT",
        body: JSON.stringify({
          message:
            "90MINUTES : nouvel article - " +
            article.titre.slice(0, 80),
          content: Buffer.from(
            JSON.stringify(article, null, 2)
          ).toString("base64"),
          branch: BRANCH
        })
      }
    );

    if (!resultat.ok) {
      console.error(
        "Publication GitHub :",
        resultat.status,
        resultat.data.message
      );

      return res.status(502).json({
        erreur:
          "GitHub a refusé la publication. " +
          "Vérifie les droits du compte et le dépôt."
      });
    }

    res.status(201).json({
      ok: true,
      id,
      message:
        "Article enregistré sur GitHub. " +
        "Il apparaîtra après le déploiement Render."
    });

  } catch (erreur) {
    console.error(
      "Erreur publication :",
      erreur.message
    );

    res.status(502).json({
      erreur: "Impossible de joindre GitHub."
    });
  }
});

// ======================================
// ENTRAÎNEURS
// ======================================

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

// ======================================
// RECONNAISSANCE DES CLUBS
// ======================================

const alias = {
  psg: ["psg", "paris", "paris saint germain"],
  "real-madrid": ["real madrid", "real"],
  barcelone: [
    "barca",
    "barça",
    "barcelone",
    "barcelona"
  ],
  "manchester-city": [
    "man city",
    "manchester city"
  ],
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

// ======================================
// INFORMATIONS DES ÉQUIPES
// ======================================

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

// ======================================
// COMPARAISON TACTIQUE
// ======================================

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

// ======================================
// GÉNÉRATION DES ANALYSES
// ======================================

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

// ======================================
// API - LISTE DES CLUBS
// ======================================

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

// ======================================
// API - ANALYSE TACTIQUE
// ======================================

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

// ======================================
// PAGE D'ACCUEIL
// ======================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

// ======================================
// DÉMARRAGE DU SERVEUR
// ======================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `90MINUTES est en ligne sur le port ${PORT}`
  );
});
