console.log("🚀 Script.js geladen!");

const SUPABASE_URL = "https://adihhabiskdtdwjkfwbv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkaWhoYWJpc2tkdGR3amtmd2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjQ0MzMsImV4cCI6MjA4NzU0MDQzM30.ArjrIAnxOoWJLLE1HvNsQ9VeuoIOmDA03e587JrZOPI";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const LOGIN_PAGE = "login.html";
const isLoginPage = window.location.pathname.toLowerCase().endsWith(`/${LOGIN_PAGE}`) || window.location.pathname.toLowerCase().endsWith(LOGIN_PAGE);

let bartender = "";
let currentUser = null;

let resetTimer = null;

let historyFilter = "all";

function getNextPageFromUrl() {
  const nextFromQuery = new URLSearchParams(window.location.search).get("next");
  if (!nextFromQuery) return "index.html";

  if (nextFromQuery.includes("://") || nextFromQuery.startsWith("//")) {
    return "index.html";
  }

  return nextFromQuery;
}

function getBartenderNameFromUser(user) {
  const email = (user?.email || "").trim().toLowerCase();
  const username = email.split("@")[0];
  return username || "Barkeeper";
}

function applyAuthenticatedUser(user) {
  currentUser = user;
  bartender = getBartenderNameFromUser(user);
  historyFilter = bartender;
  localStorage.setItem("bartender", bartender);
}

function redirectToLogin() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const next = encodeURIComponent(currentPage);
  window.location.href = `${LOGIN_PAGE}?next=${next}`;
}

async function ensureAuthenticatedPage() {
  if (isLoginPage) return;

  const { data } = await supabaseClient.auth.getSession();
  const session = data?.session;

  if (!session?.user) {
    redirectToLogin();
    return;
  }

  applyAuthenticatedUser(session.user);
}

const USERNAME_DOMAIN = "drinq.local";

function usernameToEmail(username) {
  const clean = username.toLowerCase().trim();
  return clean.includes("@") ? clean : `${clean}@${USERNAME_DOMAIN}`;
}

function parseQrCredentials(rawText) {
  if (!rawText) return null;

  const trimmed = rawText.trim();

  // Format 1: URL mit ?u= und ?p= (nativer Kamerascan)
  try {
    const url = new URL(trimmed);
    const u = url.searchParams.get("u");
    const p = url.searchParams.get("p");
    if (u && p) {
      return { username: u.trim(), password: p.trim() };
    }
  } catch (_) {
    // keine gültige URL, weiter
  }

  // Format 2: gnlogin:benutzername|passwort (In-App-Kamera)
  if (trimmed.startsWith("gnlogin:")) {
    const payload = trimmed.slice("gnlogin:".length);
    const [username, password] = payload.split("|");
    if (username && password) {
      return { username: username.trim(), password: password.trim() };
    }
  }

  return null;
}


function generateId() {
  return Math.random().toString(36).slice(2);
}

const drinks = [
  //Biere
  { id: "helles", name: "Helles", volume: "0,5 l", price: 5.00, deposit: 1.00, category: "bier" },
  { id: "pils", name: "Pils", volume: "0,3 l", price: 4.50, deposit: 1.00, category: "bier" },
  { id: "alkfrei_bier", name: "Schattenhofer Alkoholfrei", volume: "0,5 l", price: 5.00, deposit: 1.00, category: "bier" },
  { id: "weizen", name: "Gutmann Weizen", volume: "0,5 l", price: 5.00, deposit: 1.00, category: "bier" },
  { id: "radler", name: "Radler", volume: "0,5 l", price: 5.00, deposit: 1.00, category: "bier" },
  { id: "desperados", name: "Desperados", volume: "0,33 l", price: 7.00, deposit: 1.00, category: "bier" },

  //Longdrinks / Cocktails
  { id: "vodka_rb", name: "Vodka & Red Bull", volume: "0,4 l", price: 9.00, deposit: 1.00, category: "longdrink" },
  { id: "vodka_lemon", name: "Vodka Lemon", volume: "0,4 l", price: 9.00, deposit: 1.00, category: "longdrink" },
  { id: "cuba", name: "Cuba Libre", volume: "0,4 l", price: 9.00, deposit: 1.00, category: "longdrink" },
  { id: "gin_tonic", name: "Gin Tonic", volume: "0,4 l", price: 9.00, deposit: 1.00, category: "longdrink" },
  { id: "prosecco", name: "Prosecco auf Eis", volume: "0,4 l", price: 6.00, deposit: 1.00, category: "longdrink" },
  { id: "weinschorle", name: "Weißweinschorle", volume: "0,3 l", price: 6.00, deposit: 1.00, category: "longdrink" },
  { id: "aperol", name: "Aperol Spritz", volume: "0,4 l", price: 8.00, deposit: 1.00, category: "longdrink" },

  //Shots (kein Pfand)
  { id: "shot_vodka", name: "Vodka", volume: "0,02 l", price: 3.00, deposit: 0.00, category: "shot" },
  { id: "shot_jaeger", name: "Jägermeister", volume: "0,02 l", price: 3.00, deposit: 0.00, category: "shot" },
  { id: "shot_berlinerluft", name: "Berliner Luft", volume: "0,02 l", price: 3.00, deposit: 0.00, category: "shot" },
  { id: "shot_ficken", name: "Ficken", volume: "0,02 l", price: 3.00, deposit: 0.00, category: "shot" },
  { id: "shot_vodka_grün", name: "Grüner Vodka", volume: "0,02 l", price: 3.00, deposit: 0.00, category: "shot" },

  //Alkoholfrei
  { id: "wasser_s", name: "Wasser spritzig", volume: "0,4 l", price: 4.00, deposit: 1.00, category: "soft" },
  { id: "wasser_still", name: "Wasser still", volume: "0,4 l", price: 4.00, deposit: 1.00, category: "soft" },
  { id: "cola", name: "Coca-Cola", volume: "0,4 l", price: 4.00, deposit: 1.00, category: "soft" },
  { id: "cola_zero", name: "Coca-Cola Zero", volume: "0,4 l", price: 4.00, deposit: 1.00, category: "soft" },
  { id: "spezi", name: "Spezi", volume: "0,4 l", price: 4.00, deposit: 1.00, category: "soft" },
  { id: "apfel", name: "Apfelsaftschorle", volume: "0,4 l", price: 4.00, deposit: 1.00, category: "soft" },
  { id: "redbull", name: "Red Bull Dose", volume: "0,25 l", price: 5.00, deposit: 1.00, category: "soft" }
];

