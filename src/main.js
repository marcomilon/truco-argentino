const suits = {
  espada: { label: "Espada", red: false },
  basto: { label: "Basto", red: false },
  oro: { label: "Oro", red: true },
  copa: { label: "Copa", red: true },
};

const ranks = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

const cardSuitFiles = {
  espada: "espadas",
  basto: "bastos",
  oro: "oros",
  copa: "copas",
};

const power = new Map([
  ["1-espada", 14],
  ["1-basto", 13],
  ["7-espada", 12],
  ["7-oro", 11],
  ["3", 10],
  ["2", 9],
  ["1", 8],
  ["12", 7],
  ["11", 6],
  ["10", 5],
  ["7", 4],
  ["6", 3],
  ["5", 2],
  ["4", 1],
]);

const state = {
  playerScore: 0,
  botScore: 0,
  playerTricks: 0,
  botTricks: 0,
  trick: 1,
  handActive: false,
  playerHand: [],
  botHand: [],
  playerPlayedCards: [],
  botPlayedCards: [],
  handValue: 1,
  envidoUsed: false,
  pendingCall: null,
};

const els = {
  playerScore: document.querySelector("#player-score"),
  botScore: document.querySelector("#bot-score"),
  playerRounds: document.querySelector("#player-rounds"),
  botRounds: document.querySelector("#bot-rounds"),
  roundTitle: document.querySelector("#round-title"),
  message: document.querySelector("#message"),
  playerHand: document.querySelector("#player-hand"),
  playerPlayed: document.querySelector("#player-played"),
  botPlayed: document.querySelector("#bot-played"),
  newHand: document.querySelector("#new-hand"),
  callEnvido: document.querySelector("#call-envido"),
  callTruco: document.querySelector("#call-truco"),
  fold: document.querySelector("#fold"),
  responseActions: document.querySelector("#response-actions"),
  acceptCall: document.querySelector("#accept-call"),
  declineCall: document.querySelector("#decline-call"),
  cardTemplate: document.querySelector("#card-template"),
};

function buildDeck() {
  return Object.keys(suits).flatMap((suit) =>
    ranks.map((rank) => ({
      id: `${rank}-${suit}`,
      rank,
      suit,
      power: power.get(`${rank}-${suit}`) ?? power.get(String(rank)),
      envido: rank > 7 ? 0 : rank,
    }))
  );
}

function shuffle(cards) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardName(card) {
  return `${card.rank} de ${suits[card.suit].label}`;
}

function cardImagePath(card) {
  return `assets/cards/${String(card.rank).padStart(2, "0")}-${cardSuitFiles[card.suit]}.png`;
}

function createSuitMark(suit) {
  const mark = document.createElement("span");
  mark.className = `suit-mark ${suit}-mark`;
  mark.innerHTML =
    {
      espada: `
        <svg viewBox="0 0 64 96" aria-hidden="true">
          <path class="ink-line" d="M32 6 L43 60 L32 86 L21 60 Z"></path>
          <path class="ink-fill" d="M32 6 L38 60 L32 78 L26 60 Z"></path>
          <path class="ink-line" d="M17 64 C24 58 40 58 47 64"></path>
          <path class="ink-line" d="M28 82 L36 82"></path>
        </svg>`,
      basto: `
        <svg viewBox="0 0 64 96" aria-hidden="true">
          <path class="ink-fill" d="M26 12 C35 6 45 10 47 20 C50 38 39 67 30 86 C27 91 18 88 20 82 C28 59 31 37 26 12 Z"></path>
          <path class="ink-line" d="M30 18 C40 26 38 47 24 78"></path>
          <path class="ink-line" d="M39 20 C33 25 30 32 29 40"></path>
          <path class="ink-line" d="M36 54 C30 58 26 64 23 73"></path>
        </svg>`,
      oro: `
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <circle class="coin-fill" cx="48" cy="48" r="34"></circle>
          <circle class="ink-line" cx="48" cy="48" r="25"></circle>
          <path class="ink-line" d="M36 48 H60 M48 36 V60"></path>
        </svg>`,
      copa: `
        <svg viewBox="0 0 72 96" aria-hidden="true">
          <path class="ink-fill" d="M18 14 H54 L49 46 C47 58 25 58 23 46 Z"></path>
          <path class="ink-line" d="M18 14 H54 L49 46 C47 58 25 58 23 46 Z"></path>
          <path class="ink-line" d="M32 58 V76 M40 58 V76 M24 80 H48"></path>
          <path class="ink-line" d="M24 24 H48"></path>
        </svg>`,
    }[suit];
  return mark;
}

function createCardFace(card) {
  const face = document.createElement("span");
  face.className = `card-face ${card.suit}-face`;

  if (card.rank > 7) {
    face.classList.add("figure-face");
    const figure = document.createElement("span");
    figure.className = "figure-label";
    figure.textContent = { 10: "Sota", 11: "Caballo", 12: "Rey" }[card.rank];
    face.append(figure, createSuitMark(card.suit));
    return face;
  }

  for (let count = 0; count < card.rank; count += 1) {
    face.append(createSuitMark(card.suit));
  }
  return face;
}

