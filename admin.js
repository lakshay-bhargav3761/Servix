const API = "http://localhost:5000/api";

/* ---------------- STATE ---------------- */
let token;
let user;
let allRequests = [];
let allStaff = [];
let currentRequestId = null;
let statusChart = null;
let priorityChart = null;

/* ================= SLA RULES (Default) ================= */
const defaultSLARules = [
    { category: "IT", priority: "High", allowedTime: 24, warningThreshold: 10 },
    { category: "IT", priority: "Medium", allowedTime: 48, warningThreshold: 12 },
    { category: "IT", priority: "Low", allowedTime: 72, warningThreshold: 24 },
    { category: "Electrical", priority: "High", allowedTime: 12, warningThreshold: 4 },
    { category: "Electrical", priority: "Medium", allowedTime: 24, warningThreshold: 8 },
    { category: "Electrical", priority: "Low", allowedTime: 48, warningThreshold: 12 },
    { category: "Hostel", priority: "High", allowedTime: 24, warningThreshold: 8 },
    { category: "Hostel", priority: "Medium", allowedTime: 48, warningThreshold: 12 },
    { category: "Hostel", priority: "Low", allowedTime: 72, warningThreshold: 24 },
    { category: "Plumbing", priority: "High", allowedTime: 12, warningThreshold: 4 },
    { category: "Plumbing", priority: "Medium", allowedTime: 24, warningThreshold: 8 },
    { category: "Plumbing", priority: "Low", allowedTime: 48, warningThreshold: 12 },
    { category: "Other", priority: "High", allowedTime: 24, warningThreshold: 10 },
    { category: "Other", priority: "Medium", allowedTime: 48, warningThreshold: 12 },
    { category: "Other", priority: "Low", allowedTime: 72, warningThreshold: 24 }
];

/* ---------------- HELPERS ---------------- */
function getStatusDot(status, sla) {
    if (sla === "Breached") return "dot-breached";
    if (status === "Resolved") return "dot-resolved";
    if (status === "In Progress") return "dot-progress";
    return "dot-open";
}

function getInitial(name) {
    return name ? name.charAt(0).toUpperCase() : "A";
}

function formatTimeExceeded(deadline) {
    const now = new Date();
    const diff = now - new Date(deadline);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return hours > 0 ? `${hours}h exceeded` : "Within SLA";
}

function calculateResolutionTime(createdAt, updatedAt) {
    const diff = new Date(updatedAt) - new Date(createdAt);
    return Math.floor(diff / (1000 * 60 * 60));
}