const DEPOSIT_ITEM = {
  id: "deposit",
  name: "Pfand",
  price: 1.00,
  deposit: 0,
  qty: 1
};

const DEPOSIT_RETURN_ITEM = {
  id: "deposit_return",
  name: "Pfand Rückgabe",
  price: -1.00,
  deposit: 0,
  qty: 1
};

function getCaseSizeByVolume(volume) {
  if (volume === "0,5 l" || volume === "0,4 l") {
    return 20;
  }

  if (volume === "0,33 l" || volume === "0,3 l") {
    return 24;
  }

  return null;
}

function isBottledDrink(category) {
  // Only beer and soft drinks (non-alcoholic) come in crates
  return category === "bier" || category === "soft";
}

function getCaseCount(qty, caseSize, category) {
  if (!isBottledDrink(category) || !caseSize || qty <= 0) {
    return null;
  }

  // Calculate decimal number of crates
  return Math.round((qty / caseSize) * 100) / 100;
}


let currentOrder = [];
let allOrders = [];

const grid = document.getElementById("drink-grid");

/*function loadData() {
  const saved = localStorage.getItem("allOrders");
  if (saved) {
    allOrders = JSON.parse(saved);
  }
}

loadData();
*/

if (document.getElementById("drink-grid")) {
  renderDrinks();
}

if (document.getElementById("history")) {
  updateHistory();
}

function renderDrinks(category = "all") {
  if (!grid) return;

  grid.innerHTML = "";
  const filtered = category === "all"
    ? drinks
    : drinks.filter(d => d.category === category);
  filtered.forEach(drink => {
 const div = document.createElement("div");
div.className = "drink-card";

div.innerHTML = `
  <div class="drink-name">${drink.name}</div>
  <div class="drink-bottom">
    <span class="drink-volume">${drink.volume}</span>
    <span class="drink-price">${drink.price.toFixed(2)} €</span>
  </div>
`;
    div.onclick = () => addDrink(drink);
    grid.appendChild(div);
  });
}

function showCategory(event, cat) {
  renderDrinks(cat);

  document.querySelectorAll(".category").forEach(el => {
    el.classList.remove("active");

    const img = el.querySelector("img");
    if (img && el.dataset.icon) {
      img.src = el.dataset.icon;
    }
  });

const selected = event.currentTarget;
if (!selected) return;

selected.classList.add("active");

  const img = selected.querySelector("img");
  if (img && selected.dataset.iconActive) {
    img.src = selected.dataset.iconActive;
  }
}

