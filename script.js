/* =========================================================
   SOLITAIRE INVADERS — script.js
   Sommaire :
     1. Constantes et réglages
     2. Les cartes (paquet, mélange, règle de tir)
     3. Éléments HTML (HUD, écrans, boutons)
     4. Nouvelle partie
     5. Mise à jour du jeu (mouvements, collisions)
     6. Actions du joueur (piocher, fin de partie)
     7. Dessin sur le canvas
     8. Clavier
     9. Boucle de jeu et démarrage
   ========================================================= */

/* ---------- 1. CONSTANTES ET RÉGLAGES ----------
   Joue avec ces valeurs pour rendre le jeu plus facile ou plus dur ! */
const canvas = document.getElementById("zone-jeu");
const ctx = canvas.getContext("2d");
const LARGEUR = canvas.width; // 800
const HAUTEUR = canvas.height; // 600

// Les 4 enseignes, dans le même ordre que les fondations du HTML
const ENSEIGNES = ["♠", "♥", "♦", "♣"];
// Noms des valeurs (index 1 = As, 11 = Valet, 12 = Dame, 13 = Roi)
const NOMS_VALEURS = [
  "",
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "V",
  "D",
  "R",
];

// Taille des cartes-envahisseurs et de la formation
const CARTE_L = 44;
const CARTE_H = 60;
const ECART = 10;
const COLONNES = 10;
const RANGEES = 3;

// Le vaisseau
const VAISSEAU_L = 60;
const VAISSEAU_H = 30;
const VAISSEAU_Y = HAUTEUR - 60; // hauteur de la ligne de défense
const VITESSE_VAISSEAU = 320; // pixels par seconde

// Les tirs (un petit dessin de carte qui monte)
const TIR_L = 22;
const TIR_H = 30;
const VITESSE_TIR = 420;
const DELAI_TIR = 0.35; // secondes entre deux tirs

// La formation d'envahisseurs
const VITESSE_BASE = 25; // vitesse horizontale au départ
const DESCENTE = 14; // de combien elle descend à chaque bord
const MARGE = 10; // distance minimale avec les bords

// Les As qui tombent
const VITESSE_AS = 110;
const DELAI_AS = 7; // secondes entre deux As

// Couleurs (les mêmes que dans style.css)
const COULEURS = {
  tapis: "#143f27",
  carte: "#fbf6e9",
  rouge: "#c8102e",
  noir: "#1b1b2f",
  or: "#e9b44c",
  blanc: "#ffffff",
};

/* ---------- 2. LES CARTES ---------- */

// Crée un paquet de 52 cartes. Chaque carte est un petit objet.
function creerPaquet() {
  const paquet = [];
  for (let enseigne = 0; enseigne < 4; enseigne++) {
    for (let valeur = 1; valeur <= 13; valeur++) {
      paquet.push({
        valeur: valeur,
        enseigne: enseigne,
        rouge: enseigne === 1 || enseigne === 2, // ♥ et ♦ sont rouges
      });
    }
  }
  return paquet;
}

// Mélange un tableau (algorithme de Fisher-Yates)
function melanger(tableau) {
  for (let i = tableau.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tableau[i], tableau[j]] = [tableau[j], tableau[i]]; // échange
  }
  return tableau;
}

// Texte d'une carte, par exemple "7♠" ou "D♥"
function nomCarte(carte) {
  return NOMS_VALEURS[carte.valeur] + ENSEIGNES[carte.enseigne];
}

// LA règle du jeu : couleur opposée ET valeur juste en dessous
function tirValide(munition, cible) {
  return munition.rouge !== cible.rouge && munition.valeur === cible.valeur - 1;
}

// Vrai si deux rectangles se touchent
function collision(ax, ay, al, ah, bx, by, bl, bh) {
  return ax < bx + bl && ax + al > bx && ay < by + bh && ay + ah > by;
}

/* ---------- 3. ÉLÉMENTS HTML ---------- */
const elScore = document.getElementById("score");
const elPioche = document.getElementById("pioche-restante");
const elMunition = document.getElementById("munition");
const elFondations = [0, 1, 2, 3].map((i) =>
  document.getElementById("fondation-" + i),
);

