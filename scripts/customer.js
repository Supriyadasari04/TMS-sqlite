/* ============================================
   Customer Dashboard Script – TicketPro
   ============================================ */

// === On Page Load ===
window.onload = function () {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || currentUser.role !== "customer") {
    window.location.href = "signin.html";
    return;
  }

  document.getElementById("customer-name").innerText = currentUser.username;

  // Check if password reset is required
  if (currentUser.password === "Ticketpro@123" || currentUser.needsPasswordReset) {
    showPasswordResetModal();
  }

  renderTickets();
  updateStats();
  updateNotifCount();
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

// === Ticket Modal Handling ===
document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("ticket-modal");
  const openModalBtn = document.getElementById("open-modal-btn");
  const cancelBtn = document.getElementById("cancel-ticket");
  const saveBtn = document.getElementById("save-ticket");

  if (!modal || !openModalBtn || !cancelBtn || !saveBtn) return;

  // Open & close modal
  openModalBtn.addEventListener("click", () => (modal.style.display = "flex"));
  cancelBtn.addEventListener("click", () => (modal.style.display = "none"));

  // === Create Ticket Handler ===
  saveBtn.addEventListener("click", () => {
    const subject = document.getElementById("ticket-subject").value.trim();
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

    // Add notifications
    addNotification({
      message: `New ticket created by ${currentUser.username}: #${newTicket.id}`,
      role: "admin",
      timestamp: new Date().toLocaleString(),
    });

    addNotification({
      message: `Your ticket #${newTicket.id} has been created successfully. Our team will reach out soon.`,
      role: "customer",
      email: currentUser.email,
      timestamp: new Date().toLocaleString(),
    });

    alert("Ticket created successfully!");
    modal.style.display = "none";
    clearInputs();
    renderTickets();
    updateStats();
    updateNotifCount();
  });
});

// === Helper Functions ===
function clearInputs() {
  document.querySelectorAll("#ticket-modal input, #ticket-modal select, #ticket-modal textarea").forEach(el => {
    el.value = "";
  });
}

// === Render Tickets ===
function renderTickets() {
  const container = document.getElementById("tickets-container");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];

  const userTickets = tickets.filter(t => t.createdBy === currentUser.email);

  if (userTickets.length === 0) {
    container.innerHTML = `<p class="empty-text">No tickets yet</p>`;
    return;
  }

  container.innerHTML = userTickets
    .map(
      t => `
      <div class="ticket-card">
        <h4>${t.title}</h4>
        <p><strong>Ticket ID:</strong> #${t.id}</p>
        <p><strong>Description:</strong> ${t.description}</p>
        <p><strong>Impact Level:</strong> ${t.impact}</p>
        <p><strong>Status:</strong> ${t.status}</p>
        <p><strong>Assigned To:</strong> ${
          t.assignedTo ? t.assignedTo : '<span style="color:gray">Not assigned yet</span>'
        }</p>
      </div>`
    )
    .join("");
}

// === Update Ticket Stats ===
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
function toggleNotifications() {
  const panel = document.getElementById("notif-panel");
  panel.style.display = panel.style.display === "block" ? "none" : "block";
  if (panel.style.display === "block") renderNotifications();
}

function renderNotifications() {
  const notifList = document.getElementById("notif-list");
  const sortValue = document.getElementById("notif-sort").value;
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  let notifications = JSON.parse(localStorage.getItem("notifications")) || [];

  notifications = notifications.filter(n => !n.read && (n.email === currentUser.email || n.role === currentUser.role));

  // Sort notifications
  if (sortValue === "latest") notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  else if (sortValue === "earliest") notifications.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  notifList.innerHTML = notifications.length
    ? notifications
        .map(
          (n, index) => `
        <div class="notif-item">
          <div>
            <small>${n.timestamp}</small>
            <p>${n.message}</p>
          </div>
          <button class="mark-read-btn" onclick="markAsRead(${index})" title="Mark as Read">&times;</button>
        </div>`
        )
        .join("")
    : "<p style='text-align:center;'>No new notifications.</p>";

  document.getElementById("notif-count").innerText = notifications.length;
}

function markAsRead(index) {
  let notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const userNotifications = notifications.filter(n => n.email === currentUser.email || n.role === currentUser.role);

  if (userNotifications[index]) {
    const notifIndex = notifications.findIndex(
      n => n.timestamp === userNotifications[index].timestamp && n.message === userNotifications[index].message
    );
    if (notifIndex > -1) notifications[notifIndex].read = true;
  }

  localStorage.setItem("notifications", JSON.stringify(notifications));
  renderNotifications();
  updateNotifCount();
}

document.addEventListener("DOMContentLoaded", function () {
  const clearBtn = document.getElementById("clear-all-notifs");
  const sortSelect = document.getElementById("notif-sort");

  if (clearBtn) {
    clearBtn.onclick = () => {
      let notifications = JSON.parse(localStorage.getItem("notifications")) || [];
      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      notifications = notifications.map(n => {
        if (n.email === currentUser.email || n.role === currentUser.role) n.read = true;
        return n;
      });
      localStorage.setItem("notifications", JSON.stringify(notifications));
      renderNotifications();
      updateNotifCount();
    };
  }

  if (sortSelect) sortSelect.addEventListener("change", renderNotifications);
});

function updateNotifCount() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  const userNotifs = notifications.filter(n => !n.read && (n.email === currentUser.email || n.role === currentUser.role));
  document.getElementById("notif-count").innerText = userNotifs.length;
}

/* === Add Notification Utility === */
function addNotification(notification) {
  const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  notifications.push({ ...notification, read: false });
  localStorage.setItem("notifications", JSON.stringify(notifications));
}

/* === Get All Users Utility === */
function getUsers() {
  return JSON.parse(localStorage.getItem("users")) || [];
}
