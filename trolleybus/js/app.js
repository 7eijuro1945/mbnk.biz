const LABELS = {
  trolleybus: "Тролейбус",
  tram: "Трамвай",
};

const DEFAULTS = {
  trolleybus: "009",
  tram: "001",
};

const TICKET = {
  count: 1,
  quotes: [
    "— залишайтеся людьми і кричіть, що ви живі. Я живий!",
    "Життя — цікаве",
  ],
  validMs: 60 * 60 * 1000,
};

const monthNames = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

function formatPurchased(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `Придбано ${date.getDate()} ${monthNames[date.getMonth()]} о ${hours}:${minutes}`;
}

function formatRemain(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

function normalizeVehicle(value, fallback) {
  const digits = digitsOnly(value);
  if (!digits) return fallback;
  return digits.padStart(Math.max(3, digits.length), "0");
}

function vehicleKey(kind) {
  return `vehicle-${kind}`;
}

function sessionKey(kind) {
  return `ticket-session-${kind}`;
}

function readVehicle(kind) {
  return normalizeVehicle(localStorage.getItem(vehicleKey(kind)), DEFAULTS[kind]);
}

function writeVehicle(kind, value) {
  const next = normalizeVehicle(value, DEFAULTS[kind]);
  localStorage.setItem(vehicleKey(kind), next);
  return next;
}

function randomTicketNumber() {
  const n = Math.floor(100000 + Math.random() * 900000);
  const s = String(n);
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}

function readSession(kind) {
  try {
    const raw = localStorage.getItem(sessionKey(kind));
    if (!raw) return null;
    const data = JSON.parse(raw);
    const purchasedAt = Number(data.purchasedAt);
    const expiresAt = Number(data.expiresAt);
    const number = typeof data.number === "string" && data.number.trim()
      ? data.number.trim()
      : null;
    if (!purchasedAt || !expiresAt || !number) return null;
    return { purchasedAt, expiresAt, number };
  } catch {
    return null;
  }
}

function writeSession(kind, session) {
  localStorage.setItem(sessionKey(kind), JSON.stringify(session));
}

function createSession() {
  const purchasedAt = Date.now();
  return {
    purchasedAt,
    expiresAt: purchasedAt + TICKET.validMs,
    number: randomTicketNumber(),
  };
}

function getSession(kind) {
  const saved = readSession(kind);
  if (saved) return saved;
  const session = createSession();
  writeSession(kind, session);
  return session;
}

function init() {
  const kind = LABELS[document.body.dataset.kind]
    ? document.body.dataset.kind
    : "trolleybus";
  const label = LABELS[kind];

  let session = getSession(kind);
  let tickTimer = null;

  const quoteParts = TICKET.quotes
    .map((text) => `<span>${text}</span>`)
    .join('<span class="quote-sep">◆</span>');
  document.getElementById("quote").innerHTML = `${quoteParts}<span class="quote-sep">◆</span>${quoteParts}`;
  document.getElementById("transport").textContent = label;
  document.getElementById("amount").textContent = `${TICKET.count} квиток`;
  document.getElementById("transport-label").textContent = label;

  const purchasedEl = document.getElementById("purchased");
  const numberEl = document.getElementById("number");
  const timer = document.getElementById("timer");
  const status = document.getElementById("status");
  const statusText = document.getElementById("status-text");
  const ticketView = document.getElementById("ticket-view");
  const detailsView = document.getElementById("details");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const vehicleInput = document.getElementById("vehicle-input");

  const setTheme = (color) => {
    themeMeta?.setAttribute("content", color);
  };

  const renderTicket = () => {
    purchasedEl.textContent = formatPurchased(new Date(session.purchasedAt));
    numberEl.innerHTML = `Номер: <strong>${session.number}</strong>`;
    vehicleInput.value = readVehicle(kind);
    document.body.classList.remove("is-expired");
    status.classList.remove("is-expired");
  };

  const stopTick = () => {
    if (tickTimer != null) {
      clearTimeout(tickTimer);
      tickTimer = null;
    }
  };

  const tick = () => {
    stopTick();
    const remain = session.expiresAt - Date.now();
    if (remain <= 0) {
      document.body.classList.add("is-expired");
      status.classList.add("is-expired");
      statusText.textContent = "😔  Квиток недійсний";
      timer.textContent = "";
      return;
    }
    statusText.textContent = "Квиток дійсний — ";
    timer.textContent = formatRemain(remain);
    tickTimer = setTimeout(tick, 250);
  };

  const renewTicket = () => {
    session = createSession();
    writeSession(kind, session);
    renderTicket();
    tick();
  };

  const showTicket = () => {
    detailsView.hidden = true;
    ticketView.hidden = false;
    document.body.classList.remove("is-details");
    syncThemeColor();
  };

  const openDetails = () => {
    ticketView.hidden = true;
    detailsView.hidden = false;
    document.body.classList.add("is-details");
    syncThemeColor();
  };

  const syncThemeColor = () => {
    const styles = getComputedStyle(document.documentElement);
    const color = styles.getPropertyValue("--theme-color").trim() || "#f2f3f5";
    setTheme(color);
  };

  syncThemeColor();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeColor);

  renderTicket();
  tick();

  vehicleInput.addEventListener("input", () => {
    vehicleInput.value = digitsOnly(vehicleInput.value);
  });

  vehicleInput.addEventListener("blur", () => {
    const prev = readVehicle(kind);
    const next = writeVehicle(kind, vehicleInput.value);
    vehicleInput.value = next;
    if (next !== prev) renewTicket();
  });

  vehicleInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      vehicleInput.blur();
    }
  });

  document.getElementById("info-btn").addEventListener("click", openDetails);
  document.getElementById("details-back").addEventListener("click", showTicket);
}

init();
