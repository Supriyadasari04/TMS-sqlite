window.onload = function () {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || currentUser.role !== "agent") {
    window.location.href = "signin.html";
    return;
  }

  document.getElementById("agent-name").innerText = currentUser.username;

  if (currentUser.password === "Ticketpro@123" || currentUser.needsPasswordReset) {
    showPasswordResetModal();
  }

  renderStats();
  renderAllTabs();
  updateNotifCount();
};

/* ==============================
   Password Reset Modal
============================== */
function showPasswordResetModal() {
  const modal = document.getElementById("password-reset-modal");
  modal.style.display = "flex";

  document.getElementById("save-new-password").onclick = function () {
    const newPass = document.getElementById("new-password").value.trim();
    const confirm = document.getElementById("confirm-password").value.trim();

    if (!newPass || !confirm) return alert("Please fill both fields.");
    if (newPass !== confirm) return alert("Passwords do not match!");
    if (newPass === "Ticketpro@123") return alert("Please choose a different password.");

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

/* ==============================
   Ticket Handling
============================== */
function filterTickets(tickets, search) {
  return tickets.filter(t =>
    t.title.toLowerCase().includes(search) ||
    t.accountHolder?.toLowerCase().includes(search) ||
    String(t.id).includes(search)
  );
}

function renderAssigned() {
  const search = document.getElementById("search-assigned").value.toLowerCase();
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const assigned = filterTickets(tickets, search).filter(t => t.assignedTo === currentUser.username);

  const container = document.getElementById("assigned-list");
  if (assigned.length === 0) {
    container.innerHTML = `<p class="empty-text">No assigned tickets</p>`;
    return;
  }

  container.innerHTML = assigned.map(t => `
    <div class="ticket-card">
      <h4>${t.title}</h4>
      <p><strong>Ticket ID:</strong> #${t.id}</p>
      <p><strong>Impact Level:</strong> ${t.impact}</p>
      <p><strong>Description:</strong> ${t.description || 'N/A'}</p>
      <p><strong>Account Holder:</strong> ${t.accountHolder}</p>
      <p><strong>Status:</strong> ${t.status}</p>
      <div style="display:flex; gap:10px;">
        <label><strong>Update Status:</strong></label>
        <select onchange="updateStatus('${t.id}', this.value)">
          <option value="Pending" ${t.status === "Pending" ? "selected" : ""}>Pending</option>
          <option value="In Progress" ${t.status === "In Progress" ? "selected" : ""}>In Progress</option>
          <option value="Resolved" ${t.status === "Resolved" ? "selected" : ""}>Resolved</option>
        </select>
      </div>
    </div>
  `).join("");
}

function renderInProgress() {
  const search = document.getElementById("search-inprogress").value.toLowerCase();
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const inProgress = filterTickets(tickets, search).filter(t => t.assignedTo === currentUser.username && t.status === "In Progress");

  const container = document.getElementById("inprogress-list");
  if (inProgress.length === 0) {
    container.innerHTML = `<p class="empty-text">No in-progress tickets</p>`;
    return;
  }

  container.innerHTML = inProgress.map(t => `
    <div class="ticket-card">
      <h4>${t.title}</h4>
      <p><strong>Ticket ID:</strong> #${t.id}</p>
      <p><strong>Impact Level:</strong> ${t.impact}</p>
      <p><strong>Description:</strong> ${t.description || 'N/A'}</p>
      <p><strong>Account Holder:</strong> ${t.accountHolder}</p>
      <p><strong>Status:</strong> ${t.status}</p>
    </div>
  `).join("");
}

function renderResolved() {
  const search = document.getElementById("search-resolved").value.toLowerCase();
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const resolved = filterTickets(tickets, search).filter(t => t.assignedTo === currentUser.username && t.status === "Resolved");

  const container = document.getElementById("resolved-list");
  if (resolved.length === 0) {
    container.innerHTML = `<p class="empty-text">No resolved tickets</p>`;
    return;
  }

  container.innerHTML = resolved.map(t => `
    <div class="ticket-card">
      <h4>${t.title}</h4>
      <p><strong>Ticket ID:</strong> #${t.id}</p>
      <p><strong>Impact Level:</strong> ${t.impact}</p>
      <p><strong>Description:</strong> ${t.description || 'N/A'}</p>
      <p><strong>Account Holder:</strong> ${t.accountHolder}</p>
      <p><strong>Status:</strong> ${t.status}</p>
    </div>
  `).join("");
}

function updateStatus(ticketId, newStatus) {
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  ticket.status = newStatus;
  localStorage.setItem("tickets", JSON.stringify(tickets));

  // --- Notifications ---
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const customer = users.find(u => u.email === ticket.createdBy);
  const admin = users.find(u => u.role === "admin");

  if (customer) {
    addNotification({
      message: `Status of your ticket #${ticket.id} has been changed to "${newStatus}".`,
      role: "customer",
      email: customer.email,
      timestamp: new Date().toLocaleString()
    });
  }

  if (admin) {
    addNotification({
      message: `Ticket #${ticket.id} status changed to "${newStatus}" by ${ticket.assignedTo}.`,
      role: "admin",
      timestamp: new Date().toLocaleString()
    });
  }

  renderStats();
  renderAllTabs();
  updateNotifCount();
}

/* ==============================
   Stats and Tabs
============================== */
function renderStats() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const myTickets = tickets.filter(t => t.assignedTo === currentUser.username);

  document.getElementById("assigned-tickets").innerText = myTickets.length;
  document.getElementById("pending-tickets").innerText = myTickets.filter(t => t.status === "Pending").length;
  document.getElementById("inprogress-tickets").innerText = myTickets.filter(t => t.status === "In Progress").length;
  document.getElementById("resolved-tickets").innerText = myTickets.filter(t => t.status === "Resolved").length;
}

function renderAllTabs() {
  renderAssigned();
  renderInProgress();
  renderResolved();
}

function showTab(tab) {
  ["assigned", "inprogress", "resolved"].forEach(name => {
    document.getElementById(`${name}-section`).style.display = tab === name ? "block" : "none";
    document.getElementById(`tab-${name}`).classList.toggle("active-tab", tab === name);
  });
}

/* ==============================
   Search Listeners
============================== */
document.getElementById("search-assigned").addEventListener("input", renderAssigned);
document.getElementById("search-inprogress").addEventListener("input", renderInProgress);
document.getElementById("search-resolved").addEventListener("input", renderResolved);

window.addEventListener("storage", e => {
  if (e.key === "tickets") {
    renderStats();
    renderAllTabs();
  }
});

/* ==============================
   Notifications
============================== */
function toggleNotifications() {
  const panel = document.getElementById("notif-panel");
  if (panel.style.display === "block") {
    panel.style.display = "none";
  } else {
    renderNotifications();
    panel.style.display = "block";
  }
}

function renderNotifications() {
  const notifList = document.getElementById("notif-list");
  const sortValue = document.getElementById("notif-sort").value;
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  let notifications = JSON.parse(localStorage.getItem("notifications")) || [];

  notifications = notifications.filter(n => !n.read && (n.email === currentUser.email || n.role === currentUser.role));

  if (sortValue === "latest") {
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else if (sortValue === "earliest") {
    notifications.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  notifList.innerHTML = notifications.length
    ? notifications.map((n, index) => `
      <div class="notif-item">
        <div>
          <small>${n.timestamp}</small>
          <p>${n.message}</p>
        </div>
        <button class="mark-read-btn" onclick="markAsRead(${index})">&times;</button>
      </div>
    `).join("")
    : "<p style='text-align:center;'>No new notifications.</p>";

  document.getElementById("notif-count").innerText = notifications.length;
}

function markAsRead(index) {
  let notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const userNotifications = notifications.filter(n => n.email === currentUser.email || n.role === currentUser.role);

  if (userNotifications[index]) {
    const notifIndex = notifications.findIndex(n => n.timestamp === userNotifications[index].timestamp && n.message === userNotifications[index].message);
    if (notifIndex > -1) notifications[notifIndex].read = true;
  }

  localStorage.setItem("notifications", JSON.stringify(notifications));
  renderNotifications();
}

document.getElementById("clear-all-notifs").onclick = () => {
  let notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  notifications = notifications.map(n => {
    if (n.email === currentUser.email || n.role === currentUser.role) n.read = true;
    return n;
  });

  localStorage.setItem("notifications", JSON.stringify(notifications));
  renderNotifications();
};

document.getElementById("notif-sort").addEventListener("change", renderNotifications);

function updateNotifCount() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  const userNotifs = notifications.filter(n => !n.read && (n.email === currentUser.email || n.role === currentUser.role));
  document.getElementById("notif-count").innerText = userNotifs.length;
}

function addNotification(notif) {
  const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  notifications.push({ ...notif, read: false });
  localStorage.setItem("notifications", JSON.stringify(notifications));
}