/* ---------------- INIT ---------------- */
document.addEventListener("DOMContentLoaded", async () => {

    token = localStorage.getItem("token");
    user = JSON.parse(localStorage.getItem("user"));

    const profileWrapper = document.getElementById("profileWrapper");
    const profileMenu = document.getElementById("profileMenu");
    const logoutBtn = document.getElementById("logoutBtn");
    const togglePasswordBtn = document.getElementById("togglePassword");
    const passwordSection = document.getElementById("passwordSection");

    /* ================= AUTH CHECK ================= */
    if (!token || !user) {
        window.location.replace("index.html");
        return;
    }

    // Only allow Admin role
    if (user.role !== "Admin") {
        alert("Access denied. Admin only.");
        localStorage.clear();
        window.location.replace("index.html");
        return;
    }

    /* ================= LOAD DATA ================= */
    updateUserUI(user);
    await loadStaffList();
    await loadAllRequests();
    renderAnalytics();

    loadSLARules();

    /* ================= PROFILE DROPDOWN ================= */
    if (profileWrapper && profileMenu) {
        profileWrapper.addEventListener("click", (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle("active");
        });

        document.addEventListener("click", () => {
            profileMenu.classList.remove("active");
        });
    }

    /* ================= LOGOUT ================= */
    logoutBtn?.addEventListener("click", () => {
        localStorage.clear();
        window.location.replace("index.html");
    });

    /* ================= TOGGLE PASSWORD ================= */
    togglePasswordBtn?.addEventListener("click", () => {
        passwordSection.style.display =
            passwordSection.style.display === "none" ? "block" : "none";
    });

    /* ================= PROFILE FORM ================= */
    const profileForm = document.getElementById("profileForm");
    profileForm?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("profileFullName").value;
        const mobile = document.getElementById("profileMobile").value;
        const newPassword = document.getElementById("newPassword")?.value;
        const confirmPassword = document.getElementById("confirmPassword")?.value;

        if (newPassword || confirmPassword) {
            if (newPassword !== confirmPassword) {
                return alert("Passwords do not match");
            }
            if (newPassword.length < 6) {
                return alert("Password must be at least 6 characters");
            }
        }

        const res = await fetch(`${API}/auth/update-profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ name, mobile })
        });

        const data = await res.json();
        if (!res.ok) return alert(data.message || "Profile update failed");

        localStorage.setItem("user", JSON.stringify(data.user));
        updateUserUI(data.user);

        if (newPassword) {
            const passRes = await fetch(`${API}/auth/change-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ newPassword })
            });

            if (!passRes.ok) {
                const p = await passRes.json();
                return alert(p.message || "Password update failed");
            }

            alert("Password updated successfully. Please login again.");
            localStorage.clear();
            window.location.replace("index.html");
            return;
        }

        alert("Profile updated successfully");
    });

    /* ================= ASSIGN FORM ================= */
    const assignForm = document.getElementById("assignForm");
    assignForm?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const staffId = document.getElementById("assignStaff").value;

        const res = await fetch(`${API}/requests/assign/${currentRequestId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ staffId })
        });

        if (!res.ok) {
            const data = await res.json();
            return alert(data.message || "Assignment failed");
        }

        alert("Request assigned successfully");
        closeAssignModal();
        loadAllRequests();
    });

    /* ================= REASSIGN FORM ================= */
    const reassignForm = document.getElementById("reassignForm");
    reassignForm?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const staffId = document.getElementById("reassignStaff").value;
        const escalate = document.getElementById("escalatePriority").value;

        const res = await fetch(`${API}/requests/assign/${currentRequestId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ staffId })
        });

        if (!res.ok) {
            const data = await res.json();
            return alert(data.message || "Reassignment failed");
        }

        // Escalate priority if needed
        if (escalate === "High") {
            await fetch(`${API}/requests/escalate/${currentRequestId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ priority: "High" })
            });
        }

        alert("Request reassigned successfully");
        closeReassignModal();
        loadAllRequests();
    });
window.addEventListener("storage", (e) => {
  if (e.key === "lastUpdate") {
    loadAllRequests();
  }
});

    /* ================= SLA RULE FORM ================= */
 /* ================= SLA RULE FORM ================= */
const slaForm = document.getElementById("slaRuleForm");

slaForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const category = document.getElementById("slaCategory").value;
  const priority = document.getElementById("slaPriority").value;
  const allowedTime = Number(document.getElementById("slaTime").value);
  const warningThreshold = Number(document.getElementById("slaWarning").value);

  // 🔍 Find existing rule by Category + Priority
  const ruleIndex = defaultSLARules.findIndex(
    r => r.category === category && r.priority === priority
  );

  if (ruleIndex !== -1) {
    // ✅ UPDATE existing rule
    defaultSLARules[ruleIndex].allowedTime = allowedTime;
    defaultSLARules[ruleIndex].warningThreshold = warningThreshold;
  } else {
    // ➕ ADD only if rule does NOT exist
    defaultSLARules.push({
      category,
      priority,
      allowedTime,
      warningThreshold
    });
  }

  slaForm.reset();
  loadSLARules();
});
});
/* ---------------- USER UI ---------------- */
function updateUserUI(user) {
    if (!user) return;
    const initial = getInitial(user.name);

    document.getElementById("userAvatar").textContent = initial;
    document.getElementById("userName").textContent = user.name || "Admin";
    document.getElementById("userRole").textContent = user.role || "Administrator";

    if (document.getElementById("profileAvatar"))
        document.getElementById("profileAvatar").textContent = initial;

    if (document.getElementById("profileName"))
        document.getElementById("profileName").textContent = user.name || "Admin";

    if (document.getElementById("profileRole"))
        document.getElementById("profileRole").textContent = user.role || "Administrator";

    if (document.getElementById("profileFullName"))
        document.getElementById("profileFullName").value = user.name || "";

    if (document.getElementById("profileEmail"))
        document.getElementById("profileEmail").value = user.email || "";

    if (document.getElementById("profileMobile"))
        document.getElementById("profileMobile").value = user.mobile || "";
}

/* ---------------- TAB NAVIGATION ---------------- */
function showTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add("active");
    document.getElementById(tabName + "Tab")?.classList.add("active");

    // Refresh data when switching tabs
    if (tabName === "analytics") renderAnalytics();
    if (tabName === "allRequests") renderAllRequests();
    if (tabName === "assign") renderAssignTab();
    if (tabName === "breached") renderBreachedTab();
    if (tabName === "staffPerformance") renderStaffPerformanceTab();

}
function renderStaffPerformanceTab() {
  const table = document.getElementById("staffPerformanceTable");
  if (!table) return;

  table.innerHTML = "";

  allStaff.forEach(staff => {
const assigned = allRequests.filter(r => {
  if (!r.assignedTo) return false;

  // populated object (admin requests)
  if (typeof r.assignedTo === "object") {
    return r.assignedTo._id === staff._id;
  }

  // plain ObjectId (other cases)
  return r.assignedTo === staff._id;
});


    const resolved = assigned.filter(r => r.status === "Resolved");
    const breached = assigned.filter(r => r.slaStatus === "Breached");

    const performance = assigned.length
      ? Math.round((resolved.length / assigned.length) * 100)
      : 0;

    const cls =
      performance >= 80 ? "score-good" :
      performance >= 50 ? "score-average" : "score-poor";

    table.innerHTML += `
      <tr>
        <td>${staff.name}</td>
        <td>${staff.email}</td>
        <td>${staff.mobile || "-"}</td>
        <td>${assigned.length}</td>
        <td>${resolved.length}</td>
        <td>${breached.length}</td>
        <td class="${cls}">${performance}%</td>
      </tr>
    `;
  });
}

/* ================= LOAD ALL REQUESTS ================= */
async function loadAllRequests() {
  const res = await fetch(`${API}/requests/admin`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const err = await res.json();
    alert(err.message || "Failed to load requests");
    return;
  }

  allRequests = await res.json();

  renderAnalytics();
  renderAllRequests();
  renderAssignTab();
  renderBreachedTab();
  renderStaffPerformanceTab();
}


/* ================= LOAD STAFF LIST ================= */
async function loadStaffList() {
  const res = await fetch(`${API}/auth/admin/staff`, {
  headers: { Authorization: `Bearer ${token}` }
});
    if (!res.ok) return;

    allStaff = await res.json();
    populateStaffDropdowns();
}

/* ================= POPULATE STAFF DROPDOWNS ================= */
function populateStaffDropdowns() {
  const assignSelect = document.getElementById("assignStaff");
  const reassignSelect = document.getElementById("reassignStaff");
  const filterStaff = document.getElementById("filterStaff");

  const staffOptions = allStaff.map(s =>
    `<option value="${s._id}">${s.name}</option>`
  ).join("");

  if (assignSelect) {
    assignSelect.innerHTML = `<option value="">Choose staff...</option>${staffOptions}`;
  }

  if (reassignSelect) {
    reassignSelect.innerHTML = `<option value="">Choose staff...</option>${staffOptions}`;
  }

  if (filterStaff) {
    filterStaff.innerHTML = `
      <option value="all">All Staff</option>
      <option value="unassigned">Unassigned</option>
      ${staffOptions}
    `;
  }
}

function showTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add("active");
  document.getElementById(tabName + "Tab")?.classList.add("active");

  if (tabName === "analytics") renderAnalytics();
  if (tabName === "allRequests") renderAllRequests();
  if (tabName === "assign") renderAssignTab();
  if (tabName === "breached") renderBreachedTab();
}

/* ================= RENDER ANALYTICS ================= */
function renderAnalytics() {
    // Stats
    document.getElementById("analyticsTotal").textContent = allRequests.length;
    document.getElementById("analyticsBreached").textContent = 
       allRequests.filter(
  r => r.slaStatus === "Breached" && r.status !== "Resolved"
).length;


    // Average resolution time
    const resolved = allRequests.filter(r => r.status === "Resolved");
    const avgTime = resolved.length > 0
        ? Math.round(resolved.reduce((sum, r) => 
            sum + calculateResolutionTime(r.createdAt, r.updatedAt), 0) / resolved.length)
        : 0;
    document.getElementById("analyticsAvgTime").textContent = `${avgTime}h`;

    const activeStaffIds = new Set(
  allRequests
    .filter(r => r.assignedTo)
    .map(r =>
      typeof r.assignedTo === "object"
        ? r.assignedTo._id
        : r.assignedTo
    )
);

document.getElementById("analyticsStaff").textContent = activeStaffIds.size;


    // Charts
    renderStatusChart();
    renderPriorityChart();
   
}

/* ================= RENDER STATUS CHART ================= */
function renderStatusChart() {
    const ctx = document.getElementById("statusChart");
    if (!ctx) return;

    const statusCounts = {
        Open: allRequests.filter(r => r.status === "Open").length,
        "In Progress": allRequests.filter(r => r.status === "In Progress").length,
        Waiting: allRequests.filter(r => r.status === "Waiting").length,
        Resolved: allRequests.filter(r => r.status === "Resolved").length
    };

    if (statusChart) statusChart.destroy();

    statusChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ["#f59e0b", "#3b82f6", "#fbbf24", "#22c55e"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

/* ================= RENDER PRIORITY CHART ================= */
function renderPriorityChart() {
    const ctx = document.getElementById("priorityChart");
    if (!ctx) return;

    const priorityCounts = {
        High: allRequests.filter(r => r.priority === "High").length,
        Medium: allRequests.filter(r => r.priority === "Medium").length,
        Low: allRequests.filter(r => r.priority === "Low").length
    };

    if (priorityChart) priorityChart.destroy();

    priorityChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(priorityCounts),
            datasets: [{
                label: "Requests",
                data: Object.values(priorityCounts),
                backgroundColor: ["#ef4444", "#f59e0b", "#3b82f6"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

/* ================= RENDER STAFF PERFORMANCE ================= */

/* ================= RENDER ALL REQUESTS ================= */
function renderAllRequests() {
    const table = document.getElementById("allRequestsTable");
    if (!table) return;

    table.innerHTML = "";

    if (allRequests.length === 0) {
        table.innerHTML = `<tr><td colspan="9" class="text-center">No requests found</td></tr>`;
        return;
    }

    allRequests.forEach(r => {
        const assignedStaff = allStaff.find(s => s._id === r.assignedTo);
        const staffName = assignedStaff ? assignedStaff.name : "Unassigned";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <span class="status-dot ${getStatusDot(r.status, r.slaStatus)}"></span>
                ${r.reqId}
            </td>
            <td>${r.title}</td>
            <td>${r.category}</td>
            <td><span class="badge badge-${r.priority.toLowerCase()}">${r.priority}</span></td>
            <td><span class="badge badge-${r.status.toLowerCase().replace(' ', '')}">${r.status}</span></td>
            <td><span class="badge badge-${r.slaStatus.toLowerCase().replace(' ', '')}">${r.slaStatus}</span></td>
            <td>${staffName}</td>
            <td>${new Date(r.deadline).toLocaleDateString()}</td>
            <td>
                <button class="btn-link" onclick="viewRequest('${r._id}')">View</button>
            </td>
        `;
        table.appendChild(tr);
    });
}

