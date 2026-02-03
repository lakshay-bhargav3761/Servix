const mongoose = require("mongoose")

const requestSchema = new mongoose.Schema({
  reqId: { type: String, required: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  priority: { type: String, required: true },
  description: { type: String, required: true },

  status: { type: String, default: "Open" },

  slaStatus: { type: String, default: "Within" },

  // ✅ THIS WAS MISSING
  deadline: { type: Date, required: true },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  resolutionNotes: String

}, { timestamps: true })

module.exports = mongoose.model("Request", requestSchema)
