// ===== On Page Load =====
window.onload = function () {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || currentUser.role !== "admin") {
    window.location.href = "signin.html";
    return;
  }

  document.getElementById("admin-name").innerText = currentUser.username;

  if (currentUser.password === "Ticketpro@123" || currentUser.needsPasswordReset) {
    showPasswordResetModal();
  }

  document.getElementById("search-button").addEventListener("click", () => {
    const field = document.getElementById("search-field-dropdown").value;
    const query = document.getElementById("search-input").value.trim();

    if (!query) {
      alert("Please enter a value to search.");
      return;
    }

    const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
    const filtered = filterTicketsByField(tickets, field, query);

    renderFilteredTickets(filtered);
  });

  document.getElementById("clear-search-button").addEventListener("click", () => {
    document.getElementById("search-input").value = "";
    renderTickets();
  });

  document.getElementById("add-user-btn").addEventListener("click", () => {
    document.getElementById("add-user-container").style.display = "flex";
  });

  document.getElementById("cancel-user-btn").addEventListener("click", () => {
    document.getElementById("add-user-container").style.display = "none";
    clearUserInputs();
  });

  document.getElementById("save-user-btn").addEventListener("click", () => {
    saveUser();
  });

  updateNotifCount();
  renderStats();
  renderTickets();
  renderUsers();
};

// ===== Password Reset =====
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

// ===== Logout =====
function logout() {
  localStorage.removeItem("currentUser");
  window.location.href = "signin.html";
}

// ===== Stats =====
function renderStats() {
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];

  document.getElementById("total-tickets").innerText = tickets.length;
  document.getElementById("pending-tickets").innerText = tickets.filter(t => t.status === "Pending").length;
  document.getElementById("inprogress-tickets").innerText = tickets.filter(t => t.status === "In Progress").length;
  document.getElementById("resolved-tickets").innerText = tickets.filter(t => t.status === "Resolved").length;
}

// ===== Tickets =====
function renderTickets() {
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const agents = users.filter(u => u.role === "agent");
  const container = document.getElementById("tickets-list");

  if (tickets.length === 0) {
    container.innerHTML = `<p class="empty-text">No tickets found</p>`;
    return;
  }

  container.innerHTML = tickets
    .map((t, index) => {
      const assignedTo = t.assignedTo || "";
      const agentOptions = agents
        .map(agent => `<option value="${agent.username}" ${agent.username === assignedTo ? "selected" : ""}>${agent.username}</option>`)
        .join("");

      return `
      <div class="ticket-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4>Issue: ${t.title}</h4>
          <button class="btn-delete" onclick="deleteTicket(${index})">Delete</button>
        </div>
        <p><strong>Ticket ID:</strong> #${t.id}</p>
        <p><strong>Impact Level:</strong> ${t.impact || "N/A"}</p>
        <p><strong>Account Holder:</strong> ${t.accountHolder || "N/A"}</p>
        <p><strong>Status:</strong> ${t.status}</p>
        <div style="display:flex;align-items:center;gap:10px;">
          <p style="margin:0;"><strong>Assigned To:</strong></p>
          <select onchange="assignAgent('${t.id}', this.value)">
            <option value="">Not assigned</option>
            ${agentOptions}
          </select>
        </div>
      </div>`;
    }).join("");
}

function filterTicketsByField(tickets, field, query) {
  query = query.toLowerCase();
  return tickets.filter(ticket => {
    let fieldValue = ticket[field] || "";
    return String(fieldValue).toLowerCase().includes(query);
  });
}

