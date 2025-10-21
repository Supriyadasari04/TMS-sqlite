// ===== On Page Load =====
window.onload = async function () {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || currentUser.role !== "agent") {
    window.location.href = "signin.html";
    return;
  }

  document.getElementById("agent-name").innerText = currentUser.username;

  if (currentUser.password === "Ticketpro@123" || currentUser.needsPasswordReset) {
    showPasswordResetModal();
  }

  // Event listeners for search
  document.getElementById("search-assigned").addEventListener("input", renderAssigned);
  document.getElementById("search-inprogress").addEventListener("input", renderInProgress);
  document.getElementById("search-resolved").addEventListener("input", renderResolved);

  await renderStats();
  await renderAllTabs();
  await updateNotifCount();
};

/* ==============================
   Password Reset Modal
============================== */
async function showPasswordResetModal() {
  const modal = document.getElementById("password-reset-modal");
  modal.style.display = "flex";

  document.getElementById("save-new-password").onclick = async function () {
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

    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      const response = await fetch(`http://localhost:3000/api/user/${currentUser.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: newPass,
          isPasswordReset: true  // This tells the backend to skip current password verification
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      // Update local storage
      const updatedUser = { ...currentUser, password: newPass, needsPasswordReset: false };
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));

      alert("Password updated successfully!");
      modal.style.display = "none";
    } catch (error) {
      alert(error.message);
    }
  };
}

/* ==============================
   Stats and Tabs
============================== */
async function renderStats() {
  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    const response = await fetch(`http://localhost:3000/api/agent/stats?agentUsername=${currentUser.username}`);
    const stats = await response.json();

    document.getElementById("assigned-tickets").innerText = stats.total || 0;
    document.getElementById("pending-tickets").innerText = stats.pending || 0;
    document.getElementById("inprogress-tickets").innerText = stats.inProgress || 0;
    document.getElementById("resolved-tickets").innerText = stats.resolved || 0;
  } catch (error) {
    console.error('Error fetching agent stats:', error);
  }
}

function showTab(tab) {
  ["assigned", "inprogress", "resolved"].forEach(name => {
    document.getElementById(`${name}-section`).style.display = tab === name ? "block" : "none";
    document.getElementById(`tab-${name}`).classList.toggle("active-tab", tab === name);
  });
}

/* ==============================
   Ticket Handling
============================== */
async function renderAssigned() {
  const search = document.getElementById("search-assigned").value.toLowerCase();
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3000/api/agent/tickets?agentUsername=${currentUser.username}&status=all&search=${search}`);
    const assignedTickets = await response.json();
    
    const container = document.getElementById("assigned-list");
    if (!assignedTickets.length) {
      container.innerHTML = `<p class="empty-text">No assigned tickets</p>`;
      return;
    }

    container.innerHTML = assignedTickets.map(ticket => `
      <div class="ticket-card">
        <h4>${ticket.title}</h4>
        <p><strong>Ticket ID:</strong> #${ticket.id}</p>
        <p><strong>Impact Level:</strong> ${ticket.impact}</p>
        <p><strong>Description:</strong> ${ticket.description || 'N/A'}</p>
        <p><strong>Account Holder:</strong> ${ticket.accountHolder}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <div style="display:flex; gap:10px;">
          <label><strong>Update Status:</strong></label>
          <select onchange="updateStatus('${ticket.id}', this.value)">
            <option value="Pending" ${ticket.status === "Pending" ? "selected" : ""}>Pending</option>
            <option value="In Progress" ${ticket.status === "In Progress" ? "selected" : ""}>In Progress</option>
            <option value="Resolved" ${ticket.status === "Resolved" ? "selected" : ""}>Resolved</option>
          </select>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error('Error fetching assigned tickets:', error);
  }
}

