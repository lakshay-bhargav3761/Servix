const express = require("express");
const router = express.Router();
const Request = require("../models/Request");
const SlaRule = require("../models/SlaRule");
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");


/* ================= SLA HELPERS ================= */

// Calculate deadline based on SLA rule
async function getDeadline(category, priority) {
  const rule = await SlaRule.findOne({ category, priority });
  const hours = rule?.allowedTime || 24; // fallback
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
async function getLeastLoadedStaff() {
  const staffList = await User.find({ role: "Staff" });

  if (staffList.length === 0) return null;

  let selected = null;
  let min = Infinity;

  for (const staff of staffList) {
    const count = await Request.countDocuments({
      assignedTo: staff._id,
      status: { $ne: "Resolved" }
    });

    if (count < min) {
      min = count;
      selected = staff;
    }
  }

  return selected;
}

// Calculate SLA status
function getSlaStatus(deadline, warningHours) {
  if (!deadline) return "Within";

  const diffHrs = (deadline - new Date()) / (1000 * 60 * 60);

  if (diffHrs <= 0) return "Breached";
  if (diffHrs <= warningHours) return "Near Breach";
  return "Within";
}

/* ================= CREATE REQUEST (USER) ================= */
router.post("/", auth, async (req, res) => {
  try {
    const { title, category, priority, description } = req.body;

    if (!title || !category || !priority || !description) {
      return res.status(400).json({ message: "All fields required" });
    }

    const count = await Request.countDocuments();
    const reqId = "REQ" + String(count + 1).padStart(3, "0");

    // Fetch SLA rule
    const rule = await SlaRule.findOne({ category, priority });

    const allowedTime = rule?.allowedTime || 24;
    const warningThreshold = rule?.warningThreshold || 10;

    const deadline = new Date(
      Date.now() + allowedTime * 60 * 60 * 1000
    );

    const slaStatus = getSlaStatus(deadline, warningThreshold);

   // 🔥 AUTO ASSIGN STAFF
const staff = await getLeastLoadedStaff();

const request = await Request.create({
  reqId,
  title,
  category,
  priority,
  description,
  status: "Open",
  user: req.user.id,
  assignedTo: staff ? staff._id : null,
  deadline,
  slaStatus
});

    res.status(201).json(request);
  } catch (err) {
    console.error("CREATE REQUEST ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ================= USER DASHBOARD ================= */
router.get("/user", auth, async (req, res) => {
  const requests = await Request.find({ user: req.user.id }).sort({ createdAt: -1 });

  for (const r of requests) {
    const rule = await SlaRule.findOne({
      category: r.category,
      priority: r.priority
    });

    const warningThreshold = rule?.warningThreshold || 10;
    const sla = getSlaStatus(r.deadline, warningThreshold);

    if (sla !== r.slaStatus) {
      r.slaStatus = sla;
      await r.save();
    }
  }

  res.json(requests);
});

/* ================= STAFF DASHBOARD ================= */
router.get("/assigned", auth, async (req, res) => {
  if (req.user.role !== "Staff") {
    return res.status(403).json({ message: "Staff only" });
  }

  const requests = await Request.find({
    assignedTo: req.user.id
  }).sort({ createdAt: -1 });

  // Update SLA status
  for (const r of requests) {
    const rule = await SlaRule.find({
      category: r.category,
      priority: r.priority
    });

    const warningThreshold = rule?.warningThreshold || 10;
    const sla = getSlaStatus(r.deadline, warningThreshold);

    if (sla !== r.slaStatus) {
      r.slaStatus = sla;
      await r.save();
    }
  }

  res.json(requests);
});


/* ================= ADMIN DASHBOARD ================= */
router.get("/admin", auth, async (req, res) => {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  const requests = await Request.find()
    .populate("assignedTo", "name")
    .sort({ createdAt: -1 });

  for (const r of requests) {
    const rule = await SlaRule.findOne({
      category: r.category,
      priority: r.priority
    });

    const warningThreshold = rule?.warningThreshold || 10;
    const sla = getSlaStatus(r.deadline, warningThreshold);

    if (sla !== r.slaStatus) {
      r.slaStatus = sla;
      await r.save();
    }
  }

  res.json(requests);
});

/* ================= VIEW ONE ================= */
router.get("/one/:id", auth, async (req, res) => {
  const request = await Request.findById(req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found" });
  res.json(request);
});

/* ================= ASSIGN (ADMIN) ================= */
router.put("/assign/:id", auth, async (req, res) => {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ message: "Admin only" });
  }

  const request = await Request.findById(req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found" });

  request.assignedTo = req.body.staffId;
  await request.save();

  res.json({ message: "Assigned successfully" });
});

/* ================= UPDATE STATUS ================= */
router.put("/update-status/:id", auth, async (req, res) => {
  const { status, notes } = req.body;

  const request = await Request.findById(req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found" });

  request.status = status;
  if (notes) request.resolutionNotes = notes;

  await request.save();

  res.json({ message: "Status updated" });
});

/* ================= CANCEL (USER) ================= */
router.delete("/cancel/:id", auth, async (req, res) => {
  const request = await Request.findById(req.params.id);
  if (!request) return res.status(404).json({ message: "Not found" });

  if (request.user.toString() !== req.user.id) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  await request.deleteOne();
  res.json({ message: "Cancelled" });
});

module.exports = router;