/* ================= APPLY FILTERS (ALL REQUESTS) ================= */
function applyAllRequestsFilters() {
  const category = document.getElementById("filterCategory").value;
  const sla = document.getElementById("filterSLA").value;
  const staff = document.getElementById("filterStaff").value;

  let filtered = [...allRequests];

  // CATEGORY
  if (category !== "all") {
    filtered = filtered.filter(r => r.category === category);
  }

  // SLA
  if (sla !== "all") {
    filtered = filtered.filter(r => r.slaStatus === sla);
  }

  // STAFF
  if (staff === "unassigned") {
    filtered = filtered.filter(r => !r.assignedTo);
  } else if (staff !== "all") {
    filtered = filtered.filter(
      r => r.assignedTo && r.assignedTo._id === staff
    );
  }
  console.log("ALL:", allRequests);
console.log("FILTERED:", filtered);

  renderAllRequests(filtered);
}

/* ================= RENDER ASSIGN TAB ================= */
function renderAssignTab() {
    // Unassigned requests
    const unassignedTable = document.getElementById("unassignedTable");
    if (unassignedTable) {
        const unassigned = allRequests.filter(r => !r.assignedTo);
        
        unassignedTable.innerHTML = "";

        if (unassigned.length === 0) {
            unassignedTable.innerHTML = `<tr><td colspan="7" class="text-center">No unassigned requests</td></tr>`;
        } else {
            unassigned.forEach(r => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>
                        <span class="status-dot ${getStatusDot(r.status, r.slaStatus)}"></span>
                        ${r.reqId}
                    </td>
                    <td>${r.title}</td>
                    <td>${r.category}</td>
                    <td><span class="badge badge-${r.priority.toLowerCase()}">${r.priority}</span></td>
                    <td><span class="badge badge-${r.slaStatus.toLowerCase().replace(' ', '')}">${r.slaStatus}</span></td>
                    <td>${new Date(r.deadline).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-primary" onclick="openAssignModal('${r._id}')">Assign</button>
                    </td>
                `;
                unassignedTable.appendChild(tr);
            });
        }
    }

    // Delayed/Breached requests
    const delayedTable = document.getElementById("delayedTable");
    if (delayedTable) {
        const delayed = allRequests.filter(r => 
            r.assignedTo && 
            (r.slaStatus === "Breached" || r.slaStatus === "Near Breach") &&
            r.status !== "Resolved"
        );

        delayedTable.innerHTML = "";

        if (delayed.length === 0) {
            delayedTable.innerHTML = `<tr><td colspan="7" class="text-center">No delayed requests</td></tr>`;
        } else {
            delayed.forEach(r => {
                const assignedStaff = allStaff.find(s => s._id === r.assignedTo);
                const staffName = assignedStaff ? assignedStaff.name : "Unknown";

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>
                        <span class="status-dot ${getStatusDot(r.status, r.slaStatus)}"></span>
                        ${r.reqId}
                    </td>
                    <td>${r.title}</td>
                    <td>${staffName}</td>
                    <td><span class="badge badge-${r.priority.toLowerCase()}">${r.priority}</span></td>
                    <td><span class="badge badge-${r.slaStatus.toLowerCase().replace(' ', '')}">${r.slaStatus}</span></td>
                    <td>${formatTimeExceeded(r.deadline)}</td>
                    <td>
                        <button class="btn-warning" onclick="openReassignModal('${r._id}')">Reassign</button>
                    </td>
                `;
                delayedTable.appendChild(tr);
            });
        }
    }
}

