window.onload = function () {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || currentUser.role !== "agent") {
    window.location.href = "signin.html";
    return;
  }

  document.getElementById("agent-name").innerText = currentUser.username;

  // 🚨 Require password reset if default
  if (currentUser.password === "Ticketpro@123" || currentUser.needsPasswordReset) {
    showPasswordResetModal();
  }

  renderStats();
  renderAllTabs();
};
// === Password Reset Handling ===
function showPasswordResetModal() {
  const modal = document.getElementById("password-reset-modal");
  modal.style.display = "flex";

  document.getElementById("save-new-password").onclick = function () {
    const newPass = document.getElementById("new-password").value.trim();
    const confirm = document.getElementById("confirm-password").value.trim();

    if (!newPass || !confirm) {
      alert("Please fill both fields.");
      return;
    }
    if (newPass !== confirm) {
      alert("Passwords do not match!");
      return;
    }
    if (newPass === "Ticketpro@123") {
      alert("Please choose a different password.");
      return;
    }

    // Update in localStorage
    const users = JSON.parse(localStorage.getItem("users")) || [];
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    const updatedUsers = users.map(u =>
      u.email === currentUser.email ? { ...u, password: newPass, needsPasswordReset: false } : u
    );

    localStorage.setItem("users", JSON.stringify(updatedUsers));
    localStorage.setItem("currentUser", JSON.stringify({ ...currentUser, password: newPass, needsPasswordReset: false }));

    alert("Password updated successfully!");
    modal.style.display = "none";
  };
}

// === RENDER FUNCTIONS ===

function renderAllTabs() {
  renderAssigned();
  renderInProgress();
  renderResolved();
}

function renderStats() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const myTickets = tickets.filter(t => t.assignedTo === currentUser.username);

  document.getElementById("assigned-tickets").innerText = myTickets.length;
  document.getElementById("pending-tickets").innerText = myTickets.filter(t => t.status === "Pending").length;
  document.getElementById("inprogress-tickets").innerText = myTickets.filter(t => t.status === "In Progress").length;
  document.getElementById("resolved-tickets").innerText = myTickets.filter(t => t.status === "Resolved").length;
}

function renderAssigned() {
  const container = document.getElementById("assigned-list");
  const search = document.getElementById("search-assigned").value.toLowerCase();
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const assigned = tickets.filter(
    t =>
      t.assignedTo === currentUser.username &&
      (t.title.toLowerCase().includes(search) ||
        t.accountHolder?.toLowerCase().includes(search) ||
        String(t.id).includes(search))
  );
  if (assigned.length === 0) {
    container.innerHTML = `<p class="empty-text">No assigned tickets</p>`;
    return;
  }
  container.innerHTML = assigned
    .map(
      t => `
      <div class="ticket-card">
        <h4>${t.title}</h4>
        <p><strong>Ticket ID:</strong> #${t.id}</p>
        <p><strong>Impact Level:</strong> ${t.impact}</p>
        <p><strong>Account Holder:</strong> ${t.accountHolder}</p>
        <p><strong>Status:</strong> ${t.status}</p>
        <div style="display:flex; align-items:center; gap:10px;">
          <label><strong>Update Status:</strong></label>
          <select onchange="updateStatus('${t.id}', this.value)">
            <option value="Pending" ${t.status === "Pending" ? "selected" : ""}>Pending</option>
            <option value="In Progress" ${t.status === "In Progress" ? "selected" : ""}>In Progress</option>
            <option value="Resolved" ${t.status === "Resolved" ? "selected" : ""}>Resolved</option>
          </select>
        </div>
      </div>
      `
    )
    .join("");
}

function renderInProgress() {
  const container = document.getElementById("inprogress-list");
  const search = document.getElementById("search-inprogress").value.toLowerCase();
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];

  const inProgress = tickets.filter(
    t =>
      t.assignedTo === currentUser.username &&
      t.status === "In Progress" &&
      (t.title.toLowerCase().includes(search) ||
        t.accountHolder?.toLowerCase().includes(search) ||
        String(t.id).includes(search))
  );

  if (inProgress.length === 0) {
    container.innerHTML = `<p class="empty-text">No in-progress tickets</p>`;
    return;
  }

  container.innerHTML = inProgress
    .map(
      t => `
      <div class="ticket-card">
        <h4>${t.title}</h4>
        <p><strong>Ticket ID:</strong> #${t.id}</p>
        <p><strong>Impact Level:</strong> ${t.impact}</p>
        <p><strong>Account Holder:</strong> ${t.accountHolder}</p>
        <p><strong>Status:</strong> ${t.status}</p>

        <div style="display:flex; align-items:center; gap:10px;">
          <label><strong>Update Status:</strong></label>
          <select onchange="updateStatus(${t.id}, this.value)">
            <option value="Resolved" ${t.status === "Resolved" ? "selected" : ""}>Resolved</option>
          </select>
        </div>
      </div>
    `
    )
    .join("");
}

function renderResolved() {
  const container = document.getElementById("resolved-list");
  const search = document.getElementById("search-resolved").value.toLowerCase();
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];

  const resolved = tickets.filter(
    t =>
      t.assignedTo === currentUser.username &&
      t.status === "Resolved" &&
      (t.title.toLowerCase().includes(search) ||
        t.accountHolder?.toLowerCase().includes(search) ||
        String(t.id).includes(search))
  );

  if (resolved.length === 0) {
    container.innerHTML = `<p class="empty-text">No resolved tickets</p>`;
    return;
  }

  container.innerHTML = resolved
    .map(
      t => `
      <div class="ticket-card">
        <h4>${t.title}</h4>
        <p><strong>Ticket ID:</strong> #${t.id}</p>
        <p><strong>Impact Level:</strong> ${t.impact}</p>
        <p><strong>Account Holder:</strong> ${t.accountHolder}</p>
        <p><strong>Status:</strong> <span style="color:green;font-weight:600;">Resolved</span></p>
      </div>
    `
    )
    .join("");
}

// === STATUS UPDATE ===
function updateStatus(ticketId, newStatus) {
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const index = tickets.findIndex(t => t.id === ticketId);
  if (index === -1) return;

  tickets[index].status = newStatus;
  localStorage.setItem("tickets", JSON.stringify(tickets));

  

  // Notify admin
addNotification({
  message: `Ticket #${ticketId} updated to "${newStatus}" by ${ticket.assignedTo}`,
  role: "admin",
  timestamp: new Date().toLocaleString()
});

// Notify customer
const users = JSON.parse(localStorage.getItem("users")) || [];
const customer = users.find(u => u.email === ticket.createdBy);
if (customer) {
  addNotification({
    message: `Your ticket #${ticketId} is now "${newStatus}"`,
    role: "customer",
    email: customer.email,
    timestamp: new Date().toLocaleString()
  });
}

  renderStats();
  renderAllTabs();
}

// === TAB HANDLER ===
function showTab(tab) {
  const sections = ["assigned", "inprogress", "resolved"];
  sections.forEach(name => {
    document.getElementById(`${name}-section`).style.display = tab === name ? "block" : "none";
    document.getElementById(`tab-${name}`).classList.toggle("active-tab", tab === name);
  });
}

// === SEARCH EVENT LISTENERS ===
document.getElementById("search-assigned").addEventListener("input", renderAssigned);
document.getElementById("search-inprogress").addEventListener("input", renderInProgress);
document.getElementById("search-resolved").addEventListener("input", renderResolved);

// === REALTIME UPDATES ===
window.addEventListener("storage", e => {
  if (e.key === "tickets") {
    renderStats();
    renderAllTabs();
  }
});
