/**
 * Campus Issue Reporting & Tracking System - Frontend Application Logic
 * Course: UCS531 - Cloud Computing
 */

// Default placeholder - replace with your deployed API Gateway invoke URL
// e.g., "https://abcdef123.execute-api.us-east-1.amazonaws.com/dev"
const DEFAULT_API_URL = window.CAMPUS_API_URL || "https://REPLACE_WITH_YOUR_API_GATEWAY_URL";

// Retrieve API URL from localStorage, or use default
function getApiBaseUrl() {
  const saved = localStorage.getItem("CAMPUS_API_URL");
  const url = (saved && saved.trim()) ? saved.trim() : DEFAULT_API_URL;
  return url.replace(/\/+$/, ""); // remove trailing slashes
}

function setApiBaseUrl(url) {
  if (url) {
    localStorage.setItem("CAMPUS_API_URL", url.trim().replace(/\/+$/, ""));
    showToast("API Endpoint saved!", "success");
    updateApiStatusUI();
  }
}

// Toast notification helper
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function createToastContainer() {
  const container = document.createElement("div");
  container.id = "toast-container";
  document.body.appendChild(container);
  return container;
}

// Modal helper for viewing images
function openImageModal(src, title) {
  const modal = document.getElementById("image-modal");
  const modalImg = document.getElementById("modal-image");
  const modalTitle = document.getElementById("modal-title");
  if (modal && modalImg) {
    modalImg.src = src;
    if (modalTitle) modalTitle.textContent = title || "Attached Issue Photo";
    modal.classList.add("active");
  }
}

function closeImageModal() {
  const modal = document.getElementById("image-modal");
  if (modal) modal.classList.remove("active");
}

// Update API status display in the header bar
async function updateApiStatusUI() {
  const input = document.getElementById("api-base-url-input");
  const statusDot = document.getElementById("api-status-dot");
  const statusText = document.getElementById("api-status-text");

  const currentUrl = getApiBaseUrl();
  if (input) input.value = currentUrl;

  if (currentUrl.includes("REPLACE_WITH_YOUR_API_GATEWAY_URL")) {
    if (statusDot) {
      statusDot.className = "status-dot offline";
    }
    if (statusText) {
      statusText.textContent = "API URL Not Configured";
    }
    return;
  }

  // Quick connectivity test
  try {
    const res = await fetch(`${currentUrl}/issues`, { method: "OPTIONS" });
    if (res.ok || res.status === 200 || res.status === 204) {
      if (statusDot) statusDot.className = "status-dot online";
      if (statusText) statusText.textContent = "Connected to AWS API";
    } else {
      if (statusDot) statusDot.className = "status-dot online";
      if (statusText) statusText.textContent = "Online";
    }
  } catch (err) {
    if (statusDot) statusDot.className = "status-dot offline";
    if (statusText) statusText.textContent = "Connecting / Offline";
  }
}

