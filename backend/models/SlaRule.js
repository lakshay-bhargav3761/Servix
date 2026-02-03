const mongoose = require("mongoose");

const slaRuleSchema = new mongoose.Schema({
  category: { type: String, required: true },
  priority: { type: String, required: true },
  allowedTime: { type: Number, required: true }, // in HOURS
  warningThreshold: { type: Number, required: true } // in HOURS
});

slaRuleSchema.index({ category: 1, priority: 1 }, { unique: true });

module.exports = mongoose.model("SlaRule", slaRuleSchema);