/* ================= RENDER BREACHED TAB ================= */
function renderBreachedTab() {
    const breached = allRequests.filter(r => r.slaStatus === "Breached");

    document.getElementById("breachedTotal").textContent = breached.length;
    document.getElementById("breachedCritical").textContent = 
        breached.filter(r => r.priority === "High").length;

    const table = document.getElementById("breachedRequestsTable");
    if (!table) return;

    table.innerHTML = "";

    if (breached.length === 0) {
        table.innerHTML = `<tr><td colspan="7" class="text-center">No breached requests</td></tr>`;
        return;
    }

    breached.forEach(r => {
        const assignedStaff = allStaff.find(s => s._id === r.assignedTo);
        const staffName = assignedStaff ? assignedStaff.name : "Unassigned";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <span class="status-dot dot-breached"></span>
                ${r.reqId}
            </td>
            <td>${r.title}</td>
            <td>${r.category}</td>
            <td><span class="badge badge-${r.priority.toLowerCase()}">${r.priority}</span></td>
            <td>${staffName}</td>
            <td>${formatTimeExceeded(r.deadline)}</td>
            <td>
                <button class="btn-action btn-reassign" onclick="openReassignModal('${r._id}')">
  Reassign
</button>

            </td>
        `;
        table.appendChild(tr);
    });
}

/* ================= LOAD SLA RULES ================= */
function loadSLARules() {
  const table = document.getElementById("slaRulesTable");
  table.innerHTML = "";

  defaultSLARules.forEach((rule, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rule.category}</td>
      <td>
        <span class="badge badge-${rule.priority.toLowerCase()}">
          ${rule.priority}
        </span>
      </td>
      <td>${rule.allowedTime} hours</td>
      <td>${rule.warningThreshold} hours</td>
      
    `;
    table.appendChild(tr);
  });
}
let editingRuleIndex = null;

