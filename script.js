console.log("🚀 Script.js geladen!");

const SUPABASE_URL = "https://adihhabiskdtdwjkfwbv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkaWhoYWJpc2tkdGR3amtmd2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjQ0MzMsImV4cCI6MjA4NzU0MDQzM30.ArjrIAnxOoWJLLE1HvNsQ9VeuoIOmDA03e587JrZOPI";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let bartender = localStorage.getItem("bartender");

let resetTimer = null;

let historyFilter = bartender;

if (!bartender) {
  bartender = prompt("Name des Barkeepers:");
  localStorage.setItem("bartender", bartender);
}


function generateId() {
  return Math.random().toString(36).slice(2);
}

const drinks = [
  //Biere
  { id: "helles", name: "Helles", volume: "0,5 l", price: 5.00, deposit: 1.00, category: "bier" },
  { id: "pils", name: "Pils", volume: "0,3 l", price: 4.50, deposit: 1.00, category: "bier" },
  { id: "alkfrei_bier", name: "Schattenhofer Alkoholfrei", volume: "0,5 l", price: 4.50, deposit: 1.00, category: "bier" },
  { id: "weizen", name: "Gutmann Weizen", volume: "0,5 l", price: 5.00, deposit: 1.00, category: "bier" },

  //Longdrinks / Cocktails
  { id: "vodka_rb", name: "Vodka & Red Bull", volume: "0,4 l", price: 9.00, deposit: 1.00, category: "longdrink" },
  { id: "vodka_lemon", name: "Vodka Lemon", volume: "0,4 l", price: 9.00, deposit: 1.00, category: "longdrink" },
  { id: "cuba", name: "Cuba Libre", volume: "0,4 l", price: 9.00, deposit: 1.00, category: "longdrink" },
  { id: "gin_tonic", name: "Gin Tonic", volume: "0,4 l", price: 9.00, deposit: 1.00, category: "longdrink" },
  { id: "prosecco", name: "Prosecco auf Eis", volume: "0,4 l", price: 6.00, deposit: 1.00, category: "longdrink" },
  { id: "weinschorle", name: "Weißweinschorle", volume: "0,3 l", price: 6.00, deposit: 1.00, category: "longdrink" },

  //Shots (kein Pfand)
  { id: "shot_vodka", name: "Vodka", volume: "0,02 l", price: 3.00, deposit: 0.00, category: "shot" },
  { id: "shot_jaeger", name: "Jägermeister", volume: "0,02 l", price: 3.00, deposit: 0.00, category: "shot" },
  { id: "shot_pfeffi", name: "Pfeffi", volume: "0,02 l", price: 3.00, deposit: 0.00, category: "shot" },
  { id: "shot_ficken", name: "Ficken", volume: "0,02 l", price: 3.00, deposit: 0.00, category: "shot" },

  //Alkoholfrei
  { id: "wasser_s", name: "Wasser spritzig", volume: "0,4 l", price: 4.00, deposit: 1.00, category: "soft" },
  { id: "wasser_still", name: "Wasser still", volume: "0,4 l", price: 4.00, deposit: 1.00, category: "soft" },
  { id: "limo", name: "Zitronenlimonade", volume: "0,4 l", price: 4.00, deposit: 1.00, category: "soft" },
  { id: "cola", name: "Coca-Cola", volume: "0,4 l", price: 4.00, deposit: 1.00, category: "soft" },
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

  const sortedOrder = [...currentOrder].sort((a, b) => {
  if (a.id === "deposit") return 1;
  if (b.id === "deposit") return -1;
  return 0;
});

sortedOrder.forEach(o => {
    const row = document.createElement("div");
    row.className = "order-row";

    if (o.id === "deposit") {
        row.style.fontWeight = "700";
    }

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

  const total = currentOrder.reduce(
    (sum, o) => sum + o.qty * o.price,
    0
  );

  document.getElementById("current-total").textContent =
total.toFixed(2) + "€";
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

function downloadPDF(){
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
      price: d.price
    };
  });

  allOrders.forEach(order => {
    order.items.forEach(item => {
      if (!drinkStats[item.name]) {
        drinkStats[item.name] = {
          qty: 0,
          price: item.price
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
      return { name, qty, price, total };
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
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Kassenabrechnung", margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString("de-DE"), pageWidth - margin, 14, { align: "right" });

  y = 30;

  const col = {
    name: margin,
    qty: margin + 95,
    unit: margin + 120,
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
      price: d.price
    };
  });

  // Verkäufe addieren
  allOrders.forEach(order => {
    order.items.forEach(item => {

      if (!drinkStats[item.name]) {
        drinkStats[item.name] = {
          qty: 0,
          price: item.price
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
      <div>Preis</div>
      <div>Gesamtpreis</div>
    </div>
  `;

  let pfandRow = "";

  Object.entries(drinkStats).forEach(([name,data]) => {

    const qty = data.qty;
    const price = data.price;
    const total = qty * price;

    if (name === "Pfand") {
      pfandRow = `
        <div class="stat-row">
          <div>${name}</div>
          <div>${qty}</div>
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
   let deposit = currentOrder.find(i => i.id === "deposit")

  if (!deposit) return

  deposit.qty -= 1

  if (deposit.qty <= 0) {
    currentOrder = currentOrder.filter(i => i.id !== "deposit")
  }

  updateCurrentOrder()
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

loadOrdersFromServer();

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

window.addEventListener("online", syncOfflineOrders);
syncOfflineOrders();

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

if (resetBtn) {
  resetBtn.onclick = () => {
    document.getElementById("reset-modal").classList.add("active");
  };
}

let resetCountdown;
let seconds = 5;

const confirmBtn = document.getElementById("confirm-reset");

if (confirmBtn) {
confirmBtn.onclick = () => {

  clearInterval(resetCountdown);
  seconds = 5;

  const display = document.getElementById("reset-countdown");

  display.textContent = "Zurücksetzen in " + seconds + "s";

  resetCountdown = setInterval(() => {

    seconds--;
    display.textContent = "Zurücksetzen in " + seconds + "s";

    if (seconds <= 0) {

      clearInterval(resetCountdown);
      document.getElementById("reset-modal").classList.remove("active");
      resetSystem();

    }

  },1000);

};
}

const cancelBtn = document.getElementById("cancel-reset");
if (cancelBtn) {
  cancelBtn.onclick = () => {
    clearInterval(resetCountdown);
    seconds = 5;

    const resetModal = document.getElementById("reset-modal");
    if (resetModal) {
      resetModal.classList.remove("active");
    }
  };
}

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

function ensureTopbarUi() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) {
    return null;
  }

  const legacyNav = topbar.querySelector(".nav");
  if (legacyNav && !legacyNav.classList.contains("topbar-right")) {
    legacyNav.classList.add("topbar-right");
  }

  let fsBtn = document.getElementById("fullscreen-btn");
  if (!fsBtn) {
    fsBtn = document.createElement("button");
    fsBtn.id = "fullscreen-btn";
    fsBtn.type = "button";
    fsBtn.textContent = "⛶";
    topbar.appendChild(fsBtn);
    console.log("✓ Vollscreen-Button automatisch hinzugefuegt");
  }

  return fsBtn;
}

function initFullscreenButton() {
  const fsBtn = ensureTopbarUi();
  
  if(!fsBtn) {
    console.warn("❌ Vollscreen-Button nicht im DOM gefunden");
    return;
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