document.addEventListener("DOMContentLoaded", () => {

  const firstCategory = document.querySelector(".category")

  if (firstCategory) {
    showCategory({ currentTarget: firstCategory }, "all")
  }

  // Price modal handlers
  const currentTotalEl = document.getElementById("current-total");
  const mobileTotalEl = document.getElementById("mobile-total");
  const priceModal = document.getElementById("price-modal");

  if (priceModal) {
    const openPriceModal = () => {
      priceModal.style.display = "flex";
    };

    if (currentTotalEl) {
      currentTotalEl.addEventListener("click", openPriceModal);
    }

    if (mobileTotalEl) {
      mobileTotalEl.addEventListener("click", openPriceModal);
    }

    priceModal.addEventListener("click", (e) => {
      if (e.target === priceModal) {
        priceModal.style.display = "none";
      }
    });
  }

  const orderPanel = document.getElementById("order-panel");
  const orderToggle = document.getElementById("order-toggle");
  const orderBackdrop = document.getElementById("order-backdrop");

  if (orderPanel && orderToggle && orderBackdrop) {
    const isMobile = () => window.innerWidth <= 900;

    const closeDrawer = () => {
      orderPanel.classList.remove("open");
      orderBackdrop.classList.remove("active");
      orderToggle.textContent = "Bestellung";
    };

    const openDrawer = () => {
      orderPanel.classList.add("open");
      orderBackdrop.classList.add("active");
      orderToggle.textContent = "Schliessen";
    };

    orderToggle.addEventListener("click", () => {
      if (!isMobile()) return;

      if (orderPanel.classList.contains("open")) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    orderBackdrop.addEventListener("click", closeDrawer);

    window.addEventListener("resize", () => {
      if (!isMobile()) {
        closeDrawer();
      }
    });

    closeDrawer();
  }

});

function addDrink(drink) {
  const existing = currentOrder.find(o => o.id === drink.id);
  if (existing) {
    existing.qty++;
  } else {
    currentOrder.push({
      id: drink.id,
      name: drink.name,
      price: drink.price,
      deposit: drink.deposit,
      qty: 1
    });
  }
  syncDeposit();
  updateCurrentOrder();
}

function addDeposit() {

  let deposit = currentOrder.find(i => i.id === "deposit")

  if (deposit) {
    deposit.qty += 1
  } else {
    currentOrder.push({
      id: "deposit",
      name: "Pfand",
      price: 1,
      qty: 1
    })
  }

  updateCurrentOrder()
}

function updateCurrentOrder() {
  const list = document.getElementById("current-order");
  if (!list) return;

  list.innerHTML = "";

  // Calculate net deposit amount (deposit - returns)
  const depositQty = currentOrder
    .filter(o => o.id === "deposit")
    .reduce((sum, o) => sum + o.qty, 0);

  const depositReturnQty = currentOrder
    .filter(o => o.id === "deposit_return")
    .reduce((sum, o) => sum + o.qty, 0);

  const netDeposit = depositQty - depositReturnQty;

  // Filter out deposit/deposit_return items and sort remaining items
  const displayOrder = currentOrder
    .filter(o => o.id !== "deposit" && o.id !== "deposit_return");

  displayOrder.forEach(o => {
    const row = document.createElement("div");
    row.className = "order-row";

    const name = document.createElement("div");
    name.textContent = o.name;

    const qtyBox = document.createElement("div");
    qtyBox.className = "qty-controls";

    const minus = document.createElement("button");
    minus.className = "qty-btn";
    minus.textContent = "−";

    const qty = document.createElement("span");
    qty.textContent = o.qty + "x";
    qty.style.fontWeight = "600";

    const plus = document.createElement("button");
    plus.className = "qty-btn";
    plus.textContent = "+";

    minus.onclick = () => {
      o.qty--;
      if (o.qty <= 0) {
        currentOrder = currentOrder.filter(x => x.id !== o.id);
      }
      syncDeposit();
      updateCurrentOrder();
    };

    plus.onclick = () => {
      o.qty++;
      syncDeposit();
      updateCurrentOrder();
    };

    qtyBox.appendChild(minus);
    qtyBox.appendChild(qty);
    qtyBox.appendChild(plus);

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = (o.qty * o.price).toFixed(2) + "€";

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.innerHTML = `<img src="images/deleteblue.png">`;

    del.onclick = () => {
      currentOrder = currentOrder.filter(x => x.id !== o.id);
      syncDeposit();
      updateCurrentOrder();
    };

    row.appendChild(name);
    row.appendChild(qtyBox);
    row.appendChild(price);
    row.appendChild(del);

    list.appendChild(row);
  });

  // Add net deposit row if there's any deposit
  if (netDeposit !== 0) {
    const depositRow = document.createElement("div");
    depositRow.className = "order-row";
    depositRow.style.fontWeight = "700";

    const depositName = document.createElement("div");
    depositName.textContent = "Pfand";

    const depositQtyBox = document.createElement("div");
    depositQtyBox.className = "qty-controls";

    const depositMinus = document.createElement("button");
    depositMinus.className = "qty-btn";
    depositMinus.textContent = "−";

    const depositQtySpan = document.createElement("span");
    depositQtySpan.textContent = netDeposit + "x";
    depositQtySpan.style.fontWeight = "600";

    const depositPlus = document.createElement("button");
    depositPlus.className = "qty-btn";
    depositPlus.textContent = "+";

    depositMinus.onclick = () => {
      addDepositReturn();
    };

    depositPlus.onclick = () => {
      addDeposit();
    };

    depositQtyBox.appendChild(depositMinus);
    depositQtyBox.appendChild(depositQtySpan);
    depositQtyBox.appendChild(depositPlus);

    const depositPrice = document.createElement("div");
    depositPrice.className = "price";
    depositPrice.textContent = (netDeposit * 1.0).toFixed(2) + "€";

    const depositDel = document.createElement("button");
    depositDel.className = "delete-btn";
    depositDel.innerHTML = `<img src="images/deleteblue.png">`;

    depositDel.onclick = () => {
      currentOrder = currentOrder.filter(x => x.id !== "deposit" && x.id !== "deposit_return");
      updateCurrentOrder();
    };

    depositRow.appendChild(depositName);
    depositRow.appendChild(depositQtyBox);
    depositRow.appendChild(depositPrice);
    depositRow.appendChild(depositDel);

    list.appendChild(depositRow);
  }

  const total = currentOrder.reduce(
    (sum, o) => sum + o.qty * o.price,
    0
  );

  const totalText = total.toFixed(2) + "€";
  const totalEl = document.getElementById("current-total");
  const modalPriceEl = document.getElementById("modal-price");
  const mobileTotalEl = document.getElementById("mobile-total");

  if (totalEl) {
    totalEl.textContent = totalText;
  }

  if (modalPriceEl) {
    modalPriceEl.textContent = totalText;
  }

  if (mobileTotalEl) {
    mobileTotalEl.textContent = totalText;
  }
}

async function finishOrder() {
  if (currentOrder.length === 0) return;

  const total = currentOrder.reduce(
    (sum, o) => sum + o.qty * o.price,
    0
  );

  const orderData = {
    bartender: bartender,
    items: currentOrder,
    total: total,
    created_at: new Date()
  };

  try {
    const { error } = await supabaseClient
      .from("orders")
      .insert([orderData]);

    if (error) throw error;

  } catch (err) {
    console.log("Offline gespeichert");

    let offlineOrders =
      JSON.parse(localStorage.getItem("offlineOrders")) || [];

    offlineOrders.push(orderData);
    localStorage.setItem(
      "offlineOrders",
      JSON.stringify(offlineOrders)
    );
  }

  currentOrder = [];
  updateCurrentOrder();
  loadOrdersFromServer();
}

let logoDataUrlCache = null;

async function getLogoDataUrl() {
  if (logoDataUrlCache) return logoDataUrlCache;

  const img = new Image();
  img.src = "images/logo.png";

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 256;
  canvas.height = img.naturalHeight || 256;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas-Kontext nicht verfügbar");
  }

  ctx.drawImage(img, 0, 0);
  logoDataUrlCache = canvas.toDataURL("image/png");
  return logoDataUrlCache;
}

async function downloadPDF(){
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF-Bibliothek nicht geladen.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const rowHeight = 7;
  let y = 18;

  const fmt = (num) => `${num.toFixed(2)} EUR`;

  const drinkStats = {};

  drinks.forEach(d => {
    drinkStats[d.name] = {
      qty: 0,
      price: d.price,
      volume: d.volume,
      category: d.category
    };
  });

  allOrders.forEach(order => {
    order.items.forEach(item => {
      if (!drinkStats[item.name]) {
        drinkStats[item.name] = {
          qty: 0,
          price: item.price,
          volume: null,
          category: null
        };
      }

      drinkStats[item.name].qty += item.qty;
    });
  });

  const rows = Object.entries(drinkStats)
    .map(([name, data]) => {
      const qty = data.qty;
      const price = data.price;
      const total = qty * price;
      const caseSize = getCaseSizeByVolume(data.volume);
      const cases = getCaseCount(qty, caseSize, data.category);
      return { name, qty, price, total, cases };
    })
    .filter(r => r.qty > 0)
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, "de"));

  let totalCash = 0;
  rows.forEach(r => {
    if (r.name !== "Pfand") {
      totalCash += r.total;
    }
  });

  doc.setFillColor(67, 87, 173);
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);

  let titleX = margin;
  try {
    const logoDataUrl = await getLogoDataUrl();
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin - 1, 3, 24, 18, 2, 2, "F");
    doc.addImage(logoDataUrl, "PNG", margin, 4, 22, 16);
    titleX = margin + 28;
  } catch (error) {
    console.warn("Logo konnte im PDF nicht geladen werden.", error);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Kassenabrechnung", titleX, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString("de-DE"), pageWidth - margin, 14, { align: "right" });

  y = 30;

  const col = {
    name: margin,
    qty: margin + 92,
    cases: margin + 114,
    unit: margin + 138,
    total: pageWidth - margin
  };

  const drawTableHeader = () => {
    doc.setFillColor(201, 168, 115);
    doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
    doc.setTextColor(67, 87, 173);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Getraenk", col.name + 1, y);
    doc.text("Stueck", col.qty, y, { align: "right" });
    doc.text("Kaesten", col.cases, y, { align: "right" });
    doc.text("Einzelpreis", col.unit, y, { align: "right" });
    doc.text("Gesamt", col.total, y, { align: "right" });
    y += rowHeight + 1;
  };

  drawTableHeader();

  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);

  rows.forEach((row, index) => {
    if (y > pageHeight - 25) {
      doc.addPage();
      y = 18;
      drawTableHeader();
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
    }

    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y - 5, pageWidth - margin * 2, rowHeight, "F");
    }

    doc.text(row.name, col.name + 1, y);
    doc.text(String(row.qty), col.qty, y, { align: "right" });
    doc.text(row.cases === null ? "-" : row.cases.toFixed(2), col.cases, y, { align: "right" });
    doc.text(fmt(row.price), col.unit, y, { align: "right" });
    doc.text(fmt(row.total), col.total, y, { align: "right" });

    y += rowHeight;
  });

  y += 4;
  if (y > pageHeight - 22) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(72, 169, 166);
  doc.rect(pageWidth - 90, y - 5, 76, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Barumsatz: ${fmt(totalCash)}`, pageWidth - 16, y + 1.5, { align: "right" });

  doc.save("kassenabrechnung.pdf");
}

function updateStats() {

  const statsEl = document.getElementById("stats");
  if (!statsEl) return;

  const drinkStats = {};

  // alle drinks initialisieren (auch 0 Verkäufe)
  drinks.forEach(d => {
    drinkStats[d.name] = {
      qty: 0,
      price: d.price,
      volume: d.volume,
      category: d.category
    };
  });

  // Verkäufe addieren
  allOrders.forEach(order => {
    order.items.forEach(item => {

      if (!drinkStats[item.name]) {
        drinkStats[item.name] = {
          qty: 0,
          price: item.price,
          volume: null,
          category: null
        };
      }

      drinkStats[item.name].qty += item.qty;
    });
  });

  let totalCash = 0;

  let html = `
  <div class="stats-wrapper">
  <div class="stats-card">

    <div class="stats-header">
      <div>Getränk</div>
      <div>Stück</div>
      <div>Kästen</div>
      <div>Preis</div>
      <div>Gesamtpreis</div>
    </div>
  `;

  let pfandRow = "";

  Object.entries(drinkStats).forEach(([name,data]) => {

    const qty = data.qty;
    const price = data.price;
    const total = qty * price;
    const caseSize = getCaseSizeByVolume(data.volume);
    const cases = getCaseCount(qty, caseSize, data.category);
    const casesLabel = cases === null ? "-" : cases.toFixed(2);

    if (name === "Pfand") {
      pfandRow = `
        <div class="stat-row">
          <div>${name}</div>
          <div>${qty}</div>
          <div>${casesLabel}</div>
          <div>${price.toFixed(2)}€</div>
          <div>${total.toFixed(2)}€</div>
        </div>
      `;
      return;
    }

    totalCash += total;

    html += `
      <div class="stat-row">
        <div>${name}</div>
        <div>${qty}</div>
        <div>${casesLabel}</div>
        <div>${price.toFixed(2)}€</div>
        <div>${total.toFixed(2)}€</div>
      </div>
    `;
  });

  html += pfandRow;

  html += `
    <div class="stats-total">
      <span>Gesamt Barumsatz</span>
      <span>${totalCash.toFixed(2)}€</span>
    </div>
  </div>
  </div>
  `;

  statsEl.innerHTML = html;
}

function updateHistory() {

  const history = document.getElementById("history");
  if (!history) return;

  history.innerHTML = "";

  const filteredOrders =
    historyFilter === "all"
      ? allOrders
      : allOrders.filter(o => o.bartender === historyFilter);

  filteredOrders.forEach(order => {

    const card = document.createElement("div");
    card.className = "history-card";

    const content = document.createElement("div");
    content.className = "history-items";

    let html = `
<div class="history-bartender">${order.bartender}</div>
<div class="history-time">${order.time}</div>
`;

    let total = 0;

    order.items.forEach(item => {

      const lineTotal = item.price * item.qty;
      total += lineTotal;

      html += `
        <div>
          ${item.name} x ${item.qty}
          <span>${lineTotal.toFixed(2)}€</span>
        </div>
      `;
    });

    html += `<div class="history-total">Summe: ${total.toFixed(2)}€</div>`;

    content.innerHTML = html;

    const del = document.createElement("div");
    del.className = "history-delete";

    del.innerHTML = `<img src="images/deleteblue.png">`;

    del.onclick = async () => {

      if (!confirm("Bestellung wirklich stornieren?")) return;

      const { error } = await supabaseClient
        .from("orders")
        .delete()
        .eq("id", order.id);

      if (error) {
        alert("Fehler beim Stornieren");
        return;
      }

      loadOrdersFromServer();
    };

    card.appendChild(content);
    card.appendChild(del);

    history.appendChild(card);

  });
}

function renderStats(stats, grandTotal) {
  const box = document.getElementById("stats");
  if (!box) return;   // <-- WICHTIG

  box.innerHTML = "";

  for (let name in stats) {
    const row = document.createElement("div");
    row.textContent =
      `${name} – ${stats[name].count} Stück – ${stats[name].total.toFixed(2)} €`;
    box.appendChild(row);
  }

  const totalRow = document.createElement("h3");
  totalRow.textContent = "Gesamtumsatz: " + grandTotal.toFixed(2) + " €";
  box.appendChild(totalRow);
}

function saveData() {
  localStorage.setItem("allOrders", JSON.stringify(allOrders));
}

function resetShift() {
  if (!confirm("Schicht wirklich zurücksetzen?")) return;

  allOrders = [];
  currentOrder = [];
 localStorage.removeItem("offlineOrders")
localStorage.removeItem("bartender")

  updateCurrentOrder();
  updateStats();
  updateHistory();
}

function addDepositReturn() {
  let depositReturn = currentOrder.find(i => i.id === "deposit_return");

  if (depositReturn) {
    depositReturn.qty += 1;
  } else {
    currentOrder.push({
      id: "deposit_return",
      name: "Pfand Rückgabe",
      price: -1.00,
      deposit: 0,
      qty: 1
    });
  }

  updateCurrentOrder();
}

function syncDeposit() {
  const depositCount = currentOrder
    .filter(o => o.deposit > 0)
    .reduce((sum, o) => sum + o.qty, 0);

  const existing = currentOrder.find(o => o.id === "deposit");

  if (depositCount === 0) {
    currentOrder = currentOrder.filter(o => o.id !== "deposit");
    return;
  }

  if (existing) {
    existing.qty = depositCount;
  } else {
    currentOrder.push({
      id: "deposit",
      name: "Pfand",
      price: 1,
      deposit: 0,
      qty: depositCount
    });
  }
}

if (!isLoginPage) {
  supabaseClient
    .channel("orders-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => {
        loadOrdersFromServer();
      }
    )
    .subscribe();
}

async function loadOrdersFromServer() {
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  allOrders = data.map(o => ({
  id: o.id,
  bartender: o.bartender,
  time: new Date(o.created_at).toLocaleTimeString(),
  items: o.items
}));

  updateHistory();
  updateStats();
  renderBartenderTabs();
}

async function syncOfflineOrders() {
  let offlineOrders =
    JSON.parse(localStorage.getItem("offlineOrders")) || [];

  if (offlineOrders.length === 0) return;

  for (const order of offlineOrders) {
    await supabaseClient.from("orders").insert([order]);
  }

  localStorage.removeItem("offlineOrders");
  loadOrdersFromServer();
}

async function initLoginPage() {
  const loginForm = document.getElementById("login-form");
  const loginUsername = document.getElementById("login-username");
  const loginPassword = document.getElementById("login-password");
  const togglePasswordBtn = document.getElementById("toggle-password");
  const passwordEyeIcon = document.getElementById("password-eye-icon");
  const loginStatus = document.getElementById("login-status");
  const scanQrBtn = document.getElementById("scan-qr-btn");
  const qrVideo = document.getElementById("qr-video");
  const manualToggle = document.getElementById("manual-toggle");

  if (!loginForm || !loginUsername || !loginPassword) {
    return;
  }

  // Auto-Login per URL-Parameter (nativer QR-Scan mit Kamera-App)
  const urlParams = new URLSearchParams(window.location.search);
  const autoUser = urlParams.get("u");
  const autoPass = urlParams.get("p");

  if (autoUser && autoPass) {
    if (loginStatus) {
      loginStatus.textContent = "Anmeldung läuft...";
    }

    // Parameter sofort aus URL entfernen
    const cleanUrl = window.location.pathname;
    history.replaceState(null, "", cleanUrl);

    const { data: autoData, error: autoError } = await supabaseClient.auth.signInWithPassword({
      email: usernameToEmail(autoUser),
      password: autoPass
    });

    if (!autoError && autoData?.user) {
      applyAuthenticatedUser(autoData.user);
      window.location.href = "index.html";
      return;
    }

    if (loginStatus) {
      loginStatus.textContent = "Automatischer Login fehlgeschlagen. Bitte manuell anmelden.";
      loginStatus.classList.add("error");
    }
  }

  const { data } = await supabaseClient.auth.getSession();
  if (data?.session?.user) {
    const nextPage = getNextPageFromUrl();
    window.location.href = nextPage;
    return;
  }

  let qrStream = null;
  let qrScanInterval = null;
  let manualOpen = false;

  const setStatus = (text, isError = false) => {
    if (!loginStatus) return;
    loginStatus.textContent = text;
    loginStatus.classList.toggle("error", isError);
  };

  const stopQrScanner = () => {
    if (qrScanInterval) {
      clearInterval(qrScanInterval);
      qrScanInterval = null;
    }
    if (qrStream) {
      qrStream.getTracks().forEach(track => track.stop());
      qrStream = null;
    }
    if (qrVideo) {
      qrVideo.srcObject = null;
      qrVideo.classList.remove("active");
    }
    if (scanQrBtn) {
      scanQrBtn.textContent = "QR-Code scannen";
    }
  };

  const tryQrLogin = async (rawText) => {
    const creds = parseQrCredentials(rawText);
    if (!creds) {
      setStatus("QR-Code ungültig. Erwartet wird gnlogin:benutzername|passwort", true);
      return;
    }

    setStatus("QR erkannt, Anmeldung läuft...");
    const email = usernameToEmail(creds.username);

    const { data: signInData, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password: creds.password
    });

    if (error || !signInData?.user) {
      setStatus("Login fehlgeschlagen. Bitte QR neu scannen.", true);
      return;
    }

    applyAuthenticatedUser(signInData.user);

    stopQrScanner();
    const nextPage = getNextPageFromUrl();
    window.location.href = nextPage;
  };

  if (manualToggle) {
    manualToggle.addEventListener("click", () => {
      manualOpen = !manualOpen;
      loginForm.classList.toggle("login-form--collapsed", !manualOpen);
      manualToggle.textContent = manualOpen ? "Manuell anmelden \u25b4" : "Manuell anmelden \u25be";
    });
  }

  if (togglePasswordBtn && loginPassword) {
    togglePasswordBtn.addEventListener("click", () => {
      const isHidden = loginPassword.type === "password";
      loginPassword.type = isHidden ? "text" : "password";

      if (passwordEyeIcon) {
        passwordEyeIcon.src = isHidden ? "images/eyeactive.png" : "images/eyeinactive.png";
      }

      togglePasswordBtn.setAttribute("aria-label", isHidden ? "Passwort verbergen" : "Passwort anzeigen");
    });
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Anmeldung läuft...");
    const email = usernameToEmail(loginUsername.value.trim());

    const { data: signInData, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password: loginPassword.value
    });

    if (error || !signInData?.user) {
      setStatus("Login fehlgeschlagen. Benutzername oder Passwort falsch.", true);
      return;
    }

    applyAuthenticatedUser(signInData.user);

    const nextPage = getNextPageFromUrl();
    window.location.href = nextPage;
  });

  if (scanQrBtn && qrVideo) {
    scanQrBtn.addEventListener("click", async () => {
      if (qrStream) {
        stopQrScanner();
        setStatus("");
        return;
      }

      if (!window.BarcodeDetector) {
        setStatus("Dein Browser unterstützt QR-Kamera leider nicht. Bitte manuell anmelden.", true);
        return;
      }

      try {
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        qrStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });

        qrVideo.srcObject = qrStream;
        qrVideo.classList.add("active");
        await qrVideo.play();
        scanQrBtn.textContent = "Kamera stoppen";
        setStatus("Kamera aktiv – QR-Code vor die Kamera halten.");

        qrScanInterval = setInterval(async () => {
          if (!qrVideo.videoWidth) return;
          const barcodes = await detector.detect(qrVideo);
          if (!barcodes.length) return;
          const rawValue = barcodes[0]?.rawValue;
          if (!rawValue) return;
          stopQrScanner();
          await tryQrLogin(rawValue);
        }, 350);
      } catch (err) {
        stopQrScanner();
        setStatus("Kamera konnte nicht gestartet werden.", true);
      }
    });
  }
}

async function initApp() {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (isLoginPage) return;
    if (event === "SIGNED_OUT" || !session) {
      redirectToLogin();
    }
  });

  if (isLoginPage) {
    await initLoginPage();
    return;
  }

  await ensureAuthenticatedPage();
  if (!currentUser) return;

  loadOrdersFromServer();
  window.addEventListener("online", syncOfflineOrders);
  syncOfflineOrders();
}

initApp();

async function resetSystem() {

  const { error } = await supabaseClient
    .from("orders")
    .delete()
    .not("id","is",null);

  if (error) {
    console.error("Reset Fehler:", error);
    alert("Fehler beim Zurücksetzen");
    return;
  }

  localStorage.removeItem("offlineOrders");
  localStorage.removeItem("bartender");

  location.reload();
}

function cancelReset() {

  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }

  document.getElementById("cancel-reset").style.display = "none";
}

function renderBartenderTabs() {

  const container = document.getElementById("bartender-tabs");
  if (!container) return;

  container.innerHTML = "";

  // Alle anderen Barkeeper außer dem aktuellen (Olivia)
  const otherBartenders = [...new Set(allOrders.map(o => o.bartender))].filter(name => name !== bartender);

  const tabs = [bartender, ...otherBartenders, "Alle"];

  tabs.forEach(name => {

    const tab = document.createElement("div");
    tab.className = "bartender-tab";

    let value = name;

    if (name === "Alle") value = "all";

    tab.textContent = name;

    if (historyFilter === value) {
      tab.classList.add("active");
    }

    tab.onclick = () => {

      if (name === "Alle") {
        historyFilter = "all";
      } else {
        historyFilter = name;
      }

      renderBartenderTabs();
      updateHistory();
    };

    container.appendChild(tab);
  });
}

const resetBtn = document.getElementById("reset-btn");
const resetModal = document.getElementById("reset-modal");
const confirmBtn = document.getElementById("confirm-reset");
const cancelBtn = document.getElementById("cancel-reset");

const RESET_DELAY_SECONDS = 10;

let resetCountdown = null;
let resetSeconds = RESET_DELAY_SECONDS;
let isResetRunning = false;

function updateResetButtonLabel() {
  if (!confirmBtn) return;

  if (isResetRunning) {
    confirmBtn.textContent = `Zurücksetzen (${resetSeconds}s)`;
  } else {
    confirmBtn.textContent = "Zurücksetzen";
  }
}

function stopResetCountdown() {
  if (resetCountdown) {
    clearInterval(resetCountdown);
    resetCountdown = null;
  }

  isResetRunning = false;
  resetSeconds = RESET_DELAY_SECONDS;

  if (confirmBtn) {
    confirmBtn.disabled = false;
  }

  updateResetButtonLabel();
}

if (resetBtn) {
  resetBtn.onclick = () => {
    stopResetCountdown();
    if (resetModal) {
      resetModal.classList.add("active");
    }
  };
}

if (confirmBtn) {
  confirmBtn.onclick = () => {
    if (isResetRunning) return;

    isResetRunning = true;
    resetSeconds = RESET_DELAY_SECONDS;
    confirmBtn.disabled = true;
    updateResetButtonLabel();

    resetCountdown = setInterval(() => {
      resetSeconds--;
      updateResetButtonLabel();

      if (resetSeconds <= 0) {
        clearInterval(resetCountdown);
        resetCountdown = null;
        isResetRunning = false;

        if (resetModal) {
          resetModal.classList.remove("active");
        }

        resetSystem();
      }
    }, 1000);
  };
}

if (cancelBtn) {
  cancelBtn.onclick = () => {
    if (resetModal) {
      resetModal.classList.remove("active");
    }

    stopResetCountdown();
  };
}

updateResetButtonLabel();

// Fullscreen Funktion mit Browser-Kompatibilität
function enterFullscreen(element) {
  console.log("Versuche Fullscreen zu starten auf Element:", element.tagName);
  
  if (element.requestFullscreen) {
    console.log("Nutze standard requestFullscreen");
    return element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    console.log("Nutze webkit requestFullscreen");
    return element.webkitRequestFullscreen();
  } else if (element.mozRequestFullScreen) {
    console.log("Nutze moz RequestFullScreen");
    return element.mozRequestFullScreen();
  } else if (element.msRequestFullscreen) {
    console.log("Nutze ms RequestFullscreen");
    return element.msRequestFullscreen();
  }
  
  const error = "Fullscreen API nicht verfügbar in diesem Browser";
  console.error(error);
  return Promise.reject(new Error(error));
}

function exitFullscreen() {
  console.log("Versuche Fullscreen zu beenden");
  
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    return document.webkitExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    return document.mozCancelFullScreen();
  } else if (document.msExitFullscreen) {
    return document.msExitFullscreen();
  }
  return Promise.reject(new Error("Fullscreen-API nicht verfügbar"));
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || 
           document.mozFullScreenElement || document.msFullscreenElement);
}

function ensureLogoutModal() {
  let modal = document.getElementById("logout-modal");
  if (modal) {
    return {
      modal,
      cancelBtn: modal.querySelector("#cancel-logout"),
      confirmBtn: modal.querySelector("#confirm-logout")
    };
  }

  modal = document.createElement("div");
  modal.id = "logout-modal";
  modal.className = "reset-modal";
  modal.innerHTML = `
    <div class="reset-box">
      <h2>Logout</h2>
      <p>Möchtest du dich wirklich ausloggen?</p>
      <div class="reset-buttons">
        <button id="cancel-logout" class="logout-cancel" type="button">Abbrechen</button>
        <button id="confirm-logout" class="logout-confirm" type="button">Logout</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  return {
    modal,
    cancelBtn: modal.querySelector("#cancel-logout"),
    confirmBtn: modal.querySelector("#confirm-logout")
  };
}