function renderCard(card, disabled = false) {
  const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
  const face = node.querySelector(".suit-large");
  const image = document.createElement("img");

  node.dataset.cardId = card.id;
  node.disabled = disabled;
  node.classList.add("image-card");
  node.classList.toggle("red-suit", suits[card.suit].red);
  node.querySelector(".rank").textContent = card.rank;
  image.className = "card-image";
  image.src = cardImagePath(card);
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    node.classList.remove("image-card");
    face.replaceChildren(createCardFace(card));
  }, { once: true });
  face.replaceChildren(image);
  node.querySelector(".suit").textContent = suits[card.suit].label;
  node.setAttribute("aria-label", cardName(card));
  return node;
}

function renderPlayed(target, cards) {
  target.textContent = "";
  target.classList.toggle("empty", cards.length === 0);
  if (cards.length === 0) {
    target.textContent = "—";
    return;
  }

  const stackCount = cards.length;
  const cardNodes = cards.map((card, index) => {
    const node = renderCard(card, true);
    node.style.setProperty("--stack-index", index);
    node.style.setProperty("--stack-count", stackCount);
    node.style.setProperty("--stack-offset", index - (stackCount - 1) / 2);
    return node;
  });
  target.append(...cardNodes);
}

function render() {
  const waitingForResponse = Boolean(state.pendingCall);
  els.playerScore.textContent = state.playerScore;
  els.botScore.textContent = state.botScore;
  els.playerRounds.textContent = `${state.playerTricks} ${state.playerTricks === 1 ? "mano" : "manos"}`;
  els.botRounds.textContent = `${state.botTricks} ${state.botTricks === 1 ? "mano" : "manos"}`;
  els.roundTitle.textContent = state.handActive ? `Mano ${state.trick}` : "Empezar partida";
  els.roundTitle.disabled = state.handActive;
  els.playerHand.replaceChildren(...state.playerHand.map((card) => renderCard(card, waitingForResponse)));
  renderPlayed(els.playerPlayed, state.playerPlayedCards);
  renderPlayed(els.botPlayed, state.botPlayedCards);

  const canAct = state.handActive && state.playerHand.length > 0 && !waitingForResponse;
  els.callEnvido.disabled = !canAct || state.envidoUsed;
  els.callTruco.disabled = !canAct || state.handValue > 1;
  els.fold.disabled = !canAct;
  els.responseActions.classList.toggle("hidden", !waitingForResponse);
  els.acceptCall.disabled = !waitingForResponse;
  els.declineCall.disabled = !waitingForResponse;
}

function startHand() {
  const deck = shuffle(buildDeck());
  state.playerHand = deck.slice(0, 3);
  state.botHand = deck.slice(3, 6);
  state.playerTricks = 0;
  state.botTricks = 0;
  state.trick = 1;
  state.handActive = true;
  state.playerPlayedCards = [];
  state.botPlayedCards = [];
  state.handValue = 1;
  state.envidoUsed = false;
  state.pendingCall = null;
  setMessage("Las cartas están repartidas. Jugá una carta o cantá Envido o Truco.");
  maybeBotCall();
  render();
}

function setMessage(text) {
  els.message.textContent = text;
}

function getEnvido(cards) {
  const bySuit = cards.reduce((groups, card) => {
    groups[card.suit] = groups[card.suit] || [];
    groups[card.suit].push(card.envido);
    return groups;
  }, {});

  const paired = Object.values(bySuit)
    .filter((group) => group.length > 1)
    .map((group) => group.sort((a, b) => b - a).slice(0, 2).reduce((sum, value) => sum + value, 20));

  return paired.length ? Math.max(...paired) : Math.max(...cards.map((card) => card.envido));
}

function botChooseCard() {
  return [...state.botHand].sort((a, b) => a.power - b.power)[0];
}

function getTrucoStrength(cards) {
  return cards.reduce((sum, card) => sum + card.power, 0);
}

function maybeBotCall() {
  if (!state.handActive || state.pendingCall) return;

  const botEnvido = getEnvido(state.botHand.concat(state.botPlayedCards));
  const trucoStrength = getTrucoStrength(state.botHand);
  const shouldCallEnvido = !state.envidoUsed && state.trick === 1 && botEnvido >= 27 && Math.random() < 0.72;
  const shouldCallTruco = state.handValue === 1 && trucoStrength >= 18 && Math.random() < 0.62;

  if (shouldCallEnvido) {
    state.pendingCall = "envido";
    state.envidoUsed = true;
    setMessage("La máquina canta Envido. ¿Querés?");
    return;
  }

  if (shouldCallTruco) {
    state.pendingCall = "truco";
    setMessage("La máquina canta Truco. ¿Querés?");
  }
}

function removeCard(hand, id) {
  const index = hand.findIndex((card) => card.id === id);
  return index >= 0 ? hand.splice(index, 1)[0] : null;
}

