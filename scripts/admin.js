// scripts/admin.js

// ===== On Page Load =====
window.onload = async function () {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin') {
    window.location.href = '../html/signin.html';
    return;
  }

  document.getElementById('admin-name').innerText = currentUser.username;
  document.getElementById('admin-name-side').innerText = currentUser.username;
  document.getElementById('side-avatar').innerText = currentUser.username.charAt(0).toUpperCase();

  // ✅ FIX 4: Only check needsPasswordReset flag — no password in localStorage
  if (currentUser.needsPasswordReset) {
    showPasswordResetModal();
  }

  // Event listeners
  document.getElementById('search-button').addEventListener('click', handleSearch);
  document.getElementById('clear-search-button').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    renderTickets();
  });

  document.getElementById('add-user-btn').addEventListener('click', () => {
    document.getElementById('add-user-container').style.display = 'flex';
  });

  document.getElementById('cancel-user-btn').addEventListener('click', () => {
    document.getElementById('add-user-container').style.display = 'none';
    clearUserInputs();
  });

  document.getElementById('save-user-btn').addEventListener('click', saveUser);

  await renderStats();
  await renderTickets();
  await renderUsers();
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
      // ✅ FIX 3: authFetch handles URL + token automatically
      const response = await authFetch(`/api/user/${currentUser.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword: newPass, isPasswordReset: true })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // ✅ FIX 4: Update needsPasswordReset only — never store password
      const updatedUser = { ...currentUser, needsPasswordReset: false };
      setCurrentUser(updatedUser);

      alert('Password updated successfully!');
      modal.style.display = 'none';
    } catch (error) {
      alert(error.message);
    }
  };
}

// Global chart instances to prevent duplication
let volumeChartInstance = null;
let slaChartInstance = null;

// ===== Stats & Charts =====
async function renderStats() {
  try {
    // 1. Get Summary Stats
    const response = await authFetch('/api/tickets/stats');
    const stats = await response.json();

    document.getElementById('total-tickets').innerText = stats.total || 0;
    document.getElementById('pending-tickets').innerText = stats.pending || 0;
    document.getElementById('inprogress-tickets').innerText = stats.inProgress || 0;
    document.getElementById('breached-tickets').innerText = stats.breached || 0;
    document.getElementById('resolved-tickets').innerText = stats.resolved || 0;

    // 2. Get All Tickets (now includes feedback from our backend update)
    const tResponse = await authFetch('/api/tickets');
    const tickets = await tResponse.json();

    // 3. Update Charts
    updateVolumeChart(tickets);
    updateSlaChart(stats);
    updateCsatChart(tickets);

  } catch (error) {
    console.error('Error rendering stats/charts:', error);
  }
}

let csatChartInstance = null;
function updateCsatChart(tickets) {
  const ctx = document.getElementById('csatChart').getContext('2d');
  if (csatChartInstance) csatChartInstance.destroy();

  const ratings = [0, 0, 0, 0, 0]; // Index 0=1 star, ..., 4=5 stars
  tickets.forEach(t => {
    if (t.feedback && t.feedback.rating) {
      const r = parseInt(t.feedback.rating);
      if (r >= 1 && r <= 5) ratings[r - 1]++;
    }
  });

  csatChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['1★', '2★', '3★', '4★', '5★'],
      datasets: [{
        label: 'Ratings',
        data: ratings,
        backgroundColor: ['#ef4444', '#f59e0b', '#fbbf24', '#a3e635', '#10b981']
      }]
    },
    options: {
      indexAxis: 'y', // Horizontal bars
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } },
        y: { grid: { display: false } }
      }
    }
  });
}

function updateVolumeChart(tickets) {
  const ctx = document.getElementById('volumeChart').getContext('2d');

  // Calculate counts for last 7 days
  const labels = [];
  const counts = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    labels.push(dateStr);

    // Count tickets created on this day
    const count = tickets.filter(t => {
      const tDate = new Date(t.createdAt);
      return tDate.toDateString() === d.toDateString();
    }).length;
    counts.push(count);
  }

  if (volumeChartInstance) volumeChartInstance.destroy();

  volumeChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Tickets Opened',
        data: counts,
        borderColor: '#2ECC71',
        backgroundColor: 'rgba(46, 204, 113, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: '#9CA3AF' },
          grid: { color: '#2A2F36' }
        },
        x: {
          ticks: { color: '#9CA3AF' },
          grid: { display: false }
        }
      }
    }
  });
}

function updateSlaChart(stats) {
  const ctx = document.getElementById('slaChart').getContext('2d');

  if (slaChartInstance) slaChartInstance.destroy();

  const onTime = (stats.total || 0) - (stats.breached || 0);

  slaChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['On Track', 'Breached'],
      datasets: [{
        data: [onTime, stats.breached || 0],
        backgroundColor: ['#22C55E', '#EF4444'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 20,
            color: '#9CA3AF'
          }
        }
      },
      cutout: '70%'
    }
  });
}

// ===== Tickets =====
async function renderTickets() {
  try {
    const response = await authFetch('/api/tickets');
    const tickets = await response.json();
    const agentsResponse = await authFetch('/api/users');
    const users = await agentsResponse.json();
    const agents = users.filter(u => u.role === 'agent');

    const container = document.getElementById('tickets-list');

    if (!tickets.length) {
      container.innerHTML = `<p class="empty-text">No tickets found</p>`;
      return;
    }

    container.innerHTML = tickets.map(ticket => {
      const assignedTo = ticket.assignedTo || '';
      const agentOptions = agents
        .map(agent => `<option value="${agent.username}" ${agent.username === assignedTo ? 'selected' : ''}>${agent.username}</option>`)
        .join('');

      return `
      <div class="ticket-card clickable" onclick="openTicketDetail('${ticket.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4>Issue: ${ticket.title}</h4>
          <button class="btn-delete" onclick="event.stopPropagation(); deleteTicket('${ticket.id}')">Delete</button>
        </div>
        <p><strong>Ticket ID:</strong> #${ticket.id}</p>
        <p><strong>Impact Level:</strong> ${ticket.impact || 'N/A'}</p>
        <p><strong>Account Holder:</strong> ${ticket.accountHolder || 'N/A'}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <div style="display:flex;align-items:center;gap:10px;" onclick="event.stopPropagation()">
          <p style="margin:0;"><strong>Assigned To:</strong></p>
          <select onchange="assignAgent('${ticket.id}', this.value)">
            <option value="">Not assigned</option>
            ${agentOptions}
          </select>
        </div>
      </div>`;
    }).join('');
  } catch (error) {
    console.error('Error fetching tickets:', error);
  }
}

async function handleSearch() {
  const field = document.getElementById('search-field-dropdown').value;
  const query = document.getElementById('search-input').value.trim();

  if (!query) {
    alert('Please enter a value to search.');
    return;
  }

  try {
    const response = await authFetch(`/api/tickets?searchField=${field}&searchValue=${encodeURIComponent(query)}`);
    const filteredTickets = await response.json();
    renderFilteredTickets(filteredTickets);
  } catch (error) {
    console.error('Error searching tickets:', error);
  }
}

async function assignAgent(ticketId, agentUsername) {
  try {
    const currentUser = getCurrentUser();

    const response = await authFetch(`/api/tickets/${ticketId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ agentUsername, adminEmail: currentUser.email })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    await renderTickets();
    await renderStats();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteTicket(ticketId) {
  if (!confirm('Are you sure you want to delete this ticket?')) return;

  try {
    const response = await authFetch(`/api/tickets/${ticketId}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    alert('Ticket deleted successfully!');
    await renderTickets();
    await renderStats();
  } catch (error) {
    alert(error.message);
  }
}

// ===== Users =====
async function renderUsers() {
  try {
    const response = await authFetch('/api/users');
    const users = await response.json();
    const container = document.getElementById('users-list');
    const currentUser = getCurrentUser();

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
      </div>`).join('');
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}

async function saveUser() {
  const username = document.getElementById('new-username').value.trim();
  const email = document.getElementById('new-email').value.trim();
  const role = document.getElementById('new-role').value;

  if (!username || !email) {
    alert('Please fill in all fields.');
    return;
  }

  try {
    const response = await authFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username, email, role })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    alert('User created successfully!');
    await renderUsers();
    clearUserInputs();
    document.getElementById('add-user-container').style.display = 'none';
  } catch (error) {
    alert(error.message);
  }
}

function clearUserInputs() {
  document.getElementById('new-username').value = '';
  document.getElementById('new-email').value = '';
  document.getElementById('new-role').value = 'customer';
}

async function deleteUser(userId) {
  const currentUser = getCurrentUser();

  const usersResponse = await authFetch('/api/users');
  const users = await usersResponse.json();
  const targetUser = users.find(u => u.id === userId);

  if (targetUser && targetUser.email === currentUser.email) {
    alert('You cannot delete your own account.');
    return;
  }

  if (!confirm(`Delete user "${targetUser.username}"?`)) return;

  try {
    const response = await authFetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: { 'x-user-email': currentUser.email }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    alert('User deleted successfully!');
    await renderUsers();
  } catch (error) {
    alert(error.message);
  }
}

function showTab(tab) {
  // Sections
  document.getElementById('stats-section').style.display = tab === 'stats' ? 'block' : 'none';
  document.getElementById('ticket-management').style.display = tab === 'tickets' ? 'block' : 'none';
  document.getElementById('performance-section').style.display = tab === 'performance' ? 'block' : 'none';
  document.getElementById('user-management').style.display = tab === 'users' ? 'block' : 'none';

  // Tabs
  const allTabs = ['tab-stats', 'tab-tickets', 'tab-performance', 'tab-users'];
  allTabs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === `tab-${tab}`);
  });

  // Header Title
  const titles = {
    stats: 'Analytics dashboard',
    tickets: 'Ticket Management',
    performance: 'Agent Performance Leaderboard',
    users: 'User Management'
  };
  document.getElementById('page-title').innerText = titles[tab] || 'Dashboard';

  if (tab === 'stats') renderStats();
  if (tab === 'performance') renderPerformance();
}

async function renderPerformance() {
  const list = document.getElementById('performance-list');
  list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Calculating performance metrics...</td></tr>';

  try {
    const [tRes, uRes] = await Promise.all([
      authFetch('/api/tickets'),
      authFetch('/api/users')
    ]);

    const tickets = await tRes.json();
    const allUsers = await uRes.json();
    const agents = allUsers.filter(u => u.role === 'agent');

    const performanceData = agents.map(agent => {
      const agentTickets = tickets.filter(t => t.assignedTo === agent.username);
      const resolved = agentTickets.filter(t => t.status === 'Resolved');
      const breached = agentTickets.filter(t => t.slaBreached);

      // Calculate Avg. Resolve Time
      let avgResolveTime = 'N/A';
      if (resolved.length > 0) {
        const totalMs = resolved.reduce((acc, t) => {
          const start = new Date(t.createdAt);
          const end = new Date(t.resolvedAt || Date.now());
          return acc + (end - start);
        }, 0);
        const avgHrs = (totalMs / resolved.length / 3600000).toFixed(1);
        avgResolveTime = `${avgHrs}h`;
      }

      // Calculate SLA Compliance
      const slaCompliance = agentTickets.length > 0
        ? (((agentTickets.length - breached.length) / agentTickets.length) * 100).toFixed(0) + '%'
        : '100%';

      // Calculate CSAT (Feedback is linked to ticket.id)
      const ratings = resolved.filter(t => t.feedback).map(t => t.feedback.rating);
      const avgCsat = ratings.length > 0
        ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) + ' ★'
        : 'No ratings';

      return {
        name: agent.username,
        count: agentTickets.length,
        resolveTime: avgResolveTime,
        sla: slaCompliance,
        csat: avgCsat
      };
    });

    list.innerHTML = performanceData.map(data => `
      <tr style="border-bottom: 1px solid var(--divider);">
        <td style="padding: 12px"><strong>${data.name}</strong></td>
        <td style="padding: 12px">${data.count}</td>
        <td style="padding: 12px">${data.resolveTime}</td>
        <td style="padding: 12px">${data.sla}</td>
        <td style="padding: 12px">${data.csat}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Performance error:', err);
    list.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center; padding:20px;">Failed to load performance data.</td></tr>';
  }
}

// ===== Filter Tickets =====
function renderFilteredTickets(filteredTickets) {
  const container = document.getElementById('tickets-list');

  if (!filteredTickets.length) {
    container.innerHTML = `<p class="empty-text">No tickets found</p>`;
    return;
  }

  container.innerHTML = filteredTickets.map(ticket => {
    const assignedTo = ticket.assignedTo || '';
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
  }).join('');
}

/// Notification panel removed - using email notifications only