// scripts/ticket-detail.js
// ═══════════════════════════════════════════════════════
// Shared Ticket Detail View + Conversation Thread
// Used by admin.js, agent.js, customer.js
// ═══════════════════════════════════════════════════════

// Open ticket detail view
async function openTicketDetail(ticketId) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  try {
    // Fetch ticket, comments, and activity in parallel
    const [ticketRes, commentsRes, activityRes] = await Promise.all([
      authFetch(`/api/tickets/${ticketId}/detail`),
      authFetch(`/api/tickets/${ticketId}/comments`),
      authFetch(`/api/tickets/${ticketId}/activity`)
    ]);

    const ticket = await ticketRes.json();
    const comments = await commentsRes.json();
    const activity = await activityRes.json();

    if (!ticketRes.ok) {
      alert('Failed to load ticket details');
      return;
    }

    renderTicketDetail(ticket, comments, activity, currentUser);
  } catch (error) {
    console.error('Error opening ticket detail:', error);
    alert('Error loading ticket details');
  }
}

// Render the full detail overlay
function renderTicketDetail(ticket, comments, activity, currentUser) {
  // Remove any existing overlay
  const existing = document.getElementById('ticket-detail-overlay');
  if (existing) existing.remove();

  const statusClass = ticket.status.toLowerCase().replace(' ', '-');
  const impactClass = ticket.impact.toLowerCase();

  const overlay = document.createElement('div');
  overlay.id = 'ticket-detail-overlay';
  overlay.className = 'ticket-detail-overlay';
  overlay.innerHTML = `
    <div class="ticket-detail-panel">
      <!-- Header -->
      <div class="detail-header">
        <div class="detail-header-left">
          <div style="display:flex; align-items:center; gap:12px">
            <h3>${escapeHtml(ticket.title)}</h3>
            ${renderSlaBadge(ticket)}
          </div>
          <span class="ticket-id">#${ticket.id}</span>
        </div>
        <button class="detail-close-btn" onclick="closeTicketDetail()" title="Close">&times;</button>
      </div>

      <!-- Info Bar -->
      <div class="ticket-info-bar">
        <div class="info-chip">
          <span class="label">Status:</span>
          <span class="status-pill ${statusClass}">${ticket.status}</span>
        </div>
        <div class="info-chip">
          <span class="label">Impact:</span>
          <span class="impact-pill ${impactClass}">${ticket.impact}</span>
        </div>
        <div class="info-chip">
          <span class="label">Created by:</span>
          <span>${escapeHtml(ticket.createdByName || ticket.createdBy)}</span>
        </div>
        <div class="info-chip">
          <span class="label">Assigned to:</span>
          <span>${ticket.assignedTo ? escapeHtml(ticket.assignedToName || ticket.assignedTo) : '<em style="color:#9ca3af">Unassigned</em>'}</span>
        </div>
        <div class="info-chip">
          <span class="label">Created:</span>
          <span>${formatTime(ticket.createdAt)}</span>
        </div>
        <div class="info-chip">
          <span class="label">Sentiment:</span>
          <span>
            ${ticket.sentiment === 'frustrated' || ticket.sentiment === 'angry' ? '😡 Negative' :
      ticket.sentiment === 'satisfied' ? '😊 Positive' : '😐 Neutral'}
          </span>
        </div>
      </div>

      <!-- Body: Conversation + Activity -->
      <div class="detail-body">
        <!-- Main Area (Description + Feedback + Conversation) -->
        <div class="detail-main">
          
          <!-- Combined Content Wrapper for scrolling -->
          <div class="detail-scroll-area">
            <!-- Description Part -->
            <div class="ticket-description">
              <div class="desc-label">Description</div>
              <p>${escapeHtml(ticket.description)}</p>
              
              <!-- Attachment Section -->
              <div id="attachment-list-container" style="margin-top:12px; display:${ticket.attachments && ticket.attachments.length > 0 ? 'block' : 'none'}">
                <div class="desc-label">Attachments</div>
                <div class="attachment-grid" id="detail-attachment-grid">
                  ${renderAttachments(ticket.attachments)}
                </div>
              </div>
            </div>

            <!-- Feedback Section (Only for Resolved tickets) -->
            ${renderFeedbackSection(ticket, currentUser)}

            <!-- Conversation -->
            <div class="conversation-container" id="conversation-thread">
              ${renderComments(comments, currentUser)}
            </div>
          </div>

          <!-- Comment Input Area (Sticky at bottom) -->
          <div class="comment-input-area">
            <!-- Hidden file input -->
            <input type="file" id="detail-file-input" style="display:none" onchange="uploadAttachment('${ticket.id}')">
            
            <button class="attachment-btn" title="Attach Files" onclick="document.getElementById('detail-file-input').click()">
              <i class="fas fa-paperclip"></i>
            </button>
            
            ${(currentUser.role === 'agent' || currentUser.role === 'admin') ? `
              <button class="ai-draft-btn" id="ai-draft-btn" title="Draft with AI" onclick="draftWithAi('${ticket.id}')">
                <i class="fas fa-wand-magic-sparkles"></i>
              </button>
            ` : ''}
            
            <textarea id="comment-input" placeholder="Type your message..." rows="1" onkeydown="handleCommentKeydown(event, '${ticket.id}')"></textarea>
            
            <button class="comment-send-btn" id="comment-send-btn" onclick="sendComment('${ticket.id}')">Send</button>
          </div>
        </div>

        <!-- Sidebar: Activity Timeline -->
        <div class="detail-sidebar">
          <div class="activity-title">Activity</div>
          ${renderActivity(activity)}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close on background click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTicketDetail();
  });

  // Close on Escape key
  document.addEventListener('keydown', handleEscapeKey);

  // Scroll to bottom of conversation
  const thread = document.getElementById('conversation-thread');
  if (thread) thread.scrollTop = thread.scrollHeight;
}

// Render comments as chat bubbles
function renderComments(comments, currentUser) {
  if (!comments || comments.length === 0) {
    return '<div class="no-messages">No messages yet. Start the conversation!</div>';
  }

  return comments.map(c => {
    // Determine alignment: current user's messages go right, others go left
    const isOwnMessage = c.userId === currentUser.id || c.userName === currentUser.username || c.userName === currentUser.email;
    const bubbleClass = isOwnMessage ? currentUser.role : c.userRole;
    const timeStr = formatTime(c.createdAt);

    return `
      <div class="message-bubble ${bubbleClass}">
        <div>${escapeHtml(c.message)}</div>
        <div class="msg-meta">
          <span>${escapeHtml(c.userName)} (${c.userRole})</span>
          <span>${timeStr}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Render activity timeline
function renderActivity(activity) {
  if (!activity || activity.length === 0) {
    return '<div class="no-activity">No activity recorded yet.</div>';
  }

  const items = activity.map(a => {
    const timeStr = formatTime(a.createdAt);
    const icon = getActivityIcon(a.action);

    return `
      <div class="activity-item ${a.action}">
        <div class="activity-text">${icon} ${escapeHtml(a.details || a.action)}</div>
        <div class="activity-time">${escapeHtml(a.performedBy)} · ${timeStr}</div>
      </div>
    `;
  }).join('');

  return `<div class="activity-timeline">${items}</div>`;
}

// Get icon for activity type
function getActivityIcon(action) {
  const icons = {
    ticket_created: '🎫',
    status_changed: '🔄',
    agent_assigned: '👤',
    comment_added: '💬'
  };
  return icons[action] || '📝';
}

// Send a comment
async function sendComment(ticketId) {
  const input = document.getElementById('comment-input');
  const sendBtn = document.getElementById('comment-send-btn');
  const message = input.value.trim();

  if (!message) return;

  const currentUser = getCurrentUser();
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  try {
    const response = await authFetch(`/api/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        userId: currentUser.id,
        userRole: currentUser.role,
        userName: currentUser.username || currentUser.email
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error);
    }

    // Clear input
    input.value = '';

    // Refresh conversation and activity
    const [commentsRes, activityRes] = await Promise.all([
      authFetch(`/api/tickets/${ticketId}/comments`),
      authFetch(`/api/tickets/${ticketId}/activity`)
    ]);

    const comments = await commentsRes.json();
    const activity = await activityRes.json();

    // Re-render conversation
    const thread = document.getElementById('conversation-thread');
    thread.innerHTML = renderComments(comments, currentUser);
    thread.scrollTop = thread.scrollHeight;

    // Re-render activity
    const sidebar = document.querySelector('.detail-sidebar');
    if (sidebar) {
      sidebar.innerHTML = `<div class="activity-title">Activity</div>${renderActivity(activity)}`;
    }

    // Update notification count in background
    if (typeof updateNotifCount === 'function') updateNotifCount();

  } catch (error) {
    console.error('Error sending comment:', error);
    alert('Failed to send message: ' + error.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
}

// Handle Enter key to send (Shift+Enter for newline)
function handleCommentKeydown(event, ticketId) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendComment(ticketId);
  }
}

// Close ticket detail
function closeTicketDetail() {
  const overlay = document.getElementById('ticket-detail-overlay');
  if (overlay) overlay.remove();
  document.removeEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') closeTicketDetail();
}

// ─── Feature 3: Attachments Handlers ───────────────────────

// Render the list of attachments
function renderAttachments(attachments) {
  if (!attachments || attachments.length === 0) return '';

  return attachments.map(file => {
    const isImage = file.fileType.startsWith('image/');
    const sizeStr = (file.fileSize / 1024).toFixed(1) + ' KB';

    return `
      <div class="attachment-item">
        <a href="${file.fileUrl}" target="_blank" title="${escapeHtml(file.fileName)}">
          ${isImage ? `<img src="${file.fileUrl}" alt="Attachment">` : `<div class="file-icon"><i class="fas fa-file"></i></div>`}
          <div class="attachment-name">${escapeHtml(file.fileName)}</div>
          <div class="attachment-size">${sizeStr}</div>
        </a>
      </div>
    `;
  }).join('');
}

// Upload a new file
async function uploadAttachment(ticketId) {
  const fileInput = document.getElementById('detail-file-input');
  if (!fileInput.files.length) return;

  const file = fileInput.files[0];
  const currentUser = getCurrentUser();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', currentUser.id);
  formData.append('userRole', currentUser.role);
  formData.append('userName', currentUser.username || currentUser.email);

  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) throw new Error('Upload failed');

    // Refresh the attachment grid and activity
    await refreshTicketAttachments(ticketId);
    fileInput.value = ''; // Reset input

  } catch (err) {
    console.error('Upload error:', err);
    alert('Failed to upload file. Please try again.');
  }
}

// Helper to refresh attachment UI without full reload
async function refreshTicketAttachments(ticketId) {
  try {
    const [ticketRes, activityRes] = await Promise.all([
      authFetch(`/api/tickets/${ticketId}/detail`),
      authFetch(`/api/tickets/${ticketId}/activity`)
    ]);

    const ticket = await ticketRes.json();
    const activity = await activityRes.json();

    // Update grid
    const container = document.getElementById('attachment-list-container');
    const grid = document.getElementById('detail-attachment-grid');
    if (ticket.attachments.length > 0) {
      container.style.display = 'block';
      grid.innerHTML = renderAttachments(ticket.attachments);
    } else {
      container.style.display = 'none';
    }

    // Update activity
    const sidebar = document.querySelector('.detail-sidebar');
    if (sidebar) {
      sidebar.innerHTML = `<div class="activity-title">Activity</div>${renderActivity(activity)}`;
    }
  } catch (error) {
    console.error('Error refreshing attachments:', error);
  }
}

// ─── Feature 5: SLA Helpers ────────────────────────────────

function renderSlaBadge(ticket) {
  if (ticket.status === 'Resolved') return '<span class="sla-badge success">SLA: Met</span>';

  const now = new Date();
  const deadline = ticket.firstResponseAt ? new Date(ticket.slaResolveDeadline) : new Date(ticket.slaResponseDeadline);
  const totalTime = deadline - new Date(ticket.createdAt);
  const timeLeft = deadline - now;

  if (timeLeft < 0 || ticket.slaBreached) {
    return `<span class="sla-badge danger">🚨 SLA: BREACHED</span>`;
  }

  // At Risk if less than 20% time remains
  const ratio = timeLeft / totalTime;
  if (ratio < 0.2) {
    return `<span class="sla-badge warning">⏳ SLA: AT RISK (${formatTimeLeft(timeLeft)})</span>`;
  }

  return `<span class="sla-badge info">SLA: ON TRACK (${formatTimeLeft(timeLeft)})</span>`;
}

function formatTimeLeft(ms) {
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

// ─── Feature 6: Feedback Handlers ─────────────────────────

function renderFeedbackSection(ticket, currentUser) {
  if (ticket.status !== 'Resolved') return '';

  const isCustomer = currentUser.role === 'customer';
  const feedback = ticket.feedback;

  if (feedback) {
    return `
      <div class="feedback-strip">
        <div class="feedback-meta">
          <span class="label">Customer Rating:</span>
          <div class="stars readonly">${'★'.repeat(feedback.rating)}${'☆'.repeat(5 - feedback.rating)}</div>
          <p class="feedback-comment">"${escapeHtml(feedback.comment || 'No comment')}"</p>
        </div>
      </div>
    `;
  }

  if (!isCustomer) {
    return `
      <div class="feedback-strip waiting">
        <em>Waiting for customer feedback...</em>
      </div>
    `;
  }

  // Customer view (show the form)
  return `
    <div class="feedback-strip active">
      <div class="feedback-form">
        <span class="label">How was our service?</span>
        <div class="stars-input">
          <span onclick="setRating(1)">☆</span>
          <span onclick="setRating(2)">☆</span>
          <span onclick="setRating(3)">☆</span>
          <span onclick="setRating(4)">☆</span>
          <span onclick="setRating(5)">☆</span>
        </div>
        <input type="hidden" id="feedback-rating-val" value="0">
        <textarea id="feedback-comment" placeholder="Any additional comments? (optional)"></textarea>
        <button class="feedback-btn" onclick="submitFeedback('${ticket.id}')">Submit Feedback</button>
      </div>
    </div>
  `;
}

function setRating(val) {
  const stars = document.querySelectorAll('.stars-input span');
  document.getElementById('feedback-rating-val').value = val;
  stars.forEach((s, idx) => {
    s.textContent = idx < val ? '★' : '☆';
    s.classList.toggle('active', idx < val);
  });
}

async function submitFeedback(ticketId) {
  const rating = parseInt(document.getElementById('feedback-rating-val').value);
  const comment = document.getElementById('feedback-comment').value.trim();
  const currentUser = getCurrentUser();

  if (rating === 0) {
    alert('Please select a rating before submitting.');
    return;
  }

  try {
    const response = await authFetch(`/api/tickets/${ticketId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment, customerEmail: currentUser.email })
    });

    if (!response.ok) throw new Error('Feedback submission failed');

    alert('Thank you for your feedback!');
    openTicketDetail(ticketId); // Reload to show the rating

  } catch (err) {
    console.error('Feedback error:', err);
    alert('Failed to submit feedback.');
  }
}

async function draftWithAi(ticketId) {
  const btn = document.getElementById('ai-draft-btn');
  const textarea = document.getElementById('comment-input');

  // Find the last customer message for context
  const messages = document.querySelectorAll('.message-bubble.customer');
  let lastMsg = '';
  if (messages.length > 0) {
    lastMsg = messages[messages.length - 1].querySelector('div:first-child').innerText;
  } else {
    // If no customer message, draft based on ticket description
    lastMsg = "(General follow-up to initialize conversation)";
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const response = await authFetch('/api/ai/draft-response', {
      method: 'POST',
      body: JSON.stringify({ ticketId, customerMessage: lastMsg })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Drafting failed');

    textarea.value = data.draft;
    textarea.focus();
    // Auto-resize textarea
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';

  } catch (error) {
    console.error('AI Draft Error:', error);
    alert('Failed to draft response: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
  }
}

// ─── Helpers ────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}
