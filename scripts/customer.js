window.onload = function () {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || currentUser.role !== "customer") {
    window.location.href = "signin.html";
    return;
  }

  document.getElementById("customer-name").innerText = currentUser.username;

  // 🚨 Check if password reset is required
  if (currentUser.password === "Ticketpro@123" || currentUser.needsPasswordReset) {
    showPasswordResetModal();
  }

  renderTickets();
  updateStats();
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


// Elements
const modal = document.getElementById("ticket-modal");
const openModalBtn = document.getElementById("open-modal-btn");
const cancelBtn = document.getElementById("cancel-ticket");
const saveBtn = document.getElementById("save-ticket");

openModalBtn.addEventListener("click", () => (modal.style.display = "flex"));
cancelBtn.addEventListener("click", () => (modal.style.display = "none"));

saveBtn.addEventListener("click", () => {
  const subject = document.getElementById("ticket-subject").value;
  const description = document.getElementById("ticket-description").value.trim();
  const impact = document.getElementById("impact").value;
  const accountHolder = document.getElementById("account-holder").value.trim();
  const accountNumber = document.getElementById("account-number").value.trim();
  const ifscCode = document.getElementById("ifsc-code").value.trim();

  if (!subject || !description || !impact || !accountHolder || !accountNumber || !ifscCode) {
    alert("Please fill all required fields.");
    return;
  }

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];

  const newTicket = {
    id: "TCKT-" + Date.now(),
    title: subject,
    description,
    impact,
    accountHolder,
    accountNumber,
    ifscCode,
    status: "Pending",
    createdBy: currentUser.email,
    createdAt: new Date().toLocaleString(),
    assignedTo: null,
  };

  tickets.push(newTicket);
  localStorage.setItem("tickets", JSON.stringify(tickets));

  alert("Ticket created successfully!");

  // Notify admin
addNotification({
  message: `New ticket created by ${currentUser.username}: #${newTicket.id}`,
  role: "admin",
  timestamp: new Date().toLocaleString()
});

addNotification({
  message: `Your ticket #${newTicket.id} has been created successfully. Our team will reach out soon.`,
  role: "customer",
  email: currentUser.email,
  timestamp: new Date().toLocaleString()
});


  modal.style.display = "none";
  clearInputs();
  renderTickets();
  updateStats();
});

function clearInputs() {
  document.getElementById("ticket-subject").value = "";
  document.getElementById("impact").value = "";
  document.getElementById("ticket-description").value = "";
  document.getElementById("account-holder").value = "";
  document.getElementById("account-number").value = "";
  document.getElementById("ifsc-code").value = "";
}

function renderTickets() {
  const container = document.getElementById("tickets-container");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];

  const userTickets = tickets.filter(t => t.createdBy === currentUser.email);

  if (userTickets.length === 0) {
    container.innerHTML = `<p class="empty-text">No tickets yet</p>`;
    return;
  }

  container.innerHTML = userTickets.map(t => `
    <div class="ticket-card">
      <h4>${t.title}</h4>
      <p><strong>Ticket ID:</strong> #${t.id}</p>
      <p><strong>Description:</strong> ${t.description}</p>
      <p><strong>Impact Level:</strong> ${t.impact}</p>
      <p><strong>Status:</strong> ${t.status}</p>
      <p><strong>Assigned To:</strong> ${t.assignedTo ? t.assignedTo : '<span style="color:gray">Not assigned yet</span>'}</p>
    </div>
  `).join("");
}

function updateStats() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const userTickets = tickets.filter(t => t.createdBy === currentUser.email);

  document.getElementById("total-tickets").innerText = userTickets.length;
  document.getElementById("pending-tickets").innerText = userTickets.filter(t => t.status === "Pending").length;
  document.getElementById("inprogress-tickets").innerText = userTickets.filter(t => t.status === "In Progress").length;
  document.getElementById("resolved-tickets").innerText = userTickets.filter(t => t.status === "Resolved").length;
}

/* ==============================
   Notifications Popup Feature
============================== */
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
