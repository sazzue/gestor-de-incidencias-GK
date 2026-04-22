const ROLES = {
  ADMIN: "admin",
  DIRECCION: "direccion",
  GERENCIA: "gerencia",
  DEPARTAMENTO: "departamento",
  admin: [
    "CREATE_MAINTENANCE",
    "CONFIRM_MAINTENANCE",
    "DELETE_MAINTENANCE"
  ],

  gerencia: [
    "CONFIRM_MAINTENANCE"
  ],

  direccion: [
    "CONFIRM_MAINTENANCE"
  ],

  departamento: [
    "CREATE_MAINTENANCE"
  ]
};


module.exports = ROLES;