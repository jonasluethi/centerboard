"use strict";

const STORAGE_KEY = "centerboard.employees.v1";
const SEED_URL = "employees.json";

const SWISS_CENTER = [46.8, 8.2];
const SWISS_ZOOM = 8;

const WMTS_LAYERS = {
  "pixelkarte-farbe": {
    id: "ch.swisstopo.pixelkarte-farbe",
    format: "jpeg",
    maxZoom: 18,
  },
  "pixelkarte-grau": {
    id: "ch.swisstopo.pixelkarte-grau",
    format: "jpeg",
    maxZoom: 18,
  },
  swissimage: {
    id: "ch.swisstopo.swissimage",
    format: "jpeg",
    maxZoom: 19,
  },
};

function wmtsUrl(layerKey) {
  const layer = WMTS_LAYERS[layerKey];
  return `https://wmts.geo.admin.ch/1.0.0/${layer.id}/default/current/3857/{z}/{x}/{y}.${layer.format}`;
}

function makeTileLayer(layerKey) {
  const layer = WMTS_LAYERS[layerKey];
  return L.tileLayer(wmtsUrl(layerKey), {
    maxZoom: layer.maxZoom,
    minZoom: 2,
    attribution:
      '&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a>',
  });
}

const map = L.map("map", { zoomControl: true }).setView(
  SWISS_CENTER,
  SWISS_ZOOM
);

let currentTileLayer = makeTileLayer("pixelkarte-farbe");
currentTileLayer.addTo(map);

document.querySelectorAll('input[name="layer"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    map.removeLayer(currentTileLayer);
    currentTileLayer = makeTileLayer(e.target.value);
    currentTileLayer.addTo(map);
  });
});

const markerIcon = new L.Icon.Default();

/** @type {Map<string, {employee: object, marker: L.Marker|null}>} */
const entries = new Map();

const listEl = document.getElementById("employee-list");
const countEl = document.getElementById("employee-count");
const addForm = document.getElementById("add-form");
const nameInput = document.getElementById("input-name");
const addressInput = document.getElementById("input-address");
const statusEl = document.getElementById("form-status");
const resetBtn = document.getElementById("reset-btn");

function loadStoredEmployees() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.warn("Konnte gespeicherte Mitarbeiterliste nicht lesen", e);
  }
  return null;
}

function persistEmployees() {
  const list = Array.from(entries.values()).map((e) => e.employee);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

async function loadSeedEmployees() {
  const res = await fetch(SEED_URL);
  if (!res.ok) throw new Error("Seed-Datei konnte nicht geladen werden");
  return res.json();
}

async function geocodeAddress(address) {
  const url =
    "https://api3.geo.admin.ch/rest/services/api/SearchServer" +
    `?searchText=${encodeURIComponent(address)}` +
    "&type=locations&origins=address&limit=1";

  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding-Dienst nicht erreichbar");
  const data = await res.json();
  const result = data && data.results && data.results[0];
  if (!result || !result.attrs) {
    throw new Error("Adresse wurde nicht gefunden");
  }
  const { lat, lon, label } = result.attrs;
  if (typeof lat !== "number" || typeof lon !== "number") {
    throw new Error("Adresse konnte nicht lokalisiert werden");
  }
  return { lat, lon, label: label ? stripHtml(label) : address };
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function renderList() {
  listEl.innerHTML = "";
  countEl.textContent = `(${entries.size})`;

  for (const [id, entry] of entries) {
    const { employee } = entry;
    const li = document.createElement("li");
    li.className = "employee-item";
    if (employee.status === "pending") li.classList.add("pending");
    if (employee.status === "error") li.classList.add("error");

    const dot = document.createElement("span");
    dot.className = "dot";

    const info = document.createElement("div");
    info.className = "info";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = employee.name;

    const addr = document.createElement("div");
    addr.className = "address";
    addr.textContent = employee.address;

    info.appendChild(name);
    info.appendChild(addr);

    if (employee.status === "error") {
      const err = document.createElement("div");
      err.className = "error-text";
      err.textContent = employee.errorMessage || "Fehler beim Lokalisieren";
      info.appendChild(err);
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "✕";
    removeBtn.title = "Entfernen";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeEmployee(id);
    });

    li.appendChild(dot);
    li.appendChild(info);
    li.appendChild(removeBtn);

    if (employee.status === "ok") {
      li.addEventListener("click", () => {
        map.flyTo([employee.lat, employee.lon], 15, { duration: 0.6 });
        entry.marker && entry.marker.openPopup();
      });
    }

    listEl.appendChild(li);
  }
}

function updateMarker(id) {
  const entry = entries.get(id);
  if (!entry) return;
  const { employee } = entry;

  if (entry.marker) {
    map.removeLayer(entry.marker);
    entry.marker = null;
  }

  if (employee.status === "ok") {
    const marker = L.marker([employee.lat, employee.lon], {
      icon: markerIcon,
    }).addTo(map);
    marker.bindPopup(`<b>${escapeHtml(employee.name)}</b>${escapeHtml(
      employee.address
    )}`);
    entry.marker = marker;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function fitMapToMarkers() {
  const latlngs = Array.from(entries.values())
    .filter((e) => e.employee.status === "ok")
    .map((e) => [e.employee.lat, e.employee.lon]);
  if (latlngs.length === 0) return;
  if (latlngs.length === 1) {
    map.setView(latlngs[0], 14);
  } else {
    map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
  }
}

function removeEmployee(id) {
  const entry = entries.get(id);
  if (entry && entry.marker) map.removeLayer(entry.marker);
  entries.delete(id);
  renderList();
  persistEmployees();
}

async function addEmployee(name, address, { persist = true } = {}) {
  const id = `emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const employee = { id, name, address, status: "pending" };
  entries.set(id, { employee, marker: null });
  renderList();

  try {
    const { lat, lon } = await geocodeAddress(address);
    employee.status = "ok";
    employee.lat = lat;
    employee.lon = lon;
  } catch (err) {
    employee.status = "error";
    employee.errorMessage = err.message;
  }

  renderList();
  updateMarker(id);
  if (persist) persistEmployees();
  return employee;
}

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const address = addressInput.value.trim();
  if (!name || !address) return;

  const submitBtn = addForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  statusEl.textContent = "Adresse wird lokalisiert…";
  statusEl.className = "form-status";

  const employee = await addEmployee(name, address);

  if (employee.status === "ok") {
    statusEl.textContent = `${name} wurde eingezeichnet.`;
    statusEl.className = "form-status success";
    addForm.reset();
    map.flyTo([employee.lat, employee.lon], 15, { duration: 0.6 });
  } else {
    statusEl.textContent = employee.errorMessage;
    statusEl.className = "form-status error";
  }

  submitBtn.disabled = false;
});

resetBtn.addEventListener("click", async () => {
  if (!confirm("Alle Mitarbeitenden auf die Standardliste zurücksetzen?")) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  for (const [id, entry] of entries) {
    if (entry.marker) map.removeLayer(entry.marker);
  }
  entries.clear();
  renderList();
  await init();
});

async function init() {
  let seed = loadStoredEmployees();
  if (!seed) {
    try {
      seed = await loadSeedEmployees();
    } catch (e) {
      console.warn(e);
      seed = [];
    }
  }

  for (const item of seed) {
    await addEmployee(item.name, item.address, { persist: false });
  }
  persistEmployees();
  fitMapToMarkers();
}

init();
