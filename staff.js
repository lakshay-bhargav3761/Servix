const API = "http://localhost:5000/api";

/* ---------------- STATE ---------------- */
let token;
let user;
let currentRequestId = null;
let currentRequestData = null;
let recentUpdates = JSON.parse(localStorage.getItem("recentUpdates")) || [];
let lastSeenUpdate = localStorage.getItem("lastUpdate");
let allAssignedRequests = [];

/* ---------------- STATUS DOT ---------------- */
function getStatusDot(status, sla){
  if(sla === "Breached") return "dot-breached";
  if(status === "Resolved") return "dot-resolved";
  if(status === "In Progress") return "dot-progress";
  return "dot-open";
}

/* ---------------- INIT ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  token = localStorage.getItem("token");
  user = JSON.parse(localStorage.getItem("user"));

  const profileWrapper = document.getElementById("profileWrapper");
  const profileMenu = document.getElementById("profileMenu");
  /* ================= FILTER EVENTS ================= */
document.getElementById("priorityFilter")?.addEventListener("change", applyFilters);
document.getElementById("slaFilter")?.addEventListener("change", applyFilters);

  /* ================= AUTH CHECK ================= */
  if (!token || !user) {
    window.location.replace("index.html");
    return;
  }

  if (user.role !== "Staff") {
    window.location.replace("index.html");
    return;
  }

  /* ================= LOAD STAFF DASHBOARD ================= */
  updateUserUI(user);
  loadAssignedRequests();
  renderRecentUpdates();
  setupEvents();

  /* ================= INSTANT SYNC LISTENER ================= */
  setInterval(() => {
    const t = localStorage.getItem("lastUpdate");
    if (t && t !== lastSeenUpdate) {
      lastSeenUpdate = t;
      loadAssignedRequests();
    }
  }, 3000);

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
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "logoutBtn") {
      e.preventDefault();
      localStorage.clear();
      window.location.replace("index.html");
    }
  });
});
/* ================= TOGGLE PASSWORD SECTION ================= */
const togglePasswordBtn = document.getElementById("togglePassword");
const passwordSection = document.getElementById("passwordSection");

togglePasswordBtn?.addEventListener("click", () => {
  passwordSection.style.display =
    passwordSection.style.display === "none" ? "block" : "none";
});
async function searchRequest() {
  const reqIdInput = document.getElementById("searchRequestId");
  const reqId = reqIdInput.value.trim();

  if (!reqId) {
    return alert("Please enter a Request ID");
  }

  const res = await fetch(`${API}/requests/search/${reqId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    return alert("Request not found");
  }

  const request = await res.json();

  // 🔥 SAME FLOW AS CLICKING UPDATE
  currentRequestId = request._id;
  currentRequestData = request;

  showTab("update");
  displayRequestDetails(request);

  // reset form
  document.getElementById("updateStatusForm").reset();
}

/* ---------------- USER UI ---------------- */
function updateUserUI(user){
  document.getElementById("userAvatar").textContent =
    user.name?.charAt(0).toUpperCase() || "S";

  document.getElementById("userName").textContent = user.name || "Staff";
  document.getElementById("userRole").textContent = user.role || "Staff";

  if (document.getElementById("profileAvatar"))
    document.getElementById("profileAvatar").textContent =
      user.name?.charAt(0).toUpperCase() || "S";

  if (document.getElementById("profileName"))
    document.getElementById("profileName").textContent = user.name || "Staff";

  if (document.getElementById("profileRole"))
    document.getElementById("profileRole").textContent = user.role || "Staff";

  if (document.getElementById("profileFullName"))
    document.getElementById("profileFullName").value = user.name || "";

  if (document.getElementById("profileEmail"))
    document.getElementById("profileEmail").value = user.email || "";

  if (document.getElementById("profileMobile"))
    document.getElementById("profileMobile").value = user.mobile || "";
}

/* ---------------- TAB ---------------- */
function showTab(tabName){
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c=>c.classList.remove("active"));
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add("active");
  document.getElementById(tabName+"Tab")?.classList.add("active");
}

/* ---------------- LOAD ASSIGNED ---------------- */
async function loadAssignedRequests(){
  const res = await fetch(`${API}/requests/assigned`,{
    headers:{ Authorization:`Bearer ${token}` }
  });

  if(!res.ok) return;

  const list = await res.json();
  allAssignedRequests = list;

  // ✅ FORCE INITIAL RENDER (NO FILTERS)
  renderStats(allAssignedRequests);
  renderAssignedTable(allAssignedRequests);
}

/* ---------------- STATS ---------------- */
function renderStats(list){
  document.getElementById("totalAssigned").innerText = list.length;
  document.getElementById("pendingCount").innerText = list.filter(r=>r.status==="Open").length;
  document.getElementById("inProgressCount").innerText = list.filter(r=>r.status==="In Progress").length;
  document.getElementById("breachedCount").innerText = list.filter(r=>r.slaStatus==="Breached").length;
}

/* ---------------- TABLE ---------------- */
function renderAssignedTable(list){
  const table = document.getElementById("assignedRequestsTable");
   if (!table) return;  
  table.innerHTML = "";

  if(!list.length){
    table.innerHTML = `<tr><td colspan="8">No requests assigned</td></tr>`;
    return;
  }

  list.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="status-dot ${getStatusDot(r.status,r.slaStatus)}"></span>${r.reqId}</td>
      <td>${r.title}</td>
      <td>${r.category}</td>
      <td>${r.priority}</td>
      <td>${r.status}</td>
      <td>${r.slaStatus}</td>
      <td>${new Date(r.deadline).toLocaleString()}</td>
      <td><button class="btn-link" onclick="openUpdate('${r._id}')">Update</button></td>
    `;
    table.appendChild(tr);
  });
}

