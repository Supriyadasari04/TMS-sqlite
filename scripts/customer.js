/* ============================================
   Customer Dashboard Script – TicketPro
   ============================================ */

// === On Page Load ===
window.onload = async function () {
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

  await renderTickets();
  await updateStats();
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
  saveBtn.addEventListener("click", async () => {
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

  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    console.log("Sending request to create ticket...");
    
    const response = await fetch('http://localhost:3000/api/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: subject,
        description,
        impact,
        accountHolder,
        accountNumber,
        ifscCode,
        createdBy: currentUser.email
      })
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers);
    
    // Get the raw response text first to see what we're getting
    const responseText = await response.text();
    console.log("Raw response:", responseText);
    
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse response as JSON:", parseError);
      alert("Server returned an invalid response. Check console for details.");
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    alert("Ticket created successfully!");
    modal.style.display = "none";
    clearInputs();
    
    await renderTickets();
    await updateStats();
    await updateNotifCount();
  } catch (error) {
    console.error("Error creating ticket:", error);
    alert("Error: " + error.message);
  }
});
});

// === Helper Functions ===
function clearInputs() {
  document.querySelectorAll("#ticket-modal input, #ticket-modal select, #ticket-modal textarea").forEach(el => {
    el.value = "";
  });
}

// === Render Tickets ===
async function renderTickets() {
  const container = document.getElementById("tickets-container");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3000/api/customer/tickets?customerEmail=${currentUser.email}`);
    const userTickets = await response.json();

    if (!userTickets.length) {
      container.innerHTML = `<p class="empty-text">No tickets yet</p>`;
      return;
    }

    container.innerHTML = userTickets
      .map(
        ticket => `
        <div class="ticket-card">
          <h4>${ticket.title}</h4>
          <p><strong>Ticket ID:</strong> #${ticket.id}</p>
          <p><strong>Description:</strong> ${ticket.description}</p>
          <p><strong>Impact Level:</strong> ${ticket.impact}</p>
          <p><strong>Status:</strong> ${ticket.status}</p>
          <p><strong>Assigned To:</strong> ${
            ticket.assignedTo ? ticket.assignedTo : '<span style="color:gray">Not assigned yet</span>'
          }</p>
        </div>`
      )
      .join("");
  } catch (error) {
    console.error('Error fetching tickets:', error);
    container.innerHTML = `<p class="empty-text">Error loading tickets</p>`;
  }
}

// === Update Ticket Stats ===
async function updateStats() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3000/api/customer/stats?customerEmail=${currentUser.email}`);
    const stats = await response.json();

    document.getElementById("total-tickets").innerText = stats.total || 0;
    document.getElementById("pending-tickets").innerText = stats.pending || 0;
    document.getElementById("inprogress-tickets").innerText = stats.inProgress || 0;
    document.getElementById("resolved-tickets").innerText = stats.resolved || 0;
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
}

/* ==============================
   Notifications Popup Feature
============================== */
async function toggleNotifications() {
  const panel = document.getElementById("notif-panel");
  panel.style.display = panel.style.display === "block" ? "none" : "block";
  if (panel.style.display === "block") await renderNotifications();
}

async function renderNotifications() {
  const notifList = document.getElementById("notif-list");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3000/api/notifications?email=${currentUser.email}&role=${currentUser.role}`);
    let notifications = await response.json();

    const sortValue = document.getElementById("notif-sort").value;
    
    // Sort notifications
    if (sortValue === "latest") {
      notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (sortValue === "earliest") {
      notifications.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    notifList.innerHTML = notifications.length
      ? notifications
          .map(
            notification => `
            <div class="notif-item">
              <div>
                <small>${notification.timestamp}</small>
                <p>${notification.message}</p>
              </div>
              <button class="mark-read-btn" onclick="markAsRead('${notification.id}')" title="Mark as Read">&times;</button>
            </div>`
          )
          .join("")
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

document.addEventListener("DOMContentLoaded", function () {
  const clearBtn = document.getElementById("clear-all-notifs");
  const sortSelect = document.getElementById("notif-sort");

  if (clearBtn) {
    clearBtn.onclick = async () => {
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
  }

  if (sortSelect) sortSelect.addEventListener("change", renderNotifications);
});

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