// ============================================================================
// STUDENT VIEW CONTROLLER (index.html)
// ============================================================================
function initStudentPortal() {
  const issueForm = document.getElementById("issue-form");
  const trackBtn = document.getElementById("track-btn");
  const trackInput = document.getElementById("track-student-id");

  // Pre-fill student ID from localStorage if remembered
  const savedStudentId = localStorage.getItem("LAST_STUDENT_ID");
  if (savedStudentId) {
    const studentIdInput = document.getElementById("student-id");
    if (studentIdInput) studentIdInput.value = savedStudentId;
    if (trackInput) trackInput.value = savedStudentId;
    loadStudentIssues(savedStudentId);
  }

  // Handle Form Submission
  if (issueForm) {
    issueForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById("submit-issue-btn");
      const originalBtnText = submitBtn.innerHTML;

      const studentId = document.getElementById("student-id").value.trim();
      const studentEmail = document.getElementById("student-email").value.trim();
      const category = document.getElementById("category").value;
      const title = document.getElementById("title").value.trim();
      const description = document.getElementById("description").value.trim();

      if (!studentId || !studentEmail || !category || !title || !description) {
        showToast("Please fill in all required fields.", "error");
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "<span>⏳ Submitting...</span>";

        submitBtn.innerHTML = "<span>💾 Saving Issue...</span>";
        const apiUrl = getApiBaseUrl();

        const now = new Date().toISOString();
        const issueId = (window.crypto && typeof window.crypto.randomUUID === "function")
          ? window.crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
        const payload = {
          issueId,
          studentId,
          studentEmail,
          category,
          title,
          description,
          createdAt: now,
          updatedAt: now
        };

        const response = await fetch(`${apiUrl}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const resData = await response.json();

        if (!response.ok) {
          throw new Error(resData.error || "Failed to submit issue");
        }

        showToast(`Issue #${issueId.slice(0, 8)} created successfully!`, "success");
        localStorage.setItem("LAST_STUDENT_ID", studentId);

        // Reset form
        issueForm.reset();

        // Refresh track view
        if (trackInput) trackInput.value = studentId;
        loadStudentIssues(studentId);
      } catch (err) {
        console.error("Submission error:", err);
        showToast(`Error: ${err.message}`, "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    });
  }

  // Handle Track By Student ID button
  if (trackBtn && trackInput) {
    trackBtn.addEventListener("click", () => {
      const sid = trackInput.value.trim();
      if (!sid) {
        showToast("Please enter a Student ID to query.", "error");
        return;
      }
      localStorage.setItem("LAST_STUDENT_ID", sid);
      loadStudentIssues(sid);
    });
  }
}

// Load issues submitted by a specific student (via GSI Query)
async function loadStudentIssues(studentId) {
  const container = document.getElementById("student-issues-container");
  const countBadge = document.getElementById("student-issues-count");
  if (!container) return;

  container.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Querying DynamoDB StudentIndex GSI...</div>`;

  try {
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/issues?studentId=${encodeURIComponent(studentId)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load issues");
    }

    const issues = data.issues || [];
    if (countBadge) countBadge.textContent = `${issues.length} Issues`;

    if (issues.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 2.5rem; background: #fff; border: 1px dashed var(--border); border-radius: var(--radius-md);">
          <p style="font-size: 1.1rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.25rem;">No issues found</p>
          <p style="font-size: 0.85rem; color: var(--text-muted);">No reports registered under Student ID: <strong>${escapeHtml(studentId)}</strong>.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = issues.map(renderStudentIssueCard).join("");
  } catch (err) {
    console.error("Error fetching student issues:", err);
    container.innerHTML = `
      <div style="padding: 1.5rem; background: var(--danger-bg); color: var(--danger-text); border-radius: var(--radius-md);">
        <strong>Error loading issues:</strong> ${escapeHtml(err.message)}. Please verify the API Gateway URL.
      </div>
    `;
  }
}

function renderStudentIssueCard(issue) {
  const statusBadge = getStatusBadge(issue.status);
  const formattedDate = new Date(issue.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });

  return `
    <div class="issue-card">
      <div class="issue-header">
        <div>
          <div class="issue-header-title">${escapeHtml(issue.title)}</div>
          <div class="issue-meta">
            <span class="badge badge-category">${escapeHtml(issue.category)}</span>
            <span>ID: <code>${escapeHtml(issue.issueId.slice(0, 8))}</code></span>
            <span>•</span>
            <span>Submitted: ${formattedDate}</span>
          </div>
        </div>
        <div>${statusBadge}</div>
      </div>
      <div class="issue-desc">${escapeHtml(issue.description)}</div>
    </div>
  `;
}

// ============================================================================
// ADMIN VIEW CONTROLLER (admin.html)
// ============================================================================
let allAdminIssues = [];
let currentFilter = "All";

function initAdminPortal() {
  loadAdminIssues();

  const refreshBtn = document.getElementById("admin-refresh-btn");
  if (refreshBtn) refreshBtn.addEventListener("click", loadAdminIssues);

  const statusFilter = document.getElementById("admin-filter-status");
  if (statusFilter) {
    statusFilter.addEventListener("change", (e) => {
      currentFilter = e.target.value;
      renderAdminTable();
    });
  }

  const searchInput = document.getElementById("admin-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderAdminTable();
    });
  }
}

async function loadAdminIssues() {
  const tableBody = document.getElementById("admin-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading campus complaints...</td></tr>`;

  try {
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/admin/issues`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load issues from API");
    }

    allAdminIssues = data.issues || [];
    updateMetrics(allAdminIssues);
    renderAdminTable();
  } catch (err) {
    console.error("Admin fetch error:", err);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--danger);">Error loading issues: ${escapeHtml(err.message)}. Check API configuration.</td></tr>`;
  }
}

function updateMetrics(issues) {
  const total = issues.length;
  const openCount = issues.filter(i => i.status === "Open").length;
  const progressCount = issues.filter(i => i.status === "In Progress").length;
  const resolvedCount = issues.filter(i => i.status === "Resolved").length;

  const totalEl = document.getElementById("metric-total");
  const openEl = document.getElementById("metric-open");
  const progressEl = document.getElementById("metric-progress");
  const resolvedEl = document.getElementById("metric-resolved");

  if (totalEl) totalEl.textContent = total;
  if (openEl) openEl.textContent = openCount;
  if (progressEl) progressEl.textContent = progressCount;
  if (resolvedEl) resolvedEl.textContent = resolvedCount;
}

function renderAdminTable() {
  const tableBody = document.getElementById("admin-table-body");
  const searchInput = document.getElementById("admin-search-input");
  const query = (searchInput ? searchInput.value : "").toLowerCase().trim();

  if (!tableBody) return;

  let filtered = allAdminIssues.filter(item => {
    if (currentFilter !== "All" && item.status !== currentFilter) {
      return false;
    }
    if (query) {
      const matchTitle = item.title && item.title.toLowerCase().includes(query);
      const matchDesc = item.description && item.description.toLowerCase().includes(query);
      const matchStudent = item.studentId && item.studentId.toLowerCase().includes(query);
      const matchEmail = item.studentEmail && item.studentEmail.toLowerCase().includes(query);
      const matchId = item.issueId && item.issueId.toLowerCase().includes(query);
      return matchTitle || matchDesc || matchStudent || matchEmail || matchId;
    }
    return true;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2.5rem; color: var(--text-muted);">No issues match current filters.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(issue => {
    const formattedDate = new Date(issue.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    return `
      <tr>
        <td>
          <code title="${escapeHtml(issue.issueId)}" style="cursor:help;">${escapeHtml(issue.issueId.slice(0, 8))}</code>
        </td>
        <td>
          <strong>${escapeHtml(issue.studentId)}</strong><br>
          <small style="color:var(--text-muted);">${escapeHtml(issue.studentEmail)}</small>
        </td>
        <td>
          <span class="badge badge-category">${escapeHtml(issue.category)}</span>
        </td>
        <td>
          <strong>${escapeHtml(issue.title)}</strong>
          <div style="font-size:0.8rem; color:#475569; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHtml(issue.description)}
          </div>
          <small style="color:var(--text-muted); font-size:0.72rem;">${formattedDate}</small>
        </td>
        <td>
          <span id="badge-${escapeHtml(issue.issueId)}">${getStatusBadge(issue.status)}</span>
        </td>
        <td>
          <div class="action-group">
            <select id="select-${escapeHtml(issue.issueId)}" class="status-select">
              <option value="Open" ${issue.status === 'Open' ? 'selected' : ''}>Open</option>
              <option value="In Progress" ${issue.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Resolved" ${issue.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
            </select>
            <button class="btn btn-primary btn-sm" id="btn-update-${escapeHtml(issue.issueId)}" data-issue-id="${escapeHtml(issue.issueId)}">
              Update
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tableBody.querySelectorAll("button[data-issue-id]").forEach(button => {
    button.addEventListener("click", () => handleAdminStatusChange(button.dataset.issueId));
  });
}

// Admin status change handler
async function handleAdminStatusChange(issueId) {
  const select = document.getElementById(`select-${issueId}`);
  const updateBtn = document.getElementById(`btn-update-${issueId}`);
  if (!select) return;

  const newStatus = select.value;
    const originalBtnHtml = updateBtn.innerHTML;

  try {
    updateBtn.disabled = true;
    updateBtn.innerHTML = "Saving...";

    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/issues/${issueId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus,
        updatedAt: new Date().toISOString()
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to update status");
    }

    showToast(`Issue #${issueId.slice(0, 8)} updated to "${newStatus}".`, "success");

    // Update in-memory data
    const target = allAdminIssues.find(i => i.issueId === issueId);
    if (target) {
      target.status = newStatus;
      target.updatedAt = new Date().toISOString();
    }

    // Refresh UI
    updateMetrics(allAdminIssues);
    const badgeContainer = document.getElementById(`badge-${issueId}`);
    if (badgeContainer) badgeContainer.innerHTML = getStatusBadge(newStatus);
  } catch (err) {
    console.error("Status update error:", err);
    showToast(`Update failed: ${err.message}`, "error");
  } finally {
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.innerHTML = originalBtnHtml;
    }
  }
}

// Helpers
function getStatusBadge(status) {
  switch (status) {
    case "Open":
      return `<span class="badge badge-open">● Open</span>`;
    case "In Progress":
      return `<span class="badge badge-in-progress">⚡ In Progress</span>`;
    case "Resolved":
      return `<span class="badge badge-resolved">✓ Resolved</span>`;
    default:
      return `<span class="badge">${escapeHtml(status || "Unknown")}</span>`;
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Global initialization
document.addEventListener("DOMContentLoaded", () => {
  updateApiStatusUI();

  // Handle Save API button in top bar
  const saveApiBtn = document.getElementById("api-save-btn");
  const apiInput = document.getElementById("api-base-url-input");
  if (saveApiBtn && apiInput) {
    saveApiBtn.addEventListener("click", () => {
      setApiBaseUrl(apiInput.value);
    });
  }

});

