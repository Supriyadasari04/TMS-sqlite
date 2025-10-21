// ===== On Page Load =====
window.onload = async function () {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || currentUser.role !== "admin") {
    window.location.href = "signin.html";
    return;
  }

  document.getElementById("admin-name").innerText = currentUser.username;

  if (currentUser.password === "Ticketpro@123" || currentUser.needsPasswordReset) {
    showPasswordResetModal();
  }

  // Event listeners
  document.getElementById("search-button").addEventListener("click", handleSearch);
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

  document.getElementById("save-user-btn").addEventListener("click", saveUser);

  await updateNotifCount();
  await renderStats();
  await renderTickets();
  await renderUsers();
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

// ===== Stats =====
async function renderStats() {
  try {
    const response = await fetch('http://localhost:3000/api/tickets/stats');
    const stats = await response.json();

    document.getElementById("total-tickets").innerText = stats.total || 0;
    document.getElementById("pending-tickets").innerText = stats.pending || 0;
    document.getElementById("inprogress-tickets").innerText = stats.inProgress || 0;
    document.getElementById("resolved-tickets").innerText = stats.resolved || 0;
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
}

// ===== Tickets =====
async function renderTickets() {
  try {
    const response = await fetch('http://localhost:3000/api/tickets');
    const tickets = await response.json();
    const agentsResponse = await fetch('http://localhost:3000/api/users');
    const users = await agentsResponse.json();
    const agents = users.filter(u => u.role === "agent");
    
    const container = document.getElementById("tickets-list");

    if (!tickets.length) {
      container.innerHTML = `<p class="empty-text">No tickets found</p>`;
      return;
    }

    container.innerHTML = tickets.map(ticket => {
      const assignedTo = ticket.assignedTo || "";
      const agentOptions = agents
        .map(agent => `<option value="${agent.username}" ${agent.username === assignedTo ? "selected" : ""}>${agent.username}</option>`)
        .join("");

      return `
      <div class="ticket-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4>Issue: ${ticket.title}</h4>
          <button class="btn-delete" onclick="deleteTicket('${ticket.id}')">Delete</button>
        </div>
        <p><strong>Ticket ID:</strong> #${ticket.id}</p>
        <p><strong>Impact Level:</strong> ${ticket.impact || "N/A"}</p>
        <p><strong>Account Holder:</strong> ${ticket.accountHolder || "N/A"}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <div style="display:flex;align-items:center;gap:10px;">
          <p style="margin:0;"><strong>Assigned To:</strong></p>
          <select onchange="assignAgent('${ticket.id}', this.value)">
            <option value="">Not assigned</option>
            ${agentOptions}
          </select>
        </div>
      </div>`;
    }).join("");
  } catch (error) {
    console.error('Error fetching tickets:', error);
  }
}

async function handleSearch() {
  const field = document.getElementById("search-field-dropdown").value;
  const query = document.getElementById("search-input").value.trim();

  if (!query) {
    alert("Please enter a value to search.");
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/api/tickets?searchField=${field}&searchValue=${query}`);
    const filteredTickets = await response.json();
    renderFilteredTickets(filteredTickets);
  } catch (error) {
    console.error('Error searching tickets:', error);
  }
}

async function assignAgent(ticketId, agentUsername) {
  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    const response = await fetch(`http://localhost:3000/api/tickets/${ticketId}/assign`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentUsername,
        adminEmail: currentUser.email
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    await renderTickets();
    await renderStats();
    await updateNotifCount();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteTicket(ticketId) {
  if (!confirm("Are you sure you want to delete this ticket?")) return;

  try {
    const response = await fetch(`http://localhost:3000/api/tickets/${ticketId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    alert("Ticket deleted successfully!");
    await renderTickets();
    await renderStats();
  } catch (error) {
    alert(error.message);
  }
}

// ===== Users =====
async function renderUsers() {
  try {
    const response = await fetch('http://localhost:3000/api/users');
    const users = await response.json();
    const container = document.getElementById("users-list");
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (!users.length) {
      container.innerHTML = `<p class="empty-text">No users found</p>`;
      return;
    }

    container.innerHTML = users.map(user => `
      <div class="user-card">
        <div class="user-info">
        <div class="user-avatar">👤</div>
        <div>
          <h4>${user.username}</h4>
          <p>${user.email}</p>
        </div>
        </div>
        <div class="user-actions">
        <span class="role-badge ${user.role.toLowerCase()}">${user.role.toUpperCase()}</span>
        ${currentUser && user.email === currentUser.email
          ? `<button class="btn-delete" style="opacity:0.5; cursor:not-allowed;" disabled>Delete</button>`
          : `<button class="btn-delete" onclick="deleteUser('${user.id}')">Delete</button>`}
        </div>
      </div>`).join("");
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}

async function saveUser() {
  const username = document.getElementById("new-username").value.trim();
  const email = document.getElementById("new-email").value.trim();
  const role = document.getElementById("new-role").value;

  if (!username || !email) {
    alert("Please fill in all fields.");
    return;
  }

  try {
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        email,
        role
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    alert("User created successfully!");
    await renderUsers();
    clearUserInputs();
    document.getElementById("add-user-container").style.display = "none";
  } catch (error) {
    alert(error.message);
  }
}

function clearUserInputs() {
  document.getElementById("new-username").value = "";
  document.getElementById("new-email").value = "";
  document.getElementById("new-role").value = "customer";
}

async function deleteUser(userId) {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  // Check if trying to delete self
  const users = await fetch('http://localhost:3000/api/users').then(r => r.json());
  const targetUser = users.find(u => u.id === userId);
  
  if (targetUser && targetUser.email === currentUser.email) {
    alert("You cannot delete your own account.");
    return;
  }

  if (!confirm(`Delete user "${targetUser.username}"?`)) return;

  try {
    const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'x-user-email': currentUser.email
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    alert("User deleted successfully!");
    await renderUsers();
  } catch (error) {
    alert(error.message);
  }
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
  
  if (!filteredTickets.length) {
    container.innerHTML = `<p class="empty-text">No tickets found</p>`;
    return;
  }

  container.innerHTML = filteredTickets.map(ticket => {
    const assignedTo = ticket.assignedTo || "";
    
    return `
      <div class="ticket-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4>Issue: ${ticket.title}</h4>
          <button class="btn-delete" onclick="deleteTicket('${ticket.id}')">Delete</button>
        </div>
        <p><strong>Ticket ID:</strong> ${ticket.id}</p>
        <p><strong>Impact Level:</strong> ${ticket.impact || 'N/A'}</p>
        <p><strong>Description:</strong> ${ticket.description || 'N/A'}</p>
        <p><strong>Account Holder:</strong> ${ticket.accountHolder || 'N/A'}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <div style="display:flex;align-items:center;gap:10px;">
          <p style="margin:0;"><strong>Assigned To:</strong></p>
          <select onchange="assignAgent('${ticket.id}', this.value)">
            <option value="">Not assigned</option>
            <option value="${assignedTo}" selected>${assignedTo}</option>
          </select>
        </div>
      </div>`;
  }).join("");
}

// ===== Notifications =====
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

    notifList.innerHTML = notifications.length
      ? notifications.map(notification => `
        <div class="notif-item">
          <div>
            <small>${notification.timestamp}</small>
            <p>${notification.message}</p>
          </div>
          <button class="mark-read-btn" onclick="markAsRead('${notification.id}')" title="Mark as Read">&times;</button>
        </div>`).join("")
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