function editSLARule(index) {
  const rule = defaultSLARules[index];

  document.getElementById("slaCategory").value = rule.category;
  document.getElementById("slaPriority").value = rule.priority;
  document.getElementById("slaTime").value = rule.allowedTime;
  document.getElementById("slaWarning").value = rule.warningThreshold;

  editingRuleIndex = index;
}


/* ================= VIEW REQUEST ================= */
async function viewRequest(id) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API}/requests/one/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) return alert("Failed to fetch request details");

  const request = await res.json();

  document.getElementById("viewReqId").innerHTML =
    `<span class="status-dot ${getStatusDot(request.status, request.slaStatus)}"></span>${request.reqId}`;

  document.getElementById("viewCategory").textContent = request.category;
  document.getElementById("viewPriority").textContent = request.priority;
  document.getElementById("viewStatus").textContent = request.status;
  document.getElementById("viewSLA").textContent = request.slaStatus;
  document.getElementById("viewDeadline").textContent =
    new Date(request.deadline).toLocaleString();

  document.getElementById("viewTitle").textContent = request.title;
  document.getElementById("viewDescription").textContent = request.description;
  document.getElementById("viewNotes").textContent =
    request.resolutionNotes || "No notes yet.";

  document.getElementById("viewRequestModal").classList.add("active");
}

