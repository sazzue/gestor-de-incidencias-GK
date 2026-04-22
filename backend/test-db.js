const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://serubalcava_db_user:vBTa68eNJDcL0o7v@incidencias.p34nimj.mongodb.net/incidencias")
  .then(() => console.log("OK CONECTADO"))
  .catch(err => console.log("ERROR:", err));