function assignAgent(ticketId, agentUsername) {
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const ticketIndex = tickets.findIndex(t => t.id === ticketId);
  if (ticketIndex === -1) return;

  tickets[ticketIndex].assignedTo = agentUsername;
  tickets[ticketIndex].status = agentUsername ? "In Progress" : "Pending";
  localStorage.setItem("tickets", JSON.stringify(tickets));

  const users = JSON.parse(localStorage.getItem("users")) || [];
  const ticket = tickets[ticketIndex];
  const customer = users.find(u => u.email === ticket.createdBy);
  const agent = users.find(u => u.username === agentUsername);
  const admin = JSON.parse(localStorage.getItem("currentUser"));

  if (customer && agentUsername) {
    addNotification({ message: `Your ticket #${ticket.id} has been assigned to agent ${agentUsername}.`, role: "customer", email: customer.email, timestamp: new Date().toLocaleString() });
  }
  if (agent && agentUsername) {
    addNotification({ message: `You have been assigned to ticket #${ticket.id} (${ticket.title}).`, role: "agent", email: agent.email, timestamp: new Date().toLocaleString() });
  }
  if (admin) {
    addNotification({ message: `Ticket #${ticket.id} assigned to agent ${agentUsername}. Please monitor progress.`, role: "admin", timestamp: new Date().toLocaleString() });
  }

  renderTickets();
  renderStats();
  updateNotifCount();
}

// ===== Users =====
function renderUsers() {
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const container = document.getElementById("users-list");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  if (!users.length) {
    container.innerHTML = `<p class="empty-text">No users found</p>`;
    return;
  }

  const roleOrder = { admin: 1, agent: 2, customer: 3 };
  users.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

  container.innerHTML = users.map((u, index) => `
    <div class="user-card">
      <div class="user-info">
        <div class="user-avatar">👤</div>
        <div>
          <h4>${u.username}</h4>
          <p>${u.email}</p>
        </div>
      </div>
      <div class="user-actions">
        <span class="role-badge ${u.role.toLowerCase()}">${u.role.toUpperCase()}</span>
        ${currentUser && u.email === currentUser.email
          ? `<button class="btn-delete" style="opacity:0.5; cursor:not-allowed;" disabled>Delete</button>`
          : `<button class="btn-delete" onclick="deleteUser(${index})">Delete</button>`}
      </div>
    </div>`).join("");
}

function saveUser() {
  const username = document.getElementById("new-username").value.trim();
  const email = document.getElementById("new-email").value.trim();
  const role = document.getElementById("new-role").value;

  if (!username || !email) {
    alert("Please fill in all fields.");
    return;
  }

  const users = JSON.parse(localStorage.getItem("users")) || [];
  if (users.find(u => u.username === username || u.email === email)) {
    alert("Username or email already exists.");
    return;
  }

  users.push({ email, username, password: "Ticketpro@123", role });
  localStorage.setItem("users", JSON.stringify(users));

  renderUsers();
  clearUserInputs();
  document.getElementById("add-user-container").style.display = "none";
}

function clearUserInputs() {
  document.getElementById("new-username").value = "";
  document.getElementById("new-email").value = "";
  document.getElementById("new-role").value = "customer";
}

function deleteUser(index) {
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const targetUser = users[index];

  if (currentUser && targetUser.email === currentUser.email) {
    alert("You cannot delete your own account.");
    return;
  }

  if (!confirm(`Delete user "${targetUser.username}"?`)) return;

  users.splice(index, 1);
  localStorage.setItem("users", JSON.stringify(users));
  renderUsers();
}

function deleteTicket(index) {
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const targetTicket = tickets[index];

  if (!confirm(`Are you sure you want to delete ticket "${targetTicket.title}"?`)) return;

  tickets.splice(index, 1);
  localStorage.setItem("tickets", JSON.stringify(tickets));
  renderTickets();
  renderStats();
  alert("Ticket deleted successfully!");
}

function showTab(tab) {
  document.getElementById("ticket-management").style.display = tab === "tickets" ? "block" : "none";
  document.getElementById("user-management").style.display = tab === "users" ? "block" : "none";
  document.getElementById("tab-tickets").classList.toggle("active-tab", tab === "tickets");
  document.getElementById("tab-users").classList.toggle("active-tab", tab === "users");
}

