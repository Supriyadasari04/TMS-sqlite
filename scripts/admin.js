window.onload = function () {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || currentUser.role !== "admin") {
    window.location.href = "signin.html";
    return;
  }

  document.getElementById("admin-name").innerText = currentUser.username;

  // 🚨 Require password reset if default
  if (currentUser.password === "Ticketpro@123" || currentUser.needsPasswordReset) {
    showPasswordResetModal();
  }

  renderStats();
  renderTickets();
  renderUsers();
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



function logout() {
  localStorage.removeItem("currentUser");
  window.location.href = "signin.html";
}

function renderStats() {
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];

  document.getElementById("total-tickets").innerText = tickets.length;
  document.getElementById("pending-tickets").innerText = tickets.filter(t => t.status === "Pending").length;
  document.getElementById("inprogress-tickets").innerText = tickets.filter(t => t.status === "In Progress").length;
  document.getElementById("resolved-tickets").innerText = tickets.filter(t => t.status === "Resolved").length;
}

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
        .map(agent => {
          const isSelected = agent.username === assignedTo ? "selected" : "";
          return `<option value="${agent.username}" ${isSelected}>${agent.username}</option>`;
        })
        .join("");
      return `
      <div class="ticket-card" style="padding: 16px; background: white; border-radius: 8px; box-shadow: var(--shadow);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h4 style="margin: 0;">Issue: ${t.title}</h4>
          <button class="btn-delete" onclick="deleteTicket(${index})">Delete</button>
        </div>
        <p><strong>Ticket ID:</strong> #${t.id}</p>
        <p><strong>Impact Level:</strong> ${t.impact || 'N/A'}</p>
        <p><strong>Account Holder:</strong> ${t.accountHolder || 'N/A'}</p>
        <p><strong>Status:</strong> ${t.status}</p>
        <div style="display: flex; align-items: center; gap: 10px;">
          <p style="margin: 0;"><strong>Assigned To:</strong></p>
          <select onchange="assignAgent('${t.id}', this.value)">
            <option value="">Not assigned</option>
            ${agentOptions}
          </select>
        </div>
      </div>
      `;
    })
    .join("");
}
function assignAgent(ticketId, agentUsername) {
  const tickets = JSON.parse(localStorage.getItem("tickets")) || [];
  const ticketIndex = tickets.findIndex(t => t.id === ticketId);
  if (ticketIndex !== -1) {
    tickets[ticketIndex].assignedTo = agentUsername;
    tickets[ticketIndex].status = agentUsername ? "In Progress" : "Pending";
    localStorage.setItem("tickets", JSON.stringify(tickets));

    // === Send Notifications ===
const users = JSON.parse(localStorage.getItem("users")) || [];
const ticket = tickets[ticketIndex];

// Find customer who created the ticket
const customer = users.find(u => u.email === ticket.createdBy);

// Find agent assigned
const agent = users.find(u => u.username === agentUsername);

// 1️⃣ Notify Customer - agent assigned
if (customer && agentUsername) {
  addNotification({
    message: `Your ticket #${ticket.id} has been assigned to agent ${agentUsername}.`,
    role: "customer",
    email: customer.email,
    timestamp: new Date().toLocaleString()
  });
}

// 2️⃣ Notify Agent - assigned ticket
if (agent && agentUsername) {
  addNotification({
    message: `You have been assigned to ticket #${ticket.id} (${ticket.title}).`,
    role: "agent",
    email: agent.email,
    timestamp: new Date().toLocaleString()
  });
}

// 3️⃣ Notify Admin (self) - reminder
const admin = JSON.parse(localStorage.getItem("currentUser"));
if (admin) {
  addNotification({
    message: `Ticket #${ticket.id} assigned to agent ${agentUsername}. Please monitor progress.`,
    role: "admin",
    timestamp: new Date().toLocaleString()
  });
}

    renderTickets();
    renderStats();
  }
}