function closeViewModal() {
    document.getElementById("viewRequestModal").classList.remove("active");
}

/* ================= ASSIGN MODAL ================= */
function openAssignModal(id) {
    currentRequestId = id;
    const request = allRequests.find(r => r._id === id);

    document.getElementById("assignReqId").textContent = request.reqId;
    document.getElementById("assignTitle").textContent = request.title;

    document.getElementById("assignModal").classList.add("active");
}

function renderAllRequests(data = allRequests) {
  const table = document.getElementById("allRequestsTable");
  table.innerHTML = "";

  // USE data, not allRequests
  if (data.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="9" class="text-center">No requests found</td>
      </tr>`;
    return;
  }

  data.forEach(r => {
    const staffName =
      typeof r.assignedTo === "object"
        ? r.assignedTo?.name
        : allStaff.find(s => s._id === r.assignedTo)?.name || "Unassigned";

    table.innerHTML += `
      <tr>
        <td>${r.reqId}</td>
        <td>${r.title}</td>
        <td>${r.category}</td>
        <td>${r.priority}</td>
        <td>${r.status}</td>
        <td>${r.slaStatus}</td>
        <td>${staffName}</td>
        <td>${new Date(r.deadline).toLocaleDateString()}</td>
        <td>
          <button class="btn-link" onclick="viewRequest('${r._id}')">View</button>
        </td>
      </tr>`;
  });
}

function showTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add("active");
  document.getElementById(tabName + "Tab")?.classList.add("active");

  if (tabName === "analytics") renderAnalytics();
  if (tabName === "allRequests") renderAllRequests();
  if (tabName === "assign") renderAssignTab();
  if (tabName === "breached") renderBreachedTab();
}


function closeAssignModal() {
    currentRequestId = null;
    document.getElementById("assignModal").classList.remove("active");
    document.getElementById("assignForm").reset();
}

/* ================= REASSIGN MODAL ================= */
function openReassignModal(id) {
    currentRequestId = id;
    const request = allRequests.find(r => r._id === id);
    const assignedStaff = allStaff.find(s => s._id === request.assignedTo);

    document.getElementById("reassignReqId").textContent = request.reqId;
    document.getElementById("reassignCurrentStaff").textContent = 
        assignedStaff ? assignedStaff.name : "Unassigned";

    document.getElementById("reassignModal").classList.add("active");
}

function closeReassignModal() {
    currentRequestId = null;
    document.getElementById("reassignModal").classList.remove("active");
    document.getElementById("reassignForm").reset();
}