// ===== Filter Tickets =====
function renderFilteredTickets(filteredTickets) {
  const container = document.getElementById("tickets-list");
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const agents = users.filter(u => u.role === "agent");
  const allTickets = JSON.parse(localStorage.getItem("tickets")) || [];

  if (!filteredTickets.length) {
    container.innerHTML = `<p class="empty-text">No tickets found</p>`;
    return;
  }

  container.innerHTML = filteredTickets.map(filteredTicket => {
    const index = allTickets.findIndex(t => t.id === filteredTicket.id);
    const assignedTo = filteredTicket.assignedTo || "";
    const agentOptions = agents.map(agent => `<option value="${agent.username}" ${agent.username === assignedTo ? "selected" : ""}>${agent.username}</option>`).join("");

    return `
      <div class="ticket-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4>Issue: ${filteredTicket.title}</h4>
          <button class="btn-delete" onclick="deleteTicket(${index})">Delete</button>
        </div>
        <p><strong>Ticket ID:</strong> ${filteredTicket.id}</p>
        <p><strong>Impact Level:</strong> ${filteredTicket.impact || 'N/A'}</p>
        <p><strong>Account Holder:</strong> ${filteredTicket.accountHolder || 'N/A'}</p>
        <p><strong>Status:</strong> ${filteredTicket.status}</p>
        <div style="display:flex;align-items:center;gap:10px;">
          <p style="margin:0;"><strong>Assigned To:</strong></p>
          <select onchange="assignAgent('${filteredTicket.id}', this.value)">
            <option value="">Not assigned</option>
            ${agentOptions}
          </select>
        </div>
      </div>`;
  }).join("");
}

// ===== Notifications =====
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

  // Filter for this user or role
  notifications = notifications.filter(n => !n.read && (n.email === currentUser.email || n.role === currentUser.role));

  // Sorting
  if (sortValue === "latest") {
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else if (sortValue === "earliest") {
    notifications.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  notifList.innerHTML = "";
  if (!notifications.length) {
    notifList.innerHTML = "<p style='text-align:center;'>No new notifications.</p>";
    document.getElementById("notif-count").innerText = "0";
    return;
  }

  notifications.forEach((n, index) => {
    const notifEl = document.createElement("div");
    notifEl.classList.add("notif-item");

    notifEl.innerHTML = `
      <div>
        <small>${n.timestamp}</small>
        <p>${n.message}</p>
      </div>
      <button class="mark-read-btn" onclick="markAsRead(${index})" title="Mark as Read">&times;</button>
    `;

    notifList.appendChild(notifEl);
  });

  document.getElementById("notif-count").innerText = notifications.length;
}

// Mark as read
function markAsRead(index) {
  let notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const userNotifications = notifications.filter(n => n.email === currentUser.email || n.role === currentUser.role);

  if (userNotifications[index]) {
    const notifIndex = notifications.findIndex(n => n.timestamp === userNotifications[index].timestamp && n.message === userNotifications[index].message);
    if (notifIndex > -1) {
      notifications[notifIndex].read = true;
    }
  }

  localStorage.setItem("notifications", JSON.stringify(notifications));
  renderNotifications();
}

// Clear all notifications
document.getElementById("clear-all-notifs").onclick = () => {
  let notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  notifications = notifications.map(n => {
    if (n.email === currentUser.email || n.role === currentUser.role) {
      n.read = true;
    }
    return n;
  });

  localStorage.setItem("notifications", JSON.stringify(notifications));
  renderNotifications();
};

// Sort change
document.getElementById("notif-sort").addEventListener("change", renderNotifications);

function updateNotifCount() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  const userNotifs = notifications.filter(n => !n.read && (n.email === currentUser.email || n.role === currentUser.role));
  document.getElementById("notif-count").innerText = userNotifs.length;
}