/* ---------------- OPEN UPDATE ---------------- */
function openUpdate(id){
  currentRequestId = id;
  showTab("update");
  loadRequestById(id);
}
function applyFilters() {
  const priority = document.getElementById("priorityFilter")?.value || "all";
  const sla = document.getElementById("slaFilter")?.value || "all";

  let filtered = [...allAssignedRequests];

  if (priority !== "all") {
    filtered = filtered.filter(r => r.priority === priority);
  }

  if (sla !== "all") {
    filtered = filtered.filter(r => r.slaStatus === sla);
  }

  renderStats(filtered);
  renderAssignedTable(filtered);
}

/* ---------------- LOAD SINGLE ---------------- */
async function loadRequestById(id){
  const res = await fetch(`${API}/requests/one/${id}`,{
    headers:{ Authorization:`Bearer ${token}` }
  });

  if(!res.ok) return;
  currentRequestData = await res.json();
  displayRequestDetails(currentRequestData);
}
/* ================= STAFF PROFILE UPDATE ================= */
/* ================= PROFILE UPDATE + PASSWORD ================= */
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

  const token = localStorage.getItem("token");

  /* -------- UPDATE PROFILE -------- */
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

  /* -------- UPDATE PASSWORD -------- */
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

/* ---------------- DETAILS ---------------- */
function displayRequestDetails(r){
  const card = document.getElementById("requestDetailsCard");
  card.style.display = "block";

  document.getElementById("detailReqId").innerHTML =
    `<span class="status-dot ${getStatusDot(r.status,r.slaStatus)}"></span>${r.reqId}`;

  document.getElementById("detailCategory").textContent = r.category;
  document.getElementById("detailPriority").textContent = r.priority;
  document.getElementById("detailStatus").textContent = r.status;
  document.getElementById("detailSLA").textContent = r.slaStatus;
  document.getElementById("detailDeadline").textContent = new Date(r.deadline).toLocaleString();
  document.getElementById("detailTitle").textContent = r.title;
  document.getElementById("detailDescription").textContent = r.description;
    // 🔥 HIDE RECENT UPDATES WHEN UPDATE FORM IS OPEN
const recentUpdatesContainer = document.getElementById("recentUpdatesContainer");
if (recentUpdatesContainer) {
  recentUpdatesContainer.style.display = "none";
}

}

/* ---------------- RECENT UPDATES ---------------- */
function renderRecentUpdates(){
  const box = document.getElementById("recentUpdates");
  box.innerHTML = "";

  if(!recentUpdates.length){
    box.innerHTML = `<p class="text-muted">No updates yet</p>`;
    return;
  }

  recentUpdates.forEach(u=>{
    box.innerHTML += `
      <div class="activity-item">
        <div class="activity-dot dot-progress"></div>
        <div class="activity-content">
          <p>Request <b>${u.reqId}</b> → <b>${u.status}</b></p>
          <small>${u.time}</small>
        </div>
      </div>
    `;
  });
}

/* ---------------- EVENTS ---------------- */
function setupEvents(){
  document.getElementById("updateStatusForm").addEventListener("submit", async e=>{
    e.preventDefault();

    if(!currentRequestId) return;

    const status = document.getElementById("newStatus").value;
    const notes = document.getElementById("resolutionNotes").value;

    const res = await fetch(`${API}/requests/update-status/${currentRequestId}`,{
      method:"PUT",
      headers:{
        "Content-Type":"application/json",
        Authorization:`Bearer ${token}`
      },
      body:JSON.stringify({ status, notes })
    });

    if(!res.ok) return;

    recentUpdates.unshift({
      reqId: currentRequestData.reqId,
      status,
      time: new Date().toLocaleString()
    });

    localStorage.setItem("recentUpdates", JSON.stringify(recentUpdates));
    renderRecentUpdates();

    document.getElementById("updateStatusForm").reset();
    document.getElementById("requestDetailsCard").style.display = "none";
    currentRequestId = null;

    loadAssignedRequests();
  });
}
