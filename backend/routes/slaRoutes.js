const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const SlaRule = require("../models/SlaRule");
const Request = require("../models/Request");

/* ================= HELPER: SLA STATUS ================= */
function getSlaStatus(deadline, warningHours) {
  const diffHrs = (deadline - new Date()) / (1000 * 60 * 60);

  if (diffHrs <= 0) return "Breached";
  if (diffHrs <= warningHours) return "Near Breach";
  return "Within";
}

/* ================= HELPER: RECALCULATE DEADLINES ================= */
async function recalculateDeadlines(category, priority, allowedTime, warningThreshold) {
  // Update only active requests (not resolved)
  const requests = await Request.find({
    category,
    priority,
    status: { $ne: "Resolved" }
  });

  for (const r of requests) {
    const newDeadline = new Date(
      r.createdAt.getTime() + allowedTime * 60 * 60 * 1000
    );

    r.deadline = newDeadline;
    r.slaStatus = getSlaStatus(newDeadline, warningThreshold);
    await r.save();
  }
}

/* ================= SAVE / UPDATE SLA RULE (ADMIN) ================= */
router.post("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    const { category, priority, allowedTime, warningThreshold } = req.body;

    if (!category || !priority || !allowedTime || !warningThreshold) {
      return res.status(400).json({ message: "All fields required" });
    }

    // Save or update SLA rule
    const rule = await SlaRule.findOneAndUpdate(
      { category, priority },
      { allowedTime, warningThreshold },
      { upsert: true, new: true }
    );

    // 🔥 Recalculate deadlines for existing requests
    await recalculateDeadlines(
      category,
      priority,
      allowedTime,
      warningThreshold
    );

    res.json({
      message: "SLA rule saved and deadlines recalculated",
      rule
    });
  } catch (err) {
    console.error("SLA SAVE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ================= FETCH ALL SLA RULES ================= */
router.get("/", auth, async (req, res) => {
  try {
    const rules = await SlaRule.find();
    res.json(rules);
  } catch (err) {
    console.error("FETCH SLA RULES ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