const ecranTitre = document.getElementById("ecran-titre");
const ecranFin = document.getElementById("ecran-fin");
const titreFin = document.getElementById("titre-fin");
const messageFin = document.getElementById("message-fin");
const btnJouer = document.getElementById("btn-jouer");
const btnRejouer = document.getElementById("btn-rejouer");

// Met à jour le HUD en HTML à partir de l'état du jeu
function majHUD() {
  elScore.textContent = jeu.score;
  elPioche.textContent = jeu.pioche.length;
  elMunition.textContent = nomCarte(jeu.munition);
  elMunition.classList.toggle("rouge", jeu.munition.rouge);

  jeu.fondations.forEach((valeur, i) => {
    const el = elFondations[i];
    if (valeur === 0) {
      el.textContent = ENSEIGNES[i]; // fondation encore fermée
      el.classList.remove("active");
    } else {
      el.textContent = NOMS_VALEURS[valeur] + ENSEIGNES[i];
      el.classList.add("active");
    }
  });
}

/* ---------- 4. NOUVELLE PARTIE ---------- */

// "etat" peut valoir : 'titre', 'jeu', 'pause' ou 'fin'
let etat = "titre";
// "jeu" contient toutes les données de la partie en cours
let jeu = null;

function nouvellePartie() {
  // Paquet n°1 : les envahisseurs (sauf les As, qui tomberont du ciel)
  const paquetEnnemi = melanger(creerPaquet());
  const lesAs = paquetEnnemi.filter((carte) => carte.valeur === 1);
  const ennemis = paquetEnnemi
    .filter((carte) => carte.valeur !== 1)
    .slice(0, COLONNES * RANGEES); // on en garde 30

  // On range les envahisseurs en grille, centrée horizontalement
  const largeurFormation = COLONNES * (CARTE_L + ECART) - ECART;
  const departX = (LARGEUR - largeurFormation) / 2;

  const envahisseurs = ennemis.map((carte, i) => ({
    carte: carte,
    x: departX + (i % COLONNES) * (CARTE_L + ECART),
    y: 40 + Math.floor(i / COLONNES) * (CARTE_H + ECART),
    flash: 0, // clignote en rouge si mauvais tir
  }));

  // Paquet n°2 : la pioche de munitions
  const pioche = melanger(creerPaquet());

  jeu = {
    score: 0,
    envahisseurs: envahisseurs,
    total: envahisseurs.length,
    direction: 1, // 1 = droite, -1 = gauche
    penalite: 1, // multiplicateur de vitesse

    vaisseau: { x: LARGEUR / 2 - VAISSEAU_L / 2 },
    tir: null, // un seul tir à la fois
    recharge: 0,

    pioche: pioche,
    defausse: [],
    munition: pioche.pop(),

    asEnAttente: lesAs,
    asQuiTombe: null,
    minuteurAs: 3, // premier As après 3 secondes
    fondations: [0, 0, 0, 0], // 0 = fermée, sinon valeur du dessus

    message: "",
    minuteurMessage: 0,
  };

  majHUD();
  etat = "jeu";
}

function afficherMessage(texte) {
  jeu.message = texte;
  jeu.minuteurMessage = 1.5;
}

/* ---------- 5. MISE À JOUR DU JEU ----------
   "dt" = temps écoulé depuis l'image précédente, en secondes.
   On multiplie les vitesses par dt pour que le jeu tourne
   à la même vitesse sur tous les ordinateurs. */
function mettreAJour(dt) {
  deplacerVaisseau(dt);
  gererTir(dt);
  if (etat !== "jeu") return; // la partie a pu se terminer
  deplacerFormation(dt);
  if (etat !== "jeu") return;
  gererAs(dt);

  if (jeu.minuteurMessage > 0) jeu.minuteurMessage -= dt;
}

function deplacerVaisseau(dt) {
  const v = jeu.vaisseau;
  if (touches.gauche) v.x -= VITESSE_VAISSEAU * dt;
  if (touches.droite) v.x += VITESSE_VAISSEAU * dt;
  // On empêche le vaisseau de sortir de l'écran
  v.x = Math.max(MARGE, Math.min(LARGEUR - VAISSEAU_L - MARGE, v.x));
}