function askLogoutConfirmation() {
  const { modal, cancelBtn, confirmBtn } = ensureLogoutModal();

  return new Promise((resolve) => {
    const close = (confirmed) => {
      modal.classList.remove("active");
      modal.removeEventListener("click", onBackdropClick);
      cancelBtn.removeEventListener("click", onCancel);
      confirmBtn.removeEventListener("click", onConfirm);
      resolve(confirmed);
    };

    const onBackdropClick = (event) => {
      if (event.target === modal) {
        close(false);
      }
    };

    const onCancel = () => close(false);
    const onConfirm = () => close(true);

    modal.addEventListener("click", onBackdropClick);
    cancelBtn.addEventListener("click", onCancel);
    confirmBtn.addEventListener("click", onConfirm);
    modal.classList.add("active");
  });
}

async function logoutUser() {
  const shouldLogout = await askLogoutConfirmation();
  if (!shouldLogout) return;

  await supabaseClient.auth.signOut();
  localStorage.removeItem("bartender");
  window.location.href = LOGIN_PAGE;
}

function ensureTopbarUi() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) {
    return null;
  }

  const legacyNav = topbar.querySelector(".nav");
  if (legacyNav && !legacyNav.classList.contains("topbar-right")) {
    legacyNav.classList.add("topbar-right");
  }

  let rightContainer = topbar.querySelector(".topbar-right");
  if (!rightContainer) {
    rightContainer = document.createElement("div");
    rightContainer.className = "topbar-right";
    topbar.appendChild(rightContainer);
  }

  let fsBtn = document.getElementById("fullscreen-btn");
  if (!fsBtn) {
    fsBtn = document.createElement("button");
    fsBtn.id = "fullscreen-btn";
    fsBtn.type = "button";
    fsBtn.textContent = "⛶";
    rightContainer.appendChild(fsBtn);
    console.log("✓ Vollscreen-Button automatisch hinzugefuegt");
  } else if (fsBtn.parentElement !== rightContainer) {
    rightContainer.appendChild(fsBtn);
  }

  let logoutBtn = document.getElementById("logout-btn");
  if (!logoutBtn && !isLoginPage) {
    logoutBtn = document.createElement("button");
    logoutBtn.id = "logout-btn";
    logoutBtn.type = "button";
    logoutBtn.textContent = "Logout";
    rightContainer.insertBefore(logoutBtn, fsBtn);
  } else if (logoutBtn && logoutBtn.parentElement !== rightContainer) {
    rightContainer.appendChild(logoutBtn);
  }

  if (logoutBtn && fsBtn && logoutBtn.nextElementSibling !== fsBtn) {
    rightContainer.insertBefore(logoutBtn, fsBtn);
  }

  return { fsBtn, logoutBtn };
}

