let cancelMode = false;
const API = "http://localhost:5000/api";

/* ---------------- PAGE & TAB NAVIGATION ---------------- */
function showPage(pageName) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const t = document.getElementById(pageName + "Page");
  if (t) t.classList.add("active");
}

function showTab(tabName) {
  document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.getElementById(tabName + "Tab")?.classList.add("active");
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add("active");
}

/* ---------------- USER UI ---------------- */
function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : "U";
}

function updateUserUI(user) {
  if (!user) return;
  const initial = getInitial(user.name);

  const map = {
    userAvatar: initial,
    userName: user.name,
    userRole: user.role,
    profileAvatar: initial,
    profileName: user.name,
    profileRole: user.role
  };

  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = map[id];
  });

  document.getElementById("profileFullName")?.setAttribute("value", user.name || "");
  document.getElementById("profileEmail")?.setAttribute("value", user.email || "");
  document.getElementById("profileMobile")?.setAttribute("value", user.mobile || "");
}

/* ---------------- INIT ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  const profileWrapper = document.getElementById("profileWrapper");
  const profileMenu = document.getElementById("profileMenu");
  const logoutBtn = document.getElementById("logoutBtn");
  const cancelBtn = document.getElementById("cancelRequestBtn");

  /* ================= AUTH ================= */
  if (!token || !user) {
    showPage("landing");
  } else {
    if (user.role === "Staff") {
      window.location.replace("staff.html");
      return;
    }
    updateUserUI(user);
    showPage("dashboard");
    loadDashboard();
  }
  /* ================= REGISTER ================= */
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("registerName").value.trim();
const email = document.getElementById("registerEmail").value.trim();
const password = document.getElementById("registerPassword").value;
const role = document.getElementById("registerRole").value;

const res = await fetch(`${API}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, email, password, role })
});


    const data = await res.json();

    if (!res.ok) {
      return alert(data.message || "Registration failed");
    }

    // auto login after register
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

alert("Registration successful. Please login.");
showPage("login");
  });
}

  /* ================= PROFILE MENU ================= */
  if (profileWrapper && profileMenu) {
    profileWrapper.addEventListener("click", e => {
      e.stopPropagation();
      profileMenu.classList.toggle("active");
    });
    profileMenu.addEventListener("click", e => e.stopPropagation());
    document.addEventListener("click", () => profileMenu.classList.remove("active"));
  }

  /* ================= LOGOUT ================= */
  logoutBtn?.addEventListener("click", () => {
    localStorage.clear();
    window.location.replace("index.html");
  });

  /* ================= CANCEL MODE ================= */
  cancelBtn?.addEventListener("click", () => {
    cancelMode = !cancelMode;
    cancelBtn.textContent = cancelMode ? "Exit Cancel Mode" : "Cancel Request";
    loadDashboard();
  });
  /* ================= TOGGLE PASSWORD SECTION ================= */
const togglePasswordBtn = document.getElementById("togglePassword");
const passwordSection = document.getElementById("passwordSection");

togglePasswordBtn?.addEventListener("click", () => {
  passwordSection.style.display =
    passwordSection.style.display === "none" ? "block" : "none";
});

  /* ================= CANCEL REQUEST (FIXED) ================= */
  document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("cancel-cross")) return;

    const id = e.target.dataset.id;
    if (!id) return;

    const token = localStorage.getItem("token");

    const res = await fetch(`${API}/requests/cancel/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const data = await res.json();
      return alert(data.message || "Cancel failed");
    }

    // 🔥 sync user + staff dashboards
    localStorage.setItem("lastUpdate", Date.now().toString());

    loadDashboard();
  });

  /* ================= RAISE REQUEST ================= */
  const raiseForm = document.getElementById("raiseRequestForm");
  if (raiseForm) {
    raiseForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const title = document.getElementById("requestTitle").value;
      const category = document.getElementById("requestCategory").value;
      const priority = document.getElementById("requestPriority").value;
      const description = document.getElementById("requestDescription").value;

      await fetch(`${API}/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title, category, priority, description })
      });

      localStorage.setItem("lastUpdate", Date.now().toString());
      raiseForm.reset();
      await loadDashboard();
      showTab("requests");
    });
  }

  /* ================= LOGIN ================= */
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;

      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) return alert(data.message || "Login failed");

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      if (data.user.role === "Admin") {
  window.location.replace("admin.html");
} else if (data.user.role === "Staff") {
  window.location.replace("staff.html");
} else {
  window.location.replace("index.html");
}
    });
  }
});

/* ---------------- DASHBOARD ---------------- */
async function loadDashboard() {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API}/requests/user`, {
  headers: { Authorization: `Bearer ${token}` }
});


  if (!res.ok) return;

  const r = await res.json();
  renderStats(r);
  renderRequests(r);
  renderActivity(r);
}

function renderStats(r) {
  document.getElementById("totalCount").innerText = r.length;
  document.getElementById("openCount").innerText = r.filter(x => x.status === "Open").length;
  document.getElementById("resolvedCount").innerText = r.filter(x => x.status === "Resolved").length;
  document.getElementById("breachedCount").innerText = r.filter(x => x.slaStatus === "Breached").length;
}

function getDotClass(status, slaStatus) {
  if (slaStatus === "Breached") return "dot-red";
  if (status === "In Progress") return "dot-orange";
  return "dot-green";
}

function renderRequests(r) {
  r = r.filter(x => x.status !== "Cancelled");

  const t = document.querySelector(".requests-table tbody");
  if (!t) return;

  t.innerHTML = r.length ? "" : `<tr><td colspan="8">No requests found</td></tr>`;

  r.forEach(x => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        ${x.reqId}
        <span class="status-dot ${getDotClass(x.status, x.slaStatus)}"></span>
        ${cancelMode ? `<span class="cancel-cross" data-id="${x._id}">✖</span>` : ""}
      </td>
      <td>${x.title}</td>
      <td>${x.category}</td>
      <td>${x.priority}</td>
      <td>${x.status}</td>
      <td>${x.slaStatus}</td>
      <td>${new Date(x.deadline).toLocaleDateString()}</td>
      <td>
  <button class="btn-link" onclick="viewNotes('${x._id}')">
    View
  </button>
</td>
    `;
    t.appendChild(tr);
  });
}
/* ================= PROFILE UPDATE ================= */
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

async function viewNotes(id) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API}/requests/one/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) return alert("Failed to fetch notes");

  const request = await res.json();

  const notes = request.resolutionNotes || "No notes added by staff yet.";

  document.getElementById("notesText").textContent = notes;
  document.getElementById("notesModal").style.display = "flex";
}

function closeNotesModal() {
  document.getElementById("notesModal").style.display = "none";
}

function renderActivity(r) {
  const l = document.querySelector(".activity-list");
  if (!l) return;
  l.innerHTML = "";

  r.slice(0, 5).forEach(x => {
    const d = document.createElement("div");
    d.className = "activity-item";
    d.innerHTML = `
      <div class="activity-dot activity-dot-blue"></div>
      <div>
        <p>
          Request ${x.reqId} created
          ${cancelMode ? `<span class="cancel-cross" data-id="${x._id}">✖</span>` : ""}
        </p>
        <small>${new Date(x.createdAt).toLocaleString()}</small>
      </div>
    `;
    l.appendChild(d);
  });
}
