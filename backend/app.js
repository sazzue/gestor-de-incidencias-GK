require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/auth', require('./routes/auth'));
app.use("/api/branches", require("./routes/branches"));

module.exports = app;