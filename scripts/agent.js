// scripts/agent.js

// ===== On Page Load =====
window.onload = async function () {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== 'agent') {
    window.location.href = '../html/signin.html';
    return;
  }

  // Sidebar Profile Update
  document.getElementById('agent-name').innerText = currentUser.username;
  document.getElementById('agent-name-side').innerText = currentUser.username;
  document.getElementById('side-avatar').innerText = currentUser.username.charAt(0).toUpperCase();

  // ✅ FIX 4: Only check needsPasswordReset — no password in localStorage
  if (currentUser.needsPasswordReset) {
    showPasswordResetModal();
  }

  document.getElementById('search-assigned').addEventListener('input', renderAssigned);
  document.getElementById('search-inprogress').addEventListener('input', renderInProgress);
  document.getElementById('search-resolved').addEventListener('input', renderResolved);

  await renderStats();
  await renderAllTabs();
};

/* ==============================
   Password Reset Modal
============================== */
async function showPasswordResetModal() {
  const modal = document.getElementById('password-reset-modal');
  modal.style.display = 'flex';

  document.getElementById('save-new-password').onclick = async function () {
    const newPass = document.getElementById('new-password').value.trim();
    const confirm = document.getElementById('confirm-password').value.trim();

    if (!newPass || !confirm) { alert('Please fill both fields.'); return; }
    if (newPass !== confirm) { alert('Passwords do not match!'); return; }
    if (newPass === 'Smartdesk@123') { alert('Please choose a different password.'); return; }

    try {
      const currentUser = getCurrentUser();
      // ✅ FIX 3: authFetch handles URL + JWT
      const response = await authFetch(`/api/user/${currentUser.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword: newPass, isPasswordReset: true })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // ✅ FIX 4: Only update the flag — no password stored
      const updatedUser = { ...currentUser, needsPasswordReset: false };
      setCurrentUser(updatedUser);

      alert('Password updated successfully!');
      modal.style.display = 'none';
    } catch (error) {
      alert(error.message);
    }
  };
}

/* ==============================
   Stats and Tabs
============================= */
async function renderStats() {
  try {
    const currentUser = getCurrentUser();
    // ✅ FIX 3: authFetch with relative URL
    const response = await authFetch(`/api/agent/stats?agentUsername=${currentUser.username}`);
    const stats = await response.json();

    document.getElementById('assigned-tickets').innerText = stats.total || 0;
    document.getElementById('pending-tickets').innerText = stats.pending || 0;
    document.getElementById('inprogress-tickets').innerText = stats.inProgress || 0;
    document.getElementById('resolved-tickets').innerText = stats.resolved || 0;
  } catch (error) {
    console.error('Error fetching agent stats:', error);
  }
}

function showTab(tab) {
  ['assigned', 'inprogress', 'resolved'].forEach(name => {
    document.getElementById(`${name}-section`).style.display = tab === name ? 'block' : 'none';
    document.getElementById(`tab-${name}`).classList.toggle('active-tab', tab === name);
  });
}

/* ==============================
   Ticket Handling
============================== */
async function renderAssigned() {
  const search = document.getElementById('search-assigned').value.toLowerCase();
  const currentUser = getCurrentUser();

  try {
    const response = await authFetch(`/api/agent/tickets?agentUsername=${currentUser.username}&status=all&search=${encodeURIComponent(search)}`);
    const assignedTickets = await response.json();

    const container = document.getElementById('assigned-list');
    if (!assignedTickets.length) {
      container.innerHTML = `<p class="empty-text">No assigned tickets</p>`;
      return;
    }

    container.innerHTML = assignedTickets.map(ticket => `
      <div class="ticket-card clickable" onclick="openTicketDetail('${ticket.id}')">
        <h4>${ticket.title}</h4>
        <p><strong>Ticket ID:</strong> #${ticket.id}</p>
        <p><strong>Impact Level:</strong> ${ticket.impact}</p>
        <p><strong>Account Holder:</strong> ${ticket.accountHolder}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <div style="display:flex; gap:10px;" onclick="event.stopPropagation()">
          <label><strong>Update Status:</strong></label>
          <select onchange="updateStatus('${ticket.id}', this.value)" class="auth-input" style="height:30px; margin:0; width:120px; font-size:12px;">
            <option value="Pending" ${ticket.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
          </select>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error fetching assigned tickets:', error);
  }
}

async function renderInProgress() {
  const search = document.getElementById('search-inprogress').value.toLowerCase();
  const currentUser = getCurrentUser();

  try {
    const response = await authFetch(`/api/agent/tickets?agentUsername=${currentUser.username}&status=In Progress&search=${encodeURIComponent(search)}`);
    const inProgressTickets = await response.json();

    const container = document.getElementById('inprogress-list');
    if (!inProgressTickets.length) {
      container.innerHTML = `<p class="empty-text">No in-progress tickets</p>`;
      return;
    }

    container.innerHTML = inProgressTickets.map(ticket => `
      <div class="ticket-card clickable" onclick="openTicketDetail('${ticket.id}')">
        <h4>${ticket.title}</h4>
        <p><strong>Ticket ID:</strong> #${ticket.id}</p>
        <p><strong>Impact Level:</strong> ${ticket.impact}</p>
        <p><strong>Account Holder:</strong> ${ticket.accountHolder}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error fetching in-progress tickets:', error);
  }
}

async function renderResolved() {
  const search = document.getElementById('search-resolved').value.toLowerCase();
  const currentUser = getCurrentUser();

  try {
    const response = await authFetch(`/api/agent/tickets?agentUsername=${currentUser.username}&status=Resolved&search=${encodeURIComponent(search)}`);
    const resolvedTickets = await response.json();

    const container = document.getElementById('resolved-list');
    if (!resolvedTickets.length) {
      container.innerHTML = `<p class="empty-text">No resolved tickets</p>`;
      return;
    }

    container.innerHTML = resolvedTickets.map(ticket => `
      <div class="ticket-card clickable" onclick="openTicketDetail('${ticket.id}')">
        <h4>${ticket.title}</h4>
        <p><strong>Ticket ID:</strong> #${ticket.id}</p>
        <p><strong>Impact Level:</strong> ${ticket.impact}</p>
        <p><strong>Account Holder:</strong> ${ticket.accountHolder}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
      </div>
    `).join('');
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
    const currentUser = getCurrentUser();

    const response = await authFetch(`/api/tickets/${ticketId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus, agentUsername: currentUser.username })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    await renderStats();
    await renderAllTabs();
  } catch (error) {
    alert(error.message);
  }
}

// Notification logic removed - using email notifications only