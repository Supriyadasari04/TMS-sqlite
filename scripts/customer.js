/* ============================================
   Customer Dashboard Script – SmartDesk
   ============================================ */

// === Global Analysis State ===
let currentAiAnalysis = null;

// === On Page Load ===
window.onload = async function () {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== 'customer') {
    window.location.href = '../html/signin.html';
    return;
  }

  // Sidebar Profile Update
  document.getElementById('customer-name').innerText = currentUser.username;
  document.getElementById('customer-name-side').innerText = currentUser.username;
  document.getElementById('side-avatar').innerText = currentUser.username.charAt(0).toUpperCase();

  // Clear AI data on open
  document.getElementById('open-modal-btn').onclick = () => {
    currentAiAnalysis = null;
    document.getElementById('ai-feedback').style.display = 'none';
    document.getElementById('ticket-modal').style.display = 'flex';
  };

  // ✅ FIX 4: Only check needsPasswordReset — no password in localStorage
  if (currentUser.needsPasswordReset) {
    showPasswordResetModal();
  }

  await renderTickets();
  await updateStats();

  const aiBtn = document.getElementById('ai-analyze-btn');
  if (aiBtn) aiBtn.addEventListener('click', handleAiAnalyze);
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
      // ✅ FIX 3: authFetch handles URL + JWT token
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

// === Ticket Modal Handling ===
document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('ticket-modal');
  const openModalBtn = document.getElementById('open-modal-btn');
  const cancelBtn = document.getElementById('cancel-ticket');
  const saveBtn = document.getElementById('save-ticket');

  if (!modal || !openModalBtn || !cancelBtn || !saveBtn) return;

  openModalBtn.addEventListener('click', () => (modal.style.display = 'flex'));
  cancelBtn.addEventListener('click', () => (modal.style.display = 'none'));

  // === Create Ticket Handler ===
  saveBtn.addEventListener('click', async () => {
    const subject = document.getElementById('ticket-subject').value.trim();
    const description = document.getElementById('ticket-description').value.trim();
    const impact = document.getElementById('impact').value;
    const accountHolder = document.getElementById('account-holder').value.trim();
    const accountNumber = document.getElementById('account-number').value.trim();
    const ifscCode = document.getElementById('ifsc-code').value.trim();

    if (!subject || !description || !impact || !accountHolder || !accountNumber || !ifscCode) {
      alert('Please fill all required fields.');
      return;
    }

    try {
      const currentUser = getCurrentUser();

      // ✅ FIX 3: Use authFetch with relative URL
      const response = await authFetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          title: subject,
          description,
          impact,
          accountHolder,
          accountNumber,
          ifscCode,
          createdBy: currentUser.email,
          aiData: currentAiAnalysis // Feature 13 & 9
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');

      alert('Ticket created successfully!');
      modal.style.display = 'none';
      clearInputs();

      await renderTickets();
      await updateStats();
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Error: ' + error.message);
    }
  });
});

// === Helper Functions ===
function clearInputs() {
  document.querySelectorAll('#ticket-modal input, #ticket-modal select, #ticket-modal textarea')
    .forEach(el => { el.value = ''; });
}

// === Render Tickets ===
async function renderTickets() {
  const container = document.getElementById('tickets-container');
  const currentUser = getCurrentUser();

  try {
    const response = await authFetch(`/api/customer/tickets?customerEmail=${currentUser.email}`);
    const userTickets = await response.json();

    if (!userTickets.length) {
      container.innerHTML = `<p class="empty-text">No tickets yet</p>`;
      return;
    }

    container.innerHTML = userTickets.map(ticket => `
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
      </div>`).join('');
  } catch (error) {
    console.error('Error fetching tickets:', error);
    container.innerHTML = `<p class="empty-text">Error loading tickets</p>`;
  }
}

// === Update Ticket Stats ===
async function updateStats() {
  const currentUser = getCurrentUser();

  try {
    const response = await authFetch(`/api/customer/stats?customerEmail=${currentUser.email}`);
    const stats = await response.json();

    document.getElementById('total-tickets').innerText = stats.total || 0;
    document.getElementById('pending-tickets').innerText = stats.pending || 0;
    document.getElementById('inprogress-tickets').innerText = stats.inProgress || 0;
    document.getElementById('resolved-tickets').innerText = stats.resolved || 0;
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
}

async function handleAiAnalyze() {
  const titleSelect = document.getElementById('ticket-subject');
  const titleValue = titleSelect ? titleSelect.value : '';
  const descriptionValue = document.getElementById('ticket-description').value.trim();
  const feedbackDiv = document.getElementById('ai-feedback');
  const aiReason = document.getElementById('ai-reason');
  const tagsContainer = document.getElementById('ai-tags-container');
  const impactSelect = document.getElementById('impact');
  const aiBtn = document.getElementById('ai-analyze-btn');

  if (!titleValue || !descriptionValue) {
    alert('Please select an Issue Type and provide a description first.');
    return;
  }

  aiBtn.disabled = true;
  aiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
  feedbackDiv.style.display = 'none';

  try {
    const response = await authFetch('/api/ai/analyze-issue', {
      method: 'POST',
      body: JSON.stringify({ title: titleValue, description: descriptionValue })
    });

    const analysis = await response.json();
    if (!response.ok) throw new Error(analysis.error || 'AI analysis failed');

    currentAiAnalysis = analysis; // Capture for saving

    // Auto-Fill Impact
    if (analysis.impact && impactSelect) {
      impactSelect.value = analysis.impact;
    }

    // Show AI Feedback
    feedbackDiv.style.display = 'block';
    aiReason.innerText = analysis.reason || 'No specific reason provided.';

    // Render Tags
    if (analysis.tags && analysis.tags.length > 0) {
      tagsContainer.innerHTML = '<strong>Suggested Tags:</strong> ' + analysis.tags.map(tag => `<span class="ai-tag">${tag}</span>`).join('');
    } else {
      tagsContainer.innerHTML = '';
    }

  } catch (error) {
    console.error('AI Analysis Front-end error:', error);
    alert('AI categorization failed: ' + error.message);
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerHTML = '<i class="fas fa-magic"></i> AI Analyze';
  }
}