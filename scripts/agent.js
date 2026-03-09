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
      <div class="data-card clickable" onclick="openTicketDetail('${ticket.id}')" style="padding: 12px; border-radius: 10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:24px; height:24px; background:var(--bg-surface); border-radius:6px; display:flex; align-items:center; justify-content:center; color:var(--text-secondary); font-size:12px;">
              <i class="fas fa-ticket-alt"></i>
            </div>
            <span style="font-size:11px; font-weight:600; color:var(--text-disabled);">#${ticket.id}</span>
          </div>
          <span class="status-pill ${ticket.status.toLowerCase().replace(' ', '-')}">${ticket.status}</span>
        </div>
        <h4 style="font-size:14px; font-weight:600; margin-bottom:10px; color:var(--text-primary);">${ticket.title}</h4>
        <div style="font-size:12px; color:var(--text-secondary); display:flex; gap:16px; margin-bottom:12px;">
          <span><i class="far fa-user" style="margin-right:4px;"></i>${ticket.accountHolder}</span>
          <span><i class="far fa-clock" style="margin-right:4px;"></i>${formatTime(ticket.createdAt)}</span>
        </div>
        <div style="display:flex; align-items:center; gap:12px; padding-top:10px; border-top:1px solid var(--divider);" onclick="event.stopPropagation()">
           <span style="font-size:11px; font-weight:600; color:var(--text-disabled);">STATUS</span>
           <select onchange="updateStatus('${ticket.id}', this.value)" style="flex:1; height:28px; font-size:12px; padding:0 8px; border-radius:6px; border:1px solid var(--border);">
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
      <div class="data-card clickable" onclick="openTicketDetail('${ticket.id}')" style="padding: 12px; border-radius: 10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:24px; height:24px; background:var(--bg-surface); border-radius:6px; display:flex; align-items:center; justify-content:center; color:var(--text-secondary); font-size:12px;">
              <i class="fas fa-ticket-alt"></i>
            </div>
            <span style="font-size:11px; font-weight:600; color:var(--text-disabled);">#${ticket.id}</span>
          </div>
          <span class="status-pill in-progress">${ticket.status}</span>
        </div>
        <h4 style="font-size:14px; font-weight:600; margin-bottom:10px; color:var(--text-primary);">${ticket.title}</h4>
        <div style="font-size:12px; color:var(--text-secondary); display:flex; gap:16px; margin-bottom:12px;">
          <span><i class="far fa-user" style="margin-right:4px;"></i>${ticket.accountHolder}</span>
          <span><i class="far fa-clock" style="margin-right:4px;"></i>${formatTime(ticket.createdAt)}</span>
        </div>
        <div style="display:flex; align-items:center; gap:12px; padding-top:10px; border-top:1px solid var(--divider);" onclick="event.stopPropagation()">
           <span style="font-size:11px; font-weight:600; color:var(--text-disabled);">STATUS</span>
           <select onchange="updateStatus('${ticket.id}', this.value)" style="flex:1; height:28px; font-size:12px; padding:0 8px; border-radius:6px; border:1px solid var(--border);">
              <option value="Pending">Pending</option>
              <option value="In Progress" selected>In Progress</option>
              <option value="Resolved">Resolved</option>
           </select>
        </div>
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
      <div class="data-card clickable" onclick="openTicketDetail('${ticket.id}')" style="padding: 12px; border-radius: 10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:24px; height:24px; background:var(--bg-surface); border-radius:6px; display:flex; align-items:center; justify-content:center; color:var(--text-secondary); font-size:12px;">
              <i class="fas fa-ticket-alt"></i>
            </div>
            <span style="font-size:11px; font-weight:600; color:var(--text-disabled);">#${ticket.id}</span>
          </div>
          <span class="status-pill resolved">${ticket.status}</span>
        </div>
        <h4 style="font-size:14px; font-weight:600; margin-bottom:10px; color:var(--text-primary);">${ticket.title}</h4>
        <div style="font-size:12px; color:var(--text-secondary); display:flex; gap:16px; margin-bottom:12px;">
          <span><i class="far fa-user" style="margin-right:4px;"></i>${ticket.accountHolder}</span>
          <span><i class="far fa-clock" style="margin-right:4px;"></i>${formatTime(ticket.createdAt)}</span>
        </div>
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