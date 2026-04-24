const SERVICES = ["instagram", "facebook", "whatsapp"];
const SERVICE_LABELS = {
  instagram: "Instagram",
  facebook: "Messenger",
  whatsapp: "WhatsApp"
};

const serviceSections = document.getElementById("service-sections");
const clientForm = document.getElementById("client-form");
const clientsList = document.getElementById("clients-list");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const formMessage = document.getElementById("form-message");

let editingClientId = null;
let currentClients = [];

function buildServiceForm() {
  const wrapper = document.createElement("div");
  wrapper.className = "services-grid";

  SERVICES.forEach((service) => {
    const box = document.createElement("div");
    box.className = "service-box";
    box.innerHTML = `
      <h3>${SERVICE_LABELS[service]}</h3>
      <label class="service-toggle">
        <input type="checkbox" id="${service}-enabled" />
        Enabled
      </label>
      <label>
        Account ID
        <input type="text" id="${service}-meta-id" placeholder="Instagram account ID / Facebook page ID / WhatsApp phone_number_id" />
      </label>
      <label>
        Webhook URL
        <input type="url" id="${service}-callback-url" placeholder="https://your-app.com/api/meta/webhook" />
      </label>
      <label>
        Verify Token
        <input type="text" id="${service}-token" placeholder="client-specific-token" />
      </label>
    `;
    wrapper.appendChild(box);
  });

  serviceSections.appendChild(wrapper);
}

function getClientPayload() {
  const name = document.getElementById("client-name").value.trim();
  const services = {};

  SERVICES.forEach((service) => {
    services[service] = {
      enabled: document.getElementById(`${service}-enabled`).checked,
      meta_id: document.getElementById(`${service}-meta-id`).value.trim(),
      callback_url: document.getElementById(`${service}-callback-url`).value.trim(),
      token: document.getElementById(`${service}-token`).value.trim()
    };
  });

  return { name, services };
}

function setFormMessage(message, tone = "") {
  formMessage.textContent = message;
  formMessage.className = `form-message ${tone}`.trim();
}

function enterAddMode() {
  editingClientId = null;
  formTitle.textContent = "Add Client App";
  submitBtn.textContent = "Add Client";
  cancelEditBtn.classList.add("hidden");
}

function resetForm() {
  clientForm.reset();
  setFormMessage("");
  enterAddMode();
}

async function createClient(payload) {
  const response = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || "Failed to create client");
  }
}

async function updateClient(clientId, payload) {
  const response = await fetch(`/api/clients/${clientId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || "Failed to update client");
  }
}

async function deleteClient(clientId) {
  const response = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error("Failed to delete client");
  }
}

function populateFormForEdit(client) {
  editingClientId = client.id;
  formTitle.textContent = `Edit Client: ${client.name}`;
  submitBtn.textContent = "Save Changes";
  cancelEditBtn.classList.remove("hidden");
  setFormMessage("Editing existing client configuration.", "info");

  document.getElementById("client-name").value = client.name;

  SERVICES.forEach((service) => {
    const cfg = client.services?.[service] || {};
    document.getElementById(`${service}-enabled`).checked = Boolean(cfg.enabled);
    document.getElementById(`${service}-meta-id`).value = cfg.meta_id || "";
    document.getElementById(`${service}-callback-url`).value = cfg.callback_url || "";
    document.getElementById(`${service}-token`).value = cfg.token || "";
  });
}

function renderServiceDetails(services) {
  return SERVICES.map((service) => {
    const cfg = services[service];
    if (!cfg || !cfg.enabled) {
      return `<li><strong>${SERVICE_LABELS[service]}</strong>: <span class="muted">disabled</span></li>`;
    }

    return `<li><strong>${SERVICE_LABELS[service]}</strong>: account_id=${cfg.meta_id || "-"}, webhook_url=${cfg.callback_url || "-"}, token=${cfg.token || "-"}</li>`;
  }).join("");
}

async function loadClients() {
  const response = await fetch("/api/clients");
  const body = await response.json();
  const clients = body.data || [];
  currentClients = clients;

  if (clients.length === 0) {
    clientsList.innerHTML = `<p class="muted">No clients configured yet.</p>`;
    return;
  }

  clientsList.innerHTML = clients
    .map(
      (client) => `
      <article class="client-item">
        <h3>${client.name}</h3>
        <p class="muted">Client ID: ${client.id}</p>
        <ul>${renderServiceDetails(client.services)}</ul>
        <div class="client-actions">
          <button class="edit-btn" data-id="${client.id}">Edit</button>
          <button class="delete-btn" data-id="${client.id}">Delete</button>
        </div>
      </article>
    `
    )
    .join("");

}

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = getClientPayload();
    if (editingClientId) {
      await updateClient(editingClientId, payload);
      await loadClients();
      resetForm();
      setFormMessage("Client updated successfully.", "success");
    } else {
      await createClient(payload);
      await loadClients();
      resetForm();
      setFormMessage("Client created successfully.", "success");
    }
  } catch (error) {
    setFormMessage(error.message, "error");
  }
});

cancelEditBtn.addEventListener("click", () => {
  resetForm();
});

clientsList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const editBtn = target.closest(".edit-btn");
  if (editBtn) {
    const clientId = editBtn.getAttribute("data-id");
    if (!clientId) {
      return;
    }
    const client = currentClients.find((item) => item.id === clientId);
    if (!client) {
      setFormMessage("Client not found.", "error");
      return;
    }
    populateFormForEdit(client);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const deleteBtn = target.closest(".delete-btn");
  if (deleteBtn) {
    const clientId = deleteBtn.getAttribute("data-id");
    if (!clientId) {
      return;
    }
    const confirmed = window.confirm("Delete this client configuration?");
    if (!confirmed) {
      return;
    }
    try {
      await deleteClient(clientId);
      if (editingClientId === clientId) {
        resetForm();
      }
      await loadClients();
      setFormMessage("Client deleted successfully.", "success");
    } catch (error) {
      setFormMessage(error.message, "error");
    }
  }
});

buildServiceForm();
enterAddMode();
loadClients();