function gererTir(dt) {
  jeu.recharge -= dt;

  // Nouveau tir si : touche enfoncée, pas de tir en vol, arme rechargée
  if (touches.tir && !jeu.tir && jeu.recharge <= 0) {
    jeu.tir = {
      carte: jeu.munition, // on mémorise la carte tirée
      x: jeu.vaisseau.x + VAISSEAU_L / 2 - TIR_L / 2,
      y: VAISSEAU_Y - TIR_H,
    };
    jeu.recharge = DELAI_TIR;
  }

  if (!jeu.tir) return;

  jeu.tir.y -= VITESSE_TIR * dt;

  // Sorti de l'écran par le haut
  if (jeu.tir.y + TIR_H < 0) {
    jeu.tir = null;
    return;
  }

  // Est-ce que le tir touche un envahisseur ?
  for (let i = 0; i < jeu.envahisseurs.length; i++) {
    const e = jeu.envahisseurs[i];
    if (
      collision(jeu.tir.x, jeu.tir.y, TIR_L, TIR_H, e.x, e.y, CARTE_L, CARTE_H)
    ) {
      if (tirValide(jeu.tir.carte, e.carte)) {
        jeu.tir = null;
        detruireEnvahisseur(i);
      } else {
        // Mauvaise carte : le tir est perdu et la formation accélère un peu
        jeu.tir = null;
        e.flash = 0.3;
        jeu.penalite *= 1.03;
        jeu.score = Math.max(0, jeu.score - 5);
        afficherMessage("Mauvaise carte !");
        majHUD();
      }
      return;
    }
  }
}

function detruireEnvahisseur(index) {
  const carte = jeu.envahisseurs[index].carte;
  jeu.envahisseurs.splice(index, 1); // on le retire du tableau
  jeu.score += 10;

  // Bonus si la carte continue sa fondation (ex : 2♥ sur A♥)
  const sommet = jeu.fondations[carte.enseigne];
  if (sommet > 0 && carte.valeur === sommet + 1) {
    jeu.fondations[carte.enseigne] = carte.valeur;
    jeu.score += 50;
    afficherMessage("Fondation +50");
  }

  majHUD();

  if (jeu.envahisseurs.length === 0) {
    finDePartie(true);
  }
}

function deplacerFormation(dt) {
  // Plus il reste peu d'ennemis, plus ils vont vite (comme dans l'original)
  const progression = 1 - jeu.envahisseurs.length / jeu.total;
  const vitesse = VITESSE_BASE * (1 + progression * 1.5) * jeu.penalite;

  let minX = Infinity;
  let maxX = -Infinity;
  for (const e of jeu.envahisseurs) {
    e.x += vitesse * jeu.direction * dt;
    if (e.flash > 0) e.flash -= dt;
    minX = Math.min(minX, e.x);
    maxX = Math.max(maxX, e.x + CARTE_L);
  }

  // Si la formation touche un bord : on la recale, elle descend et change de sens
  let decalage = 0;
  if (minX < MARGE) {
    decalage = MARGE - minX;
    jeu.direction = 1;
  } else if (maxX > LARGEUR - MARGE) {
    decalage = LARGEUR - MARGE - maxX;
    jeu.direction = -1;
  }

  if (decalage !== 0) {
    for (const e of jeu.envahisseurs) {
      e.x += decalage;
      e.y += DESCENTE;
    }
  }

  // Défaite si une carte atteint la ligne de défense
  for (const e of jeu.envahisseurs) {
    if (e.y + CARTE_H >= VAISSEAU_Y) {
      finDePartie(false);
      return;
    }
  }
}

function gererAs(dt) {
  // Faire tomber un nouvel As quand le minuteur arrive à zéro
  if (!jeu.asQuiTombe && jeu.asEnAttente.length > 0) {
    jeu.minuteurAs -= dt;
    if (jeu.minuteurAs <= 0) {
      jeu.asQuiTombe = {
        carte: jeu.asEnAttente.shift(),
        x: MARGE + Math.random() * (LARGEUR - CARTE_L - 2 * MARGE),
        y: -CARTE_H,
      };
    }
  }

  if (!jeu.asQuiTombe) return;

  const as = jeu.asQuiTombe;
  as.y += VITESSE_AS * dt;

  // Attrapé par le vaisseau : la fondation s'ouvre
  if (
    collision(
      as.x,
      as.y,
      CARTE_L,
      CARTE_H,
      jeu.vaisseau.x,
      VAISSEAU_Y,
      VAISSEAU_L,
      VAISSEAU_H,
    )
  ) {
    jeu.fondations[as.carte.enseigne] = 1;
    jeu.score += 25;
    afficherMessage("Fondation " + ENSEIGNES[as.carte.enseigne] + " ouverte !");
    jeu.asQuiTombe = null;
    jeu.minuteurAs = DELAI_AS;
    majHUD();
  }
  // Raté : il retourne dans la file et retombera plus tard
  else if (as.y > HAUTEUR) {
    jeu.asEnAttente.push(as.carte);
    jeu.asQuiTombe = null;
    jeu.minuteurAs = DELAI_AS;
    afficherMessage("As raté, il reviendra");
  }
}

/* ---------- 6. ACTIONS DU JOUEUR ---------- */

// Change de munition : la carte actuelle part à la défausse
function piocher() {
  jeu.defausse.push(jeu.munition);

  // Pioche vide : on retourne la défausse (comme au solitaire), mais ça coûte cher
  if (jeu.pioche.length === 0) {
    jeu.pioche = melanger(jeu.defausse);
    jeu.defausse = [];
    jeu.penalite *= 1.1;
    afficherMessage("Pioche retournée : ça accélère !");
  }

  jeu.munition = jeu.pioche.pop();
  jeu.penalite *= 1.02; // chaque pioche accélère un peu
  majHUD();
}

function finDePartie(victoire) {
  etat = "fin";
  jeu.tir = null;

  if (victoire) {
    titreFin.textContent = "Victoire !";
    messageFin.textContent =
      "Tu as nettoyé la table. Score final : " + jeu.score;
    // Confettis seulement si la bibliothèque a bien été chargée
    if (typeof confetti === "function") {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }
  } else {
    titreFin.textContent = "Partie terminée";
    messageFin.textContent =
      "Les cartes ont atteint ton vaisseau. Score final : " + jeu.score;
  }

  ecranFin.classList.remove("cache");
}

/* ---------- 7. DESSIN SUR LE CANVAS ---------- */

