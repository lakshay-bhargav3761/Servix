const path = require("path")
const express = require("express")
const cors = require("cors")
require("dotenv").config()
const connectDB = require("./config/db")

const authRoutes = require("./routes/auth")
const requestRoutes = require("./routes/requests")

connectDB()

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "../frontend")))

app.use("/api/auth", authRoutes)
app.use("/api/requests", requestRoutes)
app.use("/api/sla", require("./routes/slaRoutes"));
const PORT = process.env.PORT || 5000
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"))
})
app.listen(PORT, () => console.log("Server running on port " + PORT))