async function renderInProgress() {
  const search = document.getElementById("search-inprogress").value.toLowerCase();
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3000/api/agent/tickets?agentUsername=${currentUser.username}&status=In Progress&search=${search}`);
    const inProgressTickets = await response.json();
    
    const container = document.getElementById("inprogress-list");
    if (!inProgressTickets.length) {
      container.innerHTML = `<p class="empty-text">No in-progress tickets</p>`;
      return;
    }

    container.innerHTML = inProgressTickets.map(ticket => `
      <div class="ticket-card">
        <h4>${ticket.title}</h4>
        <p><strong>Ticket ID:</strong> #${ticket.id}</p>
        <p><strong>Impact Level:</strong> ${ticket.impact}</p>
        <p><strong>Description:</strong> ${ticket.description || 'N/A'}</p>
        <p><strong>Account Holder:</strong> ${ticket.accountHolder}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
      </div>
    `).join("");
  } catch (error) {
    console.error('Error fetching in-progress tickets:', error);
  }
}

async function renderResolved() {
  const search = document.getElementById("search-resolved").value.toLowerCase();
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3000/api/agent/tickets?agentUsername=${currentUser.username}&status=Resolved&search=${search}`);
    const resolvedTickets = await response.json();
    
    const container = document.getElementById("resolved-list");
    if (!resolvedTickets.length) {
      container.innerHTML = `<p class="empty-text">No resolved tickets</p>`;
      return;
    }

    container.innerHTML = resolvedTickets.map(ticket => `
      <div class="ticket-card">
        <h4>${ticket.title}</h4>
        <p><strong>Ticket ID:</strong> #${ticket.id}</p>
        <p><strong>Impact Level:</strong> ${ticket.impact}</p>
        <p><strong>Description:</strong> ${ticket.description || 'N/A'}</p>
        <p><strong>Account Holder:</strong> ${ticket.accountHolder}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
      </div>
    `).join("");
  } catch (error) {
    console.error('Error fetching resolved tickets:', error);
  }
}

async function renderAllTabs() {
  await renderAssigned();
  await renderInProgress();
  await renderResolved();
}

async function updateStatus(ticketId, newStatus) {
  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    const response = await fetch(`http://localhost:3000/api/tickets/${ticketId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: newStatus,
        agentUsername: currentUser.username
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    await renderStats();
    await renderAllTabs();
    await updateNotifCount();
  } catch (error) {
    alert(error.message);
  }
}

/* ==============================
   Notifications
============================== */
async function toggleNotifications() {
  const panel = document.getElementById("notif-panel");
  if (panel.style.display === "block") {
    panel.style.display = "none";
  } else {
    await renderNotifications();
    panel.style.display = "block";
  }
}

async function renderNotifications() {
  const notifList = document.getElementById("notif-list");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3000/api/notifications?email=${currentUser.email}&role=${currentUser.role}`);
    let notifications = await response.json();

    const sortValue = document.getElementById("notif-sort").value;
    if (sortValue === "latest") {
      notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (sortValue === "earliest") {
      notifications.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    notifList.innerHTML = notifications.length
      ? notifications.map(notification => `
        <div class="notif-item">
          <div>
            <small>${notification.timestamp}</small>
            <p>${notification.message}</p>
          </div>
          <button class="mark-read-btn" onclick="markAsRead('${notification.id}')" title="Mark as Read">&times;</button>
        </div>
      `).join("")
      : "<p style='text-align:center;'>No new notifications.</p>";

    document.getElementById("notif-count").innerText = notifications.length;
  } catch (error) {
    console.error('Error fetching notifications:', error);
  }
}

async function markAsRead(notificationId) {
  try {
    await fetch(`http://localhost:3000/api/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
    await renderNotifications();
    await updateNotifCount();
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

async function updateNotifCount() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3000/api/notifications?email=${currentUser.email}&role=${currentUser.role}`);
    const notifications = await response.json();
    document.getElementById("notif-count").innerText = notifications.length;
  } catch (error) {
    console.error('Error updating notification count:', error);
  }
}

// Clear all notifications
document.getElementById("clear-all-notifs").onclick = async () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch('http://localhost:3000/api/notifications/read-all', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: currentUser.email,
        role: currentUser.role
      })
    });

    await renderNotifications();
    await updateNotifCount();
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
};

document.getElementById("notif-sort").addEventListener("change", renderNotifications);