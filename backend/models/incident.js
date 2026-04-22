const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema({
  title: String,
  description: String,
  status: {
    type: String,
    default: "pendiente"
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
  },
  department: String,


  createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User" // 👈 ESTO ES CLAVE
    }
},

{ timestamps: true } // es para la hora de creación y actualización automática de los campos createdAt y updatedAt

);

module.exports = mongoose.model("Incident", incidentSchema);