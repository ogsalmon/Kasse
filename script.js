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

  await applyAuthenticatedUser(session.user);
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

const DEFAULT_BAR_ID = typeof BAR_ID !== "undefined" ? BAR_ID : "00000000-0000-0000-0000-000000000000";
let ACTIVE_BAR_ID = DEFAULT_BAR_ID;
let activeBarName = typeof BAR_NAME !== "undefined" ? BAR_NAME : "Unbekannte Bar";
let availableBars = [];

const BAR_SELECTION_STORAGE_PREFIX = "selectedBar";

function storageKey(key) {
  return `${key}_${ACTIVE_BAR_ID}`;
}

function getBarName(barId) {
  return (typeof BARS !== "undefined" ? BARS[barId] : undefined) || barId || "Unbekannte Bar";
}

function getSelectedBarId(username) {
  if (!username) return null;
  return localStorage.getItem(`${BAR_SELECTION_STORAGE_PREFIX}_${username}`);
}

function setSelectedBarId(username, barId) {
  if (!username || !barId) return;
  localStorage.setItem(`${BAR_SELECTION_STORAGE_PREFIX}_${username}`, barId);
}

function buildSelectedBar(barId) {
  return {
    id: barId,
    name: getBarName(barId)
  };
}

async function resolveBarContextForUser(user) {
  const username = getBartenderNameFromUser(user);
  console.log("Auflösung Bar-Kontext für User:", username);

  if (!username) {
    console.log("Kein Username gefunden");
    return;
  }

  const { data, error } = await supabaseClient
    .from("barkeepers")
    .select("bar_id, display_name")
    .eq("username", username);

  console.log("Barkeeper-Daten aus DB:", data, "Error:", error);

  if (error) {
    console.warn("Barkeeper-Kontext konnte nicht geladen werden:", error);
    return;
  }

  availableBars = [];

  if (Array.isArray(data) && data.length > 0) {
    // Für Mehrfachzuweisungen: Erstelle eine barkeeper_bars Tabelle mit bar_id und username
    // Hier vorerst nur einzelne bar_id verwenden
    const uniqueBarIds = data.map(row => row.bar_id).filter(Boolean);
    console.log("Gefundene Bar-IDs:", uniqueBarIds);
    availableBars = [...new Set(uniqueBarIds)].map(id => buildSelectedBar(id));
  } else {
    console.log("Keine Barkeeper-Daten gefunden für Username:", username);
  }

  const storedBar = getSelectedBarId(username);
  console.log("Gespeicherte Bar-ID:", storedBar);

  if (storedBar && availableBars.some(bar => bar.id === storedBar)) {
    ACTIVE_BAR_ID = storedBar;
  } else if (availableBars.length === 1) {
    ACTIVE_BAR_ID = availableBars[0].id;
    setSelectedBarId(username, ACTIVE_BAR_ID);
  } else if (availableBars.length > 0) {
    ACTIVE_BAR_ID = availableBars[0].id;
  }

  console.log("Aktive Bar-ID gesetzt auf:", ACTIVE_BAR_ID);
  activeBarName = getBarName(ACTIVE_BAR_ID);
}

async function applyAuthenticatedUser(user) {
  currentUser = user;
  await resolveBarContextForUser(user);
  bartender = getBartenderNameFromUser(user);
  historyFilter = bartender;
  localStorage.setItem("bartender", bartender);
  renderBarSelectionUI();
}

async function loadDrinks() {
  console.log("Lade Getränke für Bar-ID:", ACTIVE_BAR_ID);

  if (!ACTIVE_BAR_ID) {
    console.warn("Keine BAR_ID bekannt, keine Getränke verfügbar.");
    drinks = [];
    renderCategories();
    renderDrinks();
    updateStats();
    return;
  }

  const { data, error } = await supabaseClient
    .from("drinks")
    .select("*")
    .eq("bar_id", ACTIVE_BAR_ID)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.warn("Getränke konnten nicht geladen werden:", error.message || error);
    drinks = [];
    renderCategories();
    renderDrinks();
    updateStats();
    return;
  }

  console.log("Geladene Getränke:", data);

  if (Array.isArray(data) && data.length > 0) {
    drinks = data.map(d => ({
      id: d.id,
      name: d.name,
      volume: d.volume,
      price: Number(d.price),
      deposit: Number(d.deposit || 0),
      category: d.category
    }));
    console.log("Verarbeitete Drinks:", drinks);
    renderCategories();
    renderDrinks();
    updateStats();
  } else {
    console.warn("Keine Getränke in der Datenbank gefunden.");
    drinks = [];
    renderCategories();
    renderDrinks();
    updateStats();
  }
}

async function selectBarById(barId) {
  if (!barId || barId === ACTIVE_BAR_ID) return;

  ACTIVE_BAR_ID = barId;
  activeBarName = getBarName(barId);

  if (currentUser) {
    setSelectedBarId(getBartenderNameFromUser(currentUser), barId);
  }

  renderBarSelectionUI();
  await loadDrinks();
  loadOrdersFromServer();
}

function renderBarSelectionUI() {
  if (availableBars.length <= 1) return;

  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  let container = document.getElementById("bar-switcher-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "bar-switcher-container";
    container.className = "bar-switcher-container";

    const target = topbar.querySelector(".topbar-right") || topbar;
    target.insertBefore(container, target.firstChild);
  }

  const select = document.createElement("select");
  select.id = "bar-switcher";
  select.className = "bar-switcher";
  select.innerHTML = availableBars
    .map(bar => `
      <option value="${bar.id}"${bar.id === ACTIVE_BAR_ID ? " selected" : ""}>
        ${bar.name}
      </option>
    `)
    .join("");

  select.onchange = async (event) => {
    await selectBarById(event.target.value);
  };

  container.innerHTML = "<span class='bar-switcher-label'>Bar:</span>";
  container.appendChild(select);
}

let drinks = [];

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
let isPersonalOrder = false;

function isDepositItem(item) {
  return item?.id === "deposit" || item?.id === "deposit_return";
}

function getDepositQuantities(items) {
  const depositPaidQty = (items || [])
    .filter(item => item.deposit > 0)
    .reduce((sum, item) => sum + item.qty, 0);

  const depositReturnedQty = (items || [])
    .filter(item => item.id === "deposit_return")
    .reduce((sum, item) => sum + item.qty, 0);

  return {
    depositPaidQty,
    depositReturnedQty,
    netDepositQty: depositPaidQty - depositReturnedQty
  };
}

function isPersonalItem(item) {
  return item?.personalDrink === true;
}

function isPersonalOrderRecord(order) {
  return Array.isArray(order?.items) && order.items.some(isPersonalItem);
}

function getOrderPaymentMethod(order) {
  if (!order) return "cash";
  if (order.paymentMethod) return order.paymentMethod;
  if (Array.isArray(order.items)) {
    const itemWithMethod = order.items.find(item => item?.paymentMethod);
    if (itemWithMethod) return itemWithMethod.paymentMethod;
    if (isPersonalOrderRecord(order)) return "personal";
  }
  return "cash";
}

function getPaymentMethodLabel(method) {
  switch (method) {
    case "card":
      return "Karte";
    case "personal":
      return "Personal";
    default:
      return "Bar";
  }
}

function getOrderTotal(items, { excludeDeposit = false } = {}) {
  return (items || []).reduce((sum, item) => {
    if (excludeDeposit && isDepositItem(item)) return sum;
    return sum + (item.qty * item.price);
  }, 0);
}

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

const CATEGORY_CONFIG = {
  all: { name: "Alles", icon: null, iconActive: null },
  bier: { name: "Bier", icon: "images/beerblue.png", iconActive: "images/beerwhite.png" },
  longdrink: { name: "Longdrinks", icon: "images/longdrinksblue.png", iconActive: "images/longdrinkswhite.png" },
  longdrinks: { name: "Longdrinks", icon: "images/longdrinksblue.png", iconActive: "images/longdrinkswhite.png" },
  shot: { name: "Shots", icon: "images/shotsblue.png", iconActive: "images/shotswhite.png" },
  shots: { name: "Shots", icon: "images/shotsblue.png", iconActive: "images/shotswhite.png" },
  soft: { name: "Alkoholfrei", icon: "images/alcfreeblue.png", iconActive: "images/alcfreewhite.png" },
  alkoholfrei: { name: "Alkoholfrei", icon: "images/alcfreeblue.png", iconActive: "images/alcfreewhite.png" },
  wein: { name: "Wein", icon: "images/longdrinksblue.png", iconActive: "images/longdrinkswhite.png" }, // Verwende Longdrinks Icon für Wein
  mocktail: { name: "Mocktails", icon: "images/alcfreeblue.png", iconActive: "images/alcfreewhite.png" }, // Verwende Alkoholfrei Icon für Mocktail
  drinks_mit: { name: "Drinks mit", icon: "images/longdrinksblue.png", iconActive: "images/longdrinkswhite.png" },
  drinks_ohne: { name: "Drinks ohne", icon: "images/alcfreeblue.png", iconActive: "images/alcfreewhite.png" },
  softs: { name: "Softs", icon: "images/alcfreeblue.png", iconActive: "images/alcfreewhite.png" }
};

function renderCategories() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  // Sammle einzigartige Kategorien
  const categories = new Set(drinks.map(d => d.category));
  const categoryList = ["all", ...Array.from(categories).sort()];

  sidebar.innerHTML = "";

  categoryList.forEach((cat, index) => {
    const config = CATEGORY_CONFIG[cat] || { name: cat.charAt(0).toUpperCase() + cat.slice(1), icon: null, iconActive: null };
    const div = document.createElement("div");
    div.className = "category" + (index === 0 ? " active" : "");
    div.onclick = (event) => showCategory(event, cat);

    if (config.icon) {
      div.setAttribute("data-icon", config.icon);
      div.setAttribute("data-icon-active", config.iconActive);
      div.innerHTML = `<img src="${index === 0 ? config.iconActive || config.icon : config.icon}"><span>${config.name}</span>`;
    } else {
      div.innerHTML = `<span>${config.name}</span>`;
    }

    sidebar.appendChild(div);
  });
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

  const paymentModal = document.getElementById("payment-modal");
  if (paymentModal) {
    paymentModal.addEventListener("click", (e) => {
      if (e.target === paymentModal) {
        paymentModal.style.display = "none";
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

  const personalBtn = document.getElementById("personal-order-btn");
  const personalBtnMobile = document.getElementById("personal-order-btn-mobile");

  const onTogglePersonal = () => {
    isPersonalOrder = !isPersonalOrder;

    if (isPersonalOrder) {
      currentOrder = currentOrder.filter(item => !isDepositItem(item));
    } else {
      syncDeposit();
    }

    updateCurrentOrder();
  };

  if (personalBtn) {
    personalBtn.addEventListener("click", onTogglePersonal);
  }

  if (personalBtnMobile) {
    personalBtnMobile.addEventListener("click", onTogglePersonal);
  }

  updateCurrentOrder();

});

function updatePersonalOrderButtons() {
  const desktopBtn = document.getElementById("personal-order-btn");
  const mobileBtn = document.getElementById("personal-order-btn-mobile");

  [desktopBtn, mobileBtn].forEach((btn) => {
    if (!btn) return;
    btn.classList.toggle("active", isPersonalOrder);
    btn.textContent = isPersonalOrder ? "Personalgetränk: AN" : "Personalgetränk";
  });
}

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
  if (isPersonalOrder) return;

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
  updatePersonalOrderButtons();

  if (!list) return;

  list.innerHTML = "";

  const { netDepositQty } = getDepositQuantities(currentOrder);
  const depositTotalPrice = currentOrder.find(o => o.id === "deposit")?.price || 0;

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
  if (netDepositQty !== 0) {
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
    depositQtySpan.textContent = netDepositQty + "x";
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
    depositPrice.textContent = depositTotalPrice.toFixed(2) + "€";

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

  const total = getOrderTotal(currentOrder);

  const totalText = total.toFixed(2) + "€";
  const totalEl = document.getElementById("current-total");
  const modalPriceEl = document.getElementById("modal-price");
  const paymentModalPriceEl = document.getElementById("payment-modal-price");
  const mobileTotalEl = document.getElementById("mobile-total");

  if (totalEl) {
    totalEl.textContent = totalText;
  }

  if (modalPriceEl) {
    modalPriceEl.textContent = totalText;
  }

  if (paymentModalPriceEl) {
    paymentModalPriceEl.textContent = totalText;
  }

  if (mobileTotalEl) {
    mobileTotalEl.textContent = totalText;
  }
}

async function finishOrder() {
  if (currentOrder.length === 0) return;
  openPaymentModal();
}

function openPaymentModal() {
  const modal = document.getElementById("payment-modal");
  if (!modal) return;

  const paymentModalPriceEl = document.getElementById("payment-modal-price");
  const total = getOrderTotal(currentOrder);
  if (paymentModalPriceEl) {
    paymentModalPriceEl.textContent = total.toFixed(2) + "€";
  }

  modal.style.display = "flex";
}

function closePaymentModal() {
  const modal = document.getElementById("payment-modal");
  if (!modal) return;
  modal.style.display = "none";
}

async function submitPaymentMethod(method) {
  closePaymentModal();
  await finalizeOrder(method);
}

async function finalizeOrder(paymentMethod) {
  const rawTotal = getOrderTotal(currentOrder);

  const itemsToStore = currentOrder.map(item => ({
    ...item,
    personalDrink: paymentMethod === "personal",
    paymentMethod: paymentMethod
  }));

  const orderData = {
    bartender: bartender,
    items: itemsToStore,
    total: paymentMethod === "personal" ? 0 : rawTotal,
    created_at: new Date(),
    bar_id: ACTIVE_BAR_ID
  };

  try {
    const { error } = await supabaseClient
      .from("orders")
      .insert([orderData]);

    if (error) throw error;

  } catch (err) {
    console.log("Offline gespeichert");

    const rawOffline = localStorage.getItem(storageKey("offlineOrders")) || localStorage.getItem("offlineOrders");
    let offlineOrders = [];
    try {
      offlineOrders = JSON.parse(rawOffline || "[]");
    } catch (parseError) {
      offlineOrders = [];
    }

    offlineOrders.push(orderData);
    localStorage.setItem(
      storageKey("offlineOrders"),
      JSON.stringify(offlineOrders)
    );
  }

  currentOrder = [];
  isPersonalOrder = false;
  updateCurrentOrder();
  loadOrdersFromServer();
}

let logoDataUrlCache = null;

async function getLogoDataUrl() {
  if (logoDataUrlCache) return logoDataUrlCache;

  const img = new Image();
  img.crossOrigin = "anonymous";
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

  if (!ACTIVE_BAR_ID) {
    alert("Keine aktive Bar ausgewählt. PDF kann nicht erstellt werden.");
    return;
  }

  const { data: currentBarOrders, error: ordersError } = await supabaseClient
    .from("orders")
    .select("*")
    .eq("bar_id", ACTIVE_BAR_ID)
    .order("created_at", { ascending: false });

  if (ordersError) {
    console.error("Fehler beim Laden der Orders:", ordersError);
    alert("Fehler beim Laden der Daten für PDF.");
    return;
  }

  const stationRevenues = {};
  currentBarOrders.forEach(order => {
    const station = order.bartender || "Unbekannt";
    if (!stationRevenues[station]) {
      stationRevenues[station] = { total: 0, orderCount: 0 };
    }
    stationRevenues[station].orderCount += 1;

    order.items.forEach(item => {
      if (!isPersonalItem(item) && item.id !== "deposit" && item.id !== "deposit_return") {
        stationRevenues[station].total += item.qty * item.price;
      }
    });
  });

  // Sortiere Barkeeper-Stationen nach Umsatz
  const sortedStations = Object.entries(stationRevenues)
    .map(([station, data]) => ({ station, ...data }))
    .sort((a, b) => b.total - a.total);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const rowHeight = 7;
  let y = 18;

  const palette = {
    blue: [67, 87, 173],
    ocre: [201, 168, 115],
    textDark: [40, 40, 40],
    rowAlt: [246, 248, 255],
    white: [255, 255, 255]
  };

  const fmt = (num) => `${num.toFixed(2)} EUR`;
  const truncate = (text, maxLen = 34) => {
    if (!text) return "";
    return text.length > maxLen ? `${text.slice(0, maxLen - 1)}...` : text;
  };

  const drinkStats = {};
  let cashTotal = 0;
  let cardTotal = 0;
  let personalTotal = 0;
  let pdfDepositPaidQty = 0;
  let pdfDepositReturnedQty = 0;

  drinks.forEach(d => {
    drinkStats[d.name] = {
      qty: 0,
      price: d.price,
      volume: d.volume,
      category: d.category
    };
  });

  allOrders.forEach(order => {
    const paymentMethod = getOrderPaymentMethod(order);

    order.items.forEach(item => {
      if (!isPersonalItem(item) && item.id === "deposit") {
        pdfDepositPaidQty += item.qty;
        return;
      }

      if (!isPersonalItem(item) && item.id === "deposit_return") {
        pdfDepositReturnedQty += item.qty;
        return;
      }

      if (isDepositItem(item)) {
        return;
      }

      const lineTotal = item.price * item.qty;
      if (paymentMethod === "personal") {
        personalTotal += lineTotal;
        return;
      }

      if (paymentMethod === "cash") {
        cashTotal += lineTotal;
      } else if (paymentMethod === "card") {
        cardTotal += lineTotal;
      }

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

  rows.forEach(r => {
    if (r.name === "Pfand") {
      r.qty = pdfDepositPaidQty;
    } else if (r.name === "Pfand Rückgabe") {
      r.qty = pdfDepositReturnedQty;
    }
  });

  const personalRowsMap = {};

  allOrders.forEach(order => {
    order.items.forEach(item => {
      if (!isPersonalItem(item)) return;
      if (item.id === "deposit" || item.id === "deposit_return") return;

      const key = `${order.bartender}::${item.name}`;
      if (!personalRowsMap[key]) {
        personalRowsMap[key] = {
          bartender: order.bartender,
          drink: item.name,
          qty: 0,
          price: item.price,
          total: 0
        };
      }

      personalRowsMap[key].qty += item.qty;
      personalRowsMap[key].total += item.qty * item.price;
    });
  });

  const personalRows = Object.values(personalRowsMap)
    .sort((a, b) => a.bartender.localeCompare(b.bartender, "de") || a.drink.localeCompare(b.drink, "de"));

  let totalCash = 0;
  let pdfDepositPaid = 0;
  let pdfDepositReturned = 0;
  rows.forEach(r => {
    if (r.name === "Pfand") {
      pdfDepositPaid = r.total;
    } else if (r.name === "Pfand Rückgabe") {
      pdfDepositReturned = Math.abs(r.total);
    } else {
      totalCash += r.total;
    }
  });
  const totalCashWithDeposit = totalCash + pdfDepositPaid - pdfDepositReturned;

  const orderCount = allOrders.length;

  doc.setFillColor(...palette.white);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setFillColor(...palette.blue);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setFillColor(...palette.ocre);
  doc.rect(0, 30, pageWidth, 3, "F");

  doc.setTextColor(255, 255, 255);

  let titleX = margin;
  try {
    const logoDataUrl = await getLogoDataUrl();
    doc.setFillColor(...palette.white);
    doc.roundedRect(margin - 1, 4, 28, 20, 2.5, 2.5, "F");
    doc.addImage(logoDataUrl, "PNG", margin + 1, 5, 26, 20);
    titleX = margin + 34;
  } catch (error) {
    console.warn("Logo konnte im PDF nicht geladen werden.", error);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Kassenabrechnung", titleX, 14.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("drinq Export", titleX, 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Erstellt:", pageWidth - margin, 11.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleString("de-DE"), pageWidth - margin, 16, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(`Bestellungen: ${orderCount}`, pageWidth - margin, 20.5, { align: "right" });

  y = 42;

  const col = {
    name: margin,
    qty: margin + 104,
    cases: margin + 124,
    unit: margin + 145,
    total: pageWidth - margin
  };

  const drawTableHeader = () => {
    doc.setFillColor(...palette.ocre);
    doc.roundedRect(margin, y - 6, pageWidth - margin * 2, 9, 1.5, 1.5, "F");
    doc.setTextColor(...palette.blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Getraenk", col.name + 2, y);
    doc.text("Stueck", col.qty, y, { align: "right" });
    doc.text("Kaesten", col.cases, y, { align: "right" });
    doc.text("Einzelpreis", col.unit, y, { align: "right" });
    doc.text("Gesamt", col.total, y, { align: "right" });
    y += rowHeight + 2;
  };

  drawTableHeader();

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...palette.textDark);

  rows.forEach((row, index) => {
    if (y > pageHeight - 28) {
      doc.addPage();
      doc.setFillColor(...palette.blue);
      doc.rect(0, 0, pageWidth, 12, "F");
      doc.setFillColor(...palette.ocre);
      doc.rect(0, 12, pageWidth, 2, "F");
      doc.setTextColor(...palette.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Kassenabrechnung - Fortsetzung", margin, 8);

      y = 20;
      drawTableHeader();
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...palette.textDark);
    }

    if (index % 2 === 0) {
      doc.setFillColor(...palette.rowAlt);
      doc.rect(margin, y - 5, pageWidth - margin * 2, rowHeight, "F");
    }

    doc.text(truncate(row.name), col.name + 2, y);
    doc.text(String(row.qty), col.qty, y, { align: "right" });
    doc.text(row.cases === null ? "-" : row.cases.toFixed(2), col.cases, y, { align: "right" });
    doc.text(fmt(row.price), col.unit, y, { align: "right" });
    doc.text(fmt(row.total), col.total, y, { align: "right" });

    doc.setDrawColor(230, 233, 244);
    doc.line(margin, y + 2.2, pageWidth - margin, y + 2.2);

    y += rowHeight;
  });

  y += 6;
  if (y > pageHeight - 30) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(...palette.blue);
  doc.line(margin, y - 4, pageWidth - margin, y - 4);
  doc.setTextColor(...palette.blue);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Gesamt Barumsatz (ohne Pfand)", margin, y + 1.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(fmt(totalCash), pageWidth - margin, y + 1.4, { align: "right" });

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Pfand bezahlt: +${fmt(pdfDepositPaid)}`, margin, y + 1.4);
  y += 6;
  doc.text(`Pfand zurückgegeben: -${fmt(pdfDepositReturned)}`, margin, y + 1.4);

  y += 8;
  doc.setDrawColor(...palette.blue);
  doc.line(margin, y - 4, pageWidth - margin, y - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Gesamt Barumsatz (mit Pfand)", margin, y + 1.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(fmt(totalCashWithDeposit), pageWidth - margin, y + 1.4, { align: "right" });

  y += 10;
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Zahlungsarten", margin, y + 1.4);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Bar: ${fmt(cashTotal)}`, margin, y + 1.4);
  y += 5;
  doc.text(`Karte: ${fmt(cardTotal)}`, margin, y + 1.4);
  y += 5;
  doc.text(`Personal boniert: ${fmt(personalTotal)}`, margin, y + 1.4);

  doc.setTextColor(130, 130, 130);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text("Erstellt mit drinq Kasse", margin, pageHeight - 8);

  y += 12;
  if (y > pageHeight - 32) {
    doc.addPage();
    y = 20;
  }

  doc.setTextColor(...palette.blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Personalgetränke (nicht berechnet)", margin, y);
  y += 6;

  if (personalRows.length === 0) {
    doc.setTextColor(...palette.textDark);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Keine Personalgetränke im gewählten Zeitraum.", margin, y);
  } else {
    const personalCol = {
      bartender: margin,
      drink: margin + 45,
      qty: margin + 128,
      unit: margin + 152,
      total: pageWidth - margin
    };

    const drawPersonalHeader = () => {
      doc.setFillColor(...palette.ocre);
      doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 8, 1.5, 1.5, "F");
      doc.setTextColor(...palette.blue);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Barkeeper", personalCol.bartender + 2, y);
      doc.text("Getraenk", personalCol.drink + 2, y);
      doc.text("Stueck", personalCol.qty, y, { align: "right" });
      doc.text("Preis", personalCol.unit, y, { align: "right" });
      doc.text("Wert", personalCol.total, y, { align: "right" });
      y += rowHeight;
    };

    drawPersonalHeader();

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...palette.textDark);

    personalRows.forEach((row, index) => {
      if (y > pageHeight - 22) {
        doc.addPage();
        y = 20;
        drawPersonalHeader();
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...palette.textDark);
      }

      if (index % 2 === 0) {
        doc.setFillColor(...palette.rowAlt);
        doc.rect(margin, y - 5, pageWidth - margin * 2, rowHeight, "F");
      }

      doc.text(truncate(row.bartender, 16), personalCol.bartender + 2, y);
      doc.text(truncate(row.drink, 28), personalCol.drink + 2, y);
      doc.text(String(row.qty), personalCol.qty, y, { align: "right" });
      doc.text(fmt(row.price), personalCol.unit, y, { align: "right" });
      doc.text(fmt(row.total), personalCol.total, y, { align: "right" });
      y += rowHeight;
    });
  }

  // Barkeeper-Stationen hinzufügen
  if (sortedStations.length > 1) {
    y += 8;
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }

    doc.setTextColor(...palette.blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Stationen-Umsatz (Gesamtumsatz ohne Pfand)", margin, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...palette.textDark);

    sortedStations.forEach((station, index) => {
      if (y > pageHeight - 15) {
        doc.addPage();
        y = 20;
      }

      const rank = index + 1;
      const stationText = `${rank}. ${station.station}: ${fmt(station.total)} (${station.orderCount} Bestellungen)`;
      doc.text(stationText, margin, y);
      y += 6;
    });
  }

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
      if (isPersonalItem(item)) return;

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
  let cashTotal = 0;
  let cardTotal = 0;
  let personalTotal = 0;

  allOrders.forEach(order => {
    const method = getOrderPaymentMethod(order);
    order.items.forEach(item => {
      if (isDepositItem(item)) {
        return;
      }

      const lineTotal = item.price * item.qty;

      if (method === "cash") {
        cashTotal += lineTotal;
      } else if (method === "card") {
        cardTotal += lineTotal;
      } else if (method === "personal") {
        personalTotal += lineTotal;
      }
    });
  });

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

  let depositPaid = 0;
  let depositReturned = 0;

  Object.entries(drinkStats).forEach(([name,data]) => {

    const qty = data.qty;
    const price = data.price;
    const total = qty * price;
    const caseSize = getCaseSizeByVolume(data.volume);
    const cases = getCaseCount(qty, caseSize, data.category);
    const casesLabel = cases === null ? "-" : cases.toFixed(2);

    if (name === "Pfand") {
      depositPaid = total;
      return;
    }

    if (name === "Pfand Rückgabe") {
      depositReturned = Math.abs(total);
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

  html += `
    <div class="stats-total">
      <span>Gesamt Barumsatz (ohne Pfand)</span>
      <span>${totalCash.toFixed(2)}€</span>
    </div>
    <div class="stat-row stat-row--deposit">
      <div>Pfand bezahlt</div>
      <div></div>
      <div></div>
      <div></div>
      <div>+${depositPaid.toFixed(2)}€</div>
    </div>
    <div class="stat-row stat-row--deposit">
      <div>Pfand zurückgegeben</div>
      <div></div>
      <div></div>
      <div></div>
      <div>-${depositReturned.toFixed(2)}€</div>
    </div>
    <div class="stats-total stats-total--with-deposit">
      <span>Gesamt Barumsatz (mit Pfand)</span>
      <span>${(totalCash + depositPaid - depositReturned).toFixed(2)}€</span>
    </div>

    <div class="stats-payment-divider"></div>
    <div style="margin-top: 16px; margin-bottom: 8px; font-size: 14px; font-weight: 600; color: var(--blue);">Zahlungsarten</div>

    <div class="stat-row">
      <div>Bar</div>
      <div></div>
      <div></div>
      <div></div>
      <div>${cashTotal.toFixed(2)}€</div>
    </div>
    <div class="stat-row">
      <div>Karte</div>
      <div></div>
      <div></div>
      <div></div>
      <div>${cardTotal.toFixed(2)}€</div>
    </div>
    <div class="stat-row">
      <div>Personal boniert</div>
      <div></div>
      <div></div>
      <div></div>
      <div>${personalTotal.toFixed(2)}€</div>
    </div>
  </div>
  </div>
  `;

  statsEl.innerHTML = html;
}

function computeOrderTotals(orders = []) {
  const totals = {
    cashTotal: 0,
    cardTotal: 0,
    personalTotal: 0,
    depositPaidQty: 0,
    depositReturnedQty: 0,
    depositPaid: 0,
    depositReturned: 0,
    totalWithoutPfand: 0,
    totalWithPfand: 0
  };

  orders.forEach(order => {
    const method = getOrderPaymentMethod(order);
    (order.items || []).forEach(item => {
      if (!item) return;

      if (item.id === "deposit") {
        totals.depositPaidQty += item.qty;
        totals.depositPaid += item.price * item.qty;
        return;
      }

      if (item.id === "deposit_return") {
        totals.depositReturnedQty += item.qty;
        totals.depositReturned += Math.abs(item.price * item.qty);
        return;
      }

      const lineTotal = item.price * item.qty;
      if (isPersonalItem(item) || method === "personal") {
        totals.personalTotal += lineTotal;
        return;
      }

      if (method === "cash") {
        totals.cashTotal += lineTotal;
      } else if (method === "card") {
        totals.cardTotal += lineTotal;
      } else {
        totals.cashTotal += lineTotal;
      }
    });
  });

  totals.totalWithoutPfand = totals.cashTotal + totals.cardTotal;
  totals.totalWithPfand = totals.totalWithoutPfand + totals.depositPaid - totals.depositReturned;
  return totals;
}

function computeLegacyTotals(orders = []) {
  const totals = {
    cashTotal: 0,
    cardTotal: 0,
    personalTotal: 0,
    depositPaidQty: 0,
    depositReturnedQty: 0,
    depositPaid: 0,
    depositReturned: 0,
    totalWithoutPfand: 0,
    totalWithPfand: 0
  };

  orders.forEach(order => {
    const method = getOrderPaymentMethod(order);
    (order.items || []).forEach(item => {
      if (!item) return;

      const lineTotal = item.price * item.qty;
      if (item.id === "deposit") {
        totals.depositPaidQty += item.qty;
        totals.depositPaid += lineTotal;
      }

      if (item.id === "deposit_return") {
        totals.depositReturnedQty += item.qty;
        totals.depositReturned += Math.abs(lineTotal);
      }

      if (isPersonalItem(item) || method === "personal") {
        totals.personalTotal += lineTotal;
        return;
      }

      if (method === "cash") {
        totals.cashTotal += lineTotal;
      } else if (method === "card") {
        totals.cardTotal += lineTotal;
      } else {
        totals.cashTotal += lineTotal;
      }
    });
  });

  totals.totalWithoutPfand = totals.cashTotal + totals.cardTotal;
  totals.totalWithPfand = totals.totalWithoutPfand + totals.depositPaid - totals.depositReturned;
  return totals;
}

function validateOrderTotals() {
  const newTotals = computeOrderTotals(allOrders);
  const legacyTotals = computeLegacyTotals(allOrders);

  const differences = {
    cashTotal: newTotals.cashTotal - legacyTotals.cashTotal,
    cardTotal: newTotals.cardTotal - legacyTotals.cardTotal,
    totalWithoutPfand: newTotals.totalWithoutPfand - legacyTotals.totalWithoutPfand,
    totalWithPfand: newTotals.totalWithPfand - legacyTotals.totalWithPfand
  };

  console.group("Order Totals Validation");
  console.log("Neue (korrekte) Berechnung");
  console.table({
    "Bar ohne Pfand": newTotals.cashTotal.toFixed(2),
    "Karte ohne Pfand": newTotals.cardTotal.toFixed(2),
    "Personal": newTotals.personalTotal.toFixed(2),
    "Pfand bezahlt": newTotals.depositPaid.toFixed(2),
    "Pfand zurückgegeben": newTotals.depositReturned.toFixed(2),
    "Barumsatz ohne Pfand": newTotals.totalWithoutPfand.toFixed(2),
    "Barumsatz mit Pfand": newTotals.totalWithPfand.toFixed(2)
  });
  console.log("Legacy Berechnung (Pfand in Bar/Karte enthalten)");
  console.table({
    "Bar ohne Pfand": legacyTotals.cashTotal.toFixed(2),
    "Karte ohne Pfand": legacyTotals.cardTotal.toFixed(2),
    "Personal": legacyTotals.personalTotal.toFixed(2),
    "Pfand bezahlt": legacyTotals.depositPaid.toFixed(2),
    "Pfand zurückgegeben": legacyTotals.depositReturned.toFixed(2),
    "Barumsatz ohne Pfand": legacyTotals.totalWithoutPfand.toFixed(2),
    "Barumsatz mit Pfand": legacyTotals.totalWithPfand.toFixed(2)
  });
  console.log("Differenzen (neu - legacy)");
  console.table({
    "Bar ohne Pfand": differences.cashTotal.toFixed(2),
    "Karte ohne Pfand": differences.cardTotal.toFixed(2),
    "Barumsatz ohne Pfand": differences.totalWithoutPfand.toFixed(2),
    "Barumsatz mit Pfand": differences.totalWithPfand.toFixed(2)
  });
  console.groupEnd();

  return { newTotals, legacyTotals, differences };
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

    const paymentMethod = getOrderPaymentMethod(order);
    const paymentLabel = getPaymentMethodLabel(paymentMethod);

    const card = document.createElement("div");
    card.className = `history-card history-card--${paymentMethod}`;

    const content = document.createElement("div");
    content.className = "history-items";

    let html = `
<div class="history-bartender">${order.bartender} <span class="history-tag-payment">${paymentLabel}</span></div>
<div class="history-time">${order.time}</div>
`;

    let total = 0;
    let regularTotal = 0;
    const { depositPaidQty } = getDepositQuantities(order.items);
    const depositItem = order.items.find(item => item.id === "deposit");

    order.items.forEach(item => {
      if (isPersonalItem(item) && isDepositItem(item)) {
        return;
      }

      if (item.id === "deposit") {
        const depositTotal = item.price * item.qty;
        total += depositTotal;
        if (!isPersonalItem(item)) {
          regularTotal += depositTotal;
        }
        return;
      }

      const lineTotal = item.price * item.qty;
      total += lineTotal;
      if (!isPersonalItem(item)) {
        regularTotal += lineTotal;
      }

      html += `
        <div>
          ${item.name} x ${item.qty}${isPersonalItem(item) ? ' (Personal)' : ''}
          <span>${lineTotal.toFixed(2)}€</span>
        </div>
      `;
    });

    if (depositItem && depositPaidQty > 0) {
      html += `
        <div>
          Pfand x ${depositPaidQty}
          <span>${depositItem.price.toFixed(2)}€</span>
        </div>
      `;
    }

    if (paymentMethod === "personal") {
      html += `<div class="history-total">Summe: 0.00€ (regulär ${total.toFixed(2)}€)</div>`;
    } else {
      html += `<div class="history-total">Summe: ${regularTotal.toFixed(2)}€</div>`;
    }

    content.innerHTML = html;

    const del = document.createElement("div");
    del.className = "history-delete";

    del.innerHTML = `<img src="images/deleteblue.png">`;

    del.onclick = async () => {

      if (!confirm("Bestellung wirklich stornieren?")) return;

      const { error } = await supabaseClient
        .from("orders")
        .delete()
        .eq("id", order.id)
        .eq("bar_id", ACTIVE_BAR_ID);

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
  localStorage.removeItem(storageKey("offlineOrders"));
  localStorage.removeItem("offlineOrders");
  localStorage.removeItem("bartender");

  updateCurrentOrder();
  updateStats();
  updateHistory();
}

function addDepositReturn() {
  if (isPersonalOrder) return;

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
  if (isPersonalOrder) {
    currentOrder = currentOrder.filter(item => !isDepositItem(item));
    return;
  }

  // Berechne Gesamtpfand basierend auf echten Deposit-Werten
  const depositTotal = currentOrder
    .filter(o => o.deposit > 0)
    .reduce((sum, o) => sum + (o.deposit * o.qty), 0);

  const existing = currentOrder.find(o => o.id === "deposit");

  if (depositTotal === 0) {
    currentOrder = currentOrder.filter(o => o.id !== "deposit");
    return;
  }

  if (existing) {
    existing.price = depositTotal;
    existing.qty = 1;
  } else {
    currentOrder.push({
      id: "deposit",
      name: "Pfand",
      price: depositTotal,
      deposit: 0,
      qty: 1
    });
  }
}

function subscribeToOrders() {
  if (typeof ACTIVE_BAR_ID === "undefined" || !ACTIVE_BAR_ID) {
    return;
  }

  supabaseClient
    .channel("orders-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `bar_id=eq.${ACTIVE_BAR_ID}`
      },
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
    .eq("bar_id", ACTIVE_BAR_ID)
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
  const rawOffline = localStorage.getItem(storageKey("offlineOrders")) || localStorage.getItem("offlineOrders");
  let offlineOrders = [];

  try {
    offlineOrders = JSON.parse(rawOffline || "[]");
  } catch (err) {
    offlineOrders = [];
  }

  if (offlineOrders.length === 0) return;

  for (const order of offlineOrders) {
    if (!order.bar_id) {
      order.bar_id = ACTIVE_BAR_ID;
    }
    await supabaseClient.from("orders").insert([order]);
  }

  localStorage.removeItem(storageKey("offlineOrders"));
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
  const normalizeQrParam = (value) => {
    return (value || "")
      .replace(/\u200B/g, "")
      .trim();
  };

  const autoUser = normalizeQrParam(urlParams.get("u"));
  const autoPass = normalizeQrParam(urlParams.get("p"));

  if (autoUser && autoPass) {
    if (loginStatus) {
      loginStatus.textContent = "Anmeldung läuft...";
    }

    // Parameter sofort aus URL entfernen
    const cleanUrl = window.location.pathname;
    history.replaceState(null, "", cleanUrl);

    let { data: autoData, error: autoError } = await supabaseClient.auth.signInWithPassword({
      email: usernameToEmail(autoUser),
      password: autoPass
    });

    // Some QR generators or camera apps may transform '+' to spaces in query params.
    if ((autoError || !autoData?.user) && autoPass.includes(" ")) {
      ({ data: autoData, error: autoError } = await supabaseClient.auth.signInWithPassword({
        email: usernameToEmail(autoUser),
        password: autoPass.replace(/ /g, "+")
      }));
    }

    if (!autoError && autoData?.user) {
      await applyAuthenticatedUser(autoData.user);
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

  await loadDrinks();
  subscribeToOrders();
  loadOrdersFromServer();
  window.addEventListener("online", syncOfflineOrders);
  syncOfflineOrders();
}

initApp();

async function resetSystem() {

  const { error } = await supabaseClient
    .from("orders")
    .delete()
    .eq("bar_id", ACTIVE_BAR_ID);

  if (error) {
    console.error("Reset Fehler:", error);
    alert("Fehler beim Zurücksetzen");
    return;
  }

  localStorage.removeItem(storageKey("offlineOrders"));
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