function initFullscreenButton() {
  const ui = ensureTopbarUi();
  const fsBtn = ui?.fsBtn;
  const logoutBtn = ui?.logoutBtn;
  
  if(!fsBtn) {
    console.warn("❌ Vollscreen-Button nicht im DOM gefunden");
    return;
  }

  if (logoutBtn && logoutBtn.dataset.boundLogout !== "true") {
    logoutBtn.dataset.boundLogout = "true";
    logoutBtn.addEventListener("click", () => {
      logoutUser();
    });
  }

  if (fsBtn.dataset.boundFullscreen === "true") {
    return;
  }
  fsBtn.dataset.boundFullscreen = "true";
  
  console.log("✓ Vollscreen-Button gefunden, registriere Handler");
  
  // Click Handler
  fsBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("📱 Fullscreen-Button geklickt");
    console.log("Aktueller Fullscreen-Status:", isFullscreen());
    
    try {
      if(!isFullscreen()) {
        console.log("🔄 Starte Vollbildmodus...");
        await enterFullscreen(document.documentElement);
        fsBtn.style.color = "var(--red)";
        console.log("✅ Vollbildmodus aktiv");
      } else {
        console.log("🔄 Beende Vollbildmodus...");
        await exitFullscreen();
        fsBtn.style.color = "var(--blue)";
        console.log("✅ Vollbildmodus beendet");
      }
    } catch (err) {
      console.error("❌ Vollbildfehler:", err);
      console.error("Fehlertyp:", err.name);
      console.error("Fehler-Nachricht:", err.message);
      
      // Detailliertes Fehler-Debugging
      if (err.name === "NotAllowedError") {
        alert("⚠️ Vollbildmodus wurde vom Browser blockiert.\n\nTipp: Starten Sie den Developer Mode erneut oder versuchen Sie es ohne Console geöffnet.");
      } else if (err.name === "NotSupportedError") {
        alert("⚠️ Ihr Browser unterstützt keinen Vollbildmodus.");
      } else {
        alert("⚠️ Fehler: " + err.message);
      }
    }
  });
  
  // Überwache Vollbild-Änderungen
  ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach(event => {
    document.addEventListener(event, () => {
      console.log("Fullscreen-Status geändert zu:", isFullscreen());
      fsBtn.style.color = isFullscreen() ? "var(--red)" : "var(--blue)";
    });
  });
  
  console.log("✓ Vollscreen-Handler erfolgreich initialisiert");
}

// Initialisierung wenn DOM bereit ist
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFullscreenButton);
  console.log("⏳ Warte auf DOMContentLoaded...");
} else {
  // DOM ist bereits geladen
  initFullscreenButton();
}