// Trace un rectangle aux coins arrondis
function rectArrondi(x, y, l, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + h, r);
  ctx.arcTo(x + l, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

// Dessine une carte. options.cible = halo doré, options.flash = fond rouge
function dessinerCarte(carte, x, y, l, h, options = {}) {
  // Halo doré autour des cartes que tu peux détruire
  if (options.cible) {
    ctx.shadowColor = COULEURS.or;
    ctx.shadowBlur = 15;
  }

  rectArrondi(x, y, l, h, 5);
  ctx.fillStyle = options.flash ? COULEURS.rouge : COULEURS.carte;
  ctx.fill();
  ctx.shadowBlur = 0; // on coupe le halo

  ctx.lineWidth = options.cible ? 3 : 1;
  ctx.strokeStyle = options.cible ? COULEURS.or : COULEURS.noir;
  ctx.stroke();

  // Valeur en haut, enseigne en bas
  if (options.flash) {
    ctx.fillStyle = COULEURS.blanc;
  } else {
    ctx.fillStyle = carte.rouge ? COULEURS.rouge : COULEURS.noir;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold " + Math.floor(h * 0.3) + "px Rubik, Arial, sans-serif";
  ctx.fillText(NOMS_VALEURS[carte.valeur], x + l / 2, y + h * 0.33);
  ctx.fillText(ENSEIGNES[carte.enseigne], x + l / 2, y + h * 0.7);
}

function dessinerFond() {
  ctx.fillStyle = COULEURS.tapis;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  // Ligne de défense en pointillés
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = "rgba(233, 180, 76, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, VAISSEAU_Y);
  ctx.lineTo(LARGEUR, VAISSEAU_Y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function dessinerVaisseau() {
  const x = jeu.vaisseau.x;
  const y = VAISSEAU_Y;

  // Canon
  ctx.fillStyle = COULEURS.or;
  ctx.fillRect(x + VAISSEAU_L / 2 - 4, y, 8, 12);

  // Corps
  rectArrondi(x, y + 10, VAISSEAU_L, VAISSEAU_H - 10, 6);
  ctx.fill();

  // La munition actuelle écrite sur le vaisseau
  ctx.fillStyle = jeu.munition.rouge ? COULEURS.rouge : COULEURS.noir;
  ctx.font = "bold 13px Rubik, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(nomCarte(jeu.munition), x + VAISSEAU_L / 2, y + 20);
}

function dessiner() {
  dessinerFond();

  // Envahisseurs
  for (const e of jeu.envahisseurs) {
    dessinerCarte(e.carte, e.x, e.y, CARTE_L, CARTE_H, {
      cible: tirValide(jeu.munition, e.carte),
      flash: e.flash > 0,
    });
  }

  // As qui tombe (toujours en surbrillance : il faut l'attraper !)
  if (jeu.asQuiTombe) {
    const as = jeu.asQuiTombe;
    dessinerCarte(as.carte, as.x, as.y, CARTE_L, CARTE_H, { cible: true });
  }

  // Tir
  if (jeu.tir) {
    dessinerCarte(jeu.tir.carte, jeu.tir.x, jeu.tir.y, TIR_L, TIR_H);
  }

  dessinerVaisseau();

  // Message temporaire
  if (jeu.minuteurMessage > 0) {
    ctx.fillStyle = COULEURS.or;
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText(jeu.message, LARGEUR / 2, VAISSEAU_Y - 30);
  }

  // Écran de pause
  if (etat === "pause") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
    ctx.fillStyle = COULEURS.or;
    ctx.font = '28px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText("Pause", LARGEUR / 2, HAUTEUR / 2);
  }
}

/* ---------- 8. CLAVIER ---------- */
const touches = { gauche: false, droite: false, tir: false };

document.addEventListener("keydown", (e) => {
  const enPartie = etat === "jeu" || etat === "pause";

  // Empêche la page de défiler avec les flèches ou l'espace pendant la partie
  if (
    enPartie &&
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)
  ) {
    e.preventDefault();
  }

  if (e.key === "ArrowLeft") touches.gauche = true;
  if (e.key === "ArrowRight") touches.droite = true;
  if (e.key === " ") touches.tir = true;

  // e.repeat = touche maintenue : on ne pioche qu'une fois par appui
  if ((e.key === "p" || e.key === "P") && etat === "jeu" && !e.repeat) {
    piocher();
  }

  if (e.key === "Escape" && !e.repeat) {
    if (etat === "jeu") etat = "pause";
    else if (etat === "pause") etat = "jeu";
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") touches.gauche = false;
  if (e.key === "ArrowRight") touches.droite = false;
  if (e.key === " ") touches.tir = false;
});

// Si on change d'onglet : pause automatique et touches relâchées
window.addEventListener("blur", () => {
  touches.gauche = touches.droite = touches.tir = false;
  if (etat === "jeu") etat = "pause";
});

// Boutons des écrans
btnJouer.addEventListener("click", () => {
  ecranTitre.classList.add("cache");
  btnJouer.blur(); // évite que "Espace" reclique le bouton
  nouvellePartie();
});

btnRejouer.addEventListener("click", () => {
  ecranFin.classList.add("cache");
  btnRejouer.blur();
  nouvellePartie();
});

/* ---------- 9. BOUCLE DE JEU ET DÉMARRAGE ----------
   requestAnimationFrame appelle "boucle" environ 60 fois par seconde. */
let dernierTemps = performance.now();

function boucle(temps) {
  // Temps écoulé, limité à 0.05 s pour éviter les sauts après une pause d'onglet
  const dt = Math.min((temps - dernierTemps) / 1000, 0.05);
  dernierTemps = temps;

  if (etat === "jeu") {
    mettreAJour(dt);
  }

  if (jeu) {
    dessiner();
  } else {
    dessinerFond(); // avant la première partie
  }

  requestAnimationFrame(boucle);
}

requestAnimationFrame(boucle);