function playCard(cardId) {
  if (!state.handActive || state.pendingCall) return;
  const playerCard = removeCard(state.playerHand, cardId);
  if (!playerCard) return;

  const botCard = removeCard(state.botHand, botChooseCard().id);
  state.playerPlayedCards.push(playerCard);
  state.botPlayedCards.push(botCard);

  if (playerCard.power >= botCard.power) {
    state.playerTricks += 1;
    setMessage(`${cardName(playerCard)} le gana a ${cardName(botCard)}. Te llevás esta mano.`);
  } else {
    state.botTricks += 1;
    setMessage(`${cardName(botCard)} le gana a ${cardName(playerCard)}. La máquina se lleva esta mano.`);
  }

  const winner = getHandWinner();
  if (winner) {
    finishHand(winner);
    return;
  }

  state.trick += 1;
  maybeBotCall();
  render();
}

function getHandWinner() {
  if (state.playerTricks === 2) return "player";
  if (state.botTricks === 2) return "bot";
  if (state.trick === 3 && state.playerHand.length === 0) {
    return state.playerTricks >= state.botTricks ? "player" : "bot";
  }
  return null;
}

function finishHand(winner) {
  const points = state.handValue;
  state.handActive = false;
  state.pendingCall = null;
  if (winner === "player") {
    state.playerScore += points;
    setMessage(`Ganaste la mano por ${points} ${points === 1 ? "punto" : "puntos"}.`);
  } else {
    state.botScore += points;
    setMessage(`La máquina ganó la mano por ${points} ${points === 1 ? "punto" : "puntos"}.`);
  }

  if (state.playerScore >= 15 || state.botScore >= 15) {
    const matchWinner = state.playerScore >= 15 ? "Ganaste" : "La máquina ganó";
    setMessage(`${matchWinner} la partida. Repartí de nuevo para empezar otra.`);
    state.playerScore = Math.min(state.playerScore, 15);
    state.botScore = Math.min(state.botScore, 15);
  }

  render();
}

function callEnvido() {
  if (!state.handActive || state.envidoUsed || state.pendingCall) return;
  state.envidoUsed = true;
  const playerEnvido = getEnvido(state.playerHand.concat(state.playerPlayedCards));
  const botEnvido = getEnvido(state.botHand.concat(state.botPlayedCards));
  const playerWins = playerEnvido >= botEnvido;
  if (playerWins) {
    state.playerScore += 2;
  } else {
    state.botScore += 2;
  }
  setMessage(`Envido: vos ${playerEnvido}, máquina ${botEnvido}. ${playerWins ? "Sumás" : "La máquina suma"} 2.`);
  render();
}

function callTruco() {
  if (!state.handActive || state.handValue > 1 || state.pendingCall) return;
  const accepts = Math.random() > 0.28;
  if (accepts) {
    state.handValue = 2;
    setMessage("La máquina acepta el Truco. Esta mano ahora vale 2 puntos.");
  } else {
    finishHand("player");
    setMessage("La máquina no quiere Truco. Sumás 1 punto.");
  }
  render();
}

function fold() {
  if (!state.handActive || state.pendingCall) return;
  finishHand("bot");
  setMessage("Te fuiste al mazo. La máquina se lleva la mano.");
}

function acceptBotCall() {
  if (!state.pendingCall) return;

  if (state.pendingCall === "envido") {
    const playerEnvido = getEnvido(state.playerHand.concat(state.playerPlayedCards));
    const botEnvido = getEnvido(state.botHand.concat(state.botPlayedCards));
    const playerWins = playerEnvido >= botEnvido;
    if (playerWins) {
      state.playerScore += 2;
    } else {
      state.botScore += 2;
    }
    state.pendingCall = null;
    setMessage(`Envido querido: vos ${playerEnvido}, máquina ${botEnvido}. ${playerWins ? "Sumás" : "La máquina suma"} 2.`);
    render();
    return;
  }

  state.handValue = 2;
  state.pendingCall = null;
  setMessage("Querés Truco. Esta mano ahora vale 2 puntos.");
  render();
}

function declineBotCall() {
  if (!state.pendingCall) return;

  if (state.pendingCall === "envido") {
    state.pendingCall = null;
    state.botScore += 1;
    setMessage("No querés Envido. La máquina suma 1 punto.");
    render();
    return;
  }

  state.pendingCall = null;
  finishHand("bot");
  setMessage("No querés Truco. La máquina suma 1 punto.");
}

function maybeResetMatch() {
  if (state.playerScore >= 15 || state.botScore >= 15) {
    state.playerScore = 0;
    state.botScore = 0;
  }
  startHand();
}

els.newHand.addEventListener("click", maybeResetMatch);
els.roundTitle.addEventListener("click", maybeResetMatch);
els.callEnvido.addEventListener("click", callEnvido);
els.callTruco.addEventListener("click", callTruco);
els.fold.addEventListener("click", fold);
els.acceptCall.addEventListener("click", acceptBotCall);
els.declineCall.addEventListener("click", declineBotCall);
els.playerHand.addEventListener("click", (event) => {
  const card = event.target.closest(".card");
  if (card) playCard(card.dataset.cardId);
});

render();
