const Request = require("../models/Request");
const SlaRule = require("../models/SlaRule");

function getSlaStatus(deadline, warningHours) {
  const diffHrs = (deadline - new Date()) / (1000 * 60 * 60);
  if (diffHrs <= 0) return "Breached";
  if (diffHrs <= warningHours) return "Near Breach";
  return "Within";
}

async function recalculateDeadlines(category, priority) {
  const rule = await SlaRule.findOne({ category, priority });
  if (!rule) return;

  const { allowedTime, warningThreshold } = rule;

  // Find affected requests
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

module.exports = { recalculateDeadlines };