function renderUsers() {
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const container = document.getElementById("users-list");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  if (users.length === 0) {
    container.innerHTML = `<p class="empty-text">No users found</p>`;
    return;
  }

  const roleOrder = { admin: 1, agent: 2, customer: 3 };
  users.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

  container.innerHTML = users
    .map((u, index) => {
      // Prevent self-deletion
      const isCurrentUser = currentUser && u.email === currentUser.email;

      return `
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
            ${
              isCurrentUser
                ? `<button class="btn-delete" style="opacity:0.5; cursor:not-allowed;" disabled>Delete</button>`
                : `<button class="btn-delete" onclick="deleteUser(${index})">Delete</button>`
            }
          </div>
        </div>
      `;
    })
    .join("");
}

document.getElementById("add-user-btn").addEventListener("click", () => {
  document.getElementById("add-user-container").style.display = "flex";
});

document.getElementById("cancel-user-btn").addEventListener("click", () => {
  document.getElementById("add-user-container").style.display = "none";
  clearUserInputs();
});

document.getElementById("save-user-btn").addEventListener("click", () => {
  const username = document.getElementById("new-username").value.trim();
  const email = document.getElementById("new-email").value.trim();
  const role = document.getElementById("new-role").value;

  if (!username || !email) {
    alert("Please fill in all fields.");
    return;
  }

  // Set default password for new users created by admin
  const password = "Ticketpro@123";

  const users = JSON.parse(localStorage.getItem("users")) || [];
  
  // Optional: check for duplicate username or email before adding
  const duplicateUser = users.find(u => u.username === username || u.email === email);
  if (duplicateUser) {
    alert("Username or email already exists.");
    return;
  }

  users.push({ email, username, password, role });
  localStorage.setItem("users", JSON.stringify(users));

  renderUsers();
  clearUserInputs();
  document.getElementById("add-user-container").style.display = "none";
});



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

  // Remove the selected ticket
  tickets.splice(index, 1);
  localStorage.setItem("tickets", JSON.stringify(tickets));

  // Re-render the list and stats
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

window.addEventListener("storage", (event) => {
  if (event.key === "tickets") {
    renderTickets();
    renderStats();
  }
});

window.addEventListener("storage", (event) => {
  if (event.key === "tickets") {
    renderTickets();
    renderStats();
  }
});


// === 🔍 Ticket Search Functionality ===
function filterTicketsByField(tickets, field, query) {
  query = query.toLowerCase().trim();
  return tickets.filter(ticket => {
    if (!ticket[field]) return false;
    return ticket[field].toString().toLowerCase().includes(query);
  });
}

function renderFilteredTickets(filteredTickets) {
  const container = document.getElementById("tickets-list");

  if (filteredTickets.length === 0) {
    container.innerHTML = `<p class="empty-text">No matching tickets found</p>`;
    return;
  }

  const users = JSON.parse(localStorage.getItem("users")) || [];
  const agents = users.filter(u => u.role === "agent");

  container.innerHTML = filteredTickets
    .map((t, index) => {
      const assignedTo = t.assignedTo || "";
      const agentOptions = agents
        .map(agent => {
          const isSelected = agent.username === assignedTo ? "selected" : "";
          return `<option value="${agent.username}" ${isSelected}>${agent.username}</option>`;
        })
        .join("");

      return `
        <div class="ticket-card" style="padding: 16px; background: white; border-radius: 8px; box-shadow: var(--shadow);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0;">Issue: ${t.title}</h4>
            <button class="btn-delete" onclick="deleteTicket(${index})">Delete</button>
          </div>
          <p><strong>Ticket ID:</strong> #${t.id}</p>
          <p><strong>Impact Level:</strong> ${t.impact || 'N/A'}</p>
          <p><strong>Account Holder:</strong> ${t.accountHolder || 'N/A'}</p>
          <p><strong>Status:</strong> ${t.status}</p>
          <div style="display: flex; align-items: center; gap: 10px;">
            <p style="margin: 0;"><strong>Assigned To:</strong></p>
            <select onchange="assignAgent('${t.id}', this.value)">
              <option value="">Not assigned</option>
              ${agentOptions}
            </select>
          </div>
        </div>
      `;
    })
    .join("");
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
  renderTickets(); // reload full list
});
