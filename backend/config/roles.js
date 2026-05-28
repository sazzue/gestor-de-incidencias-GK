const ROLES = {
  ADMIN: "admin",
  DIRECCION: "direccion",
  GERENCIA: "gerencia",
  DEPARTAMENTO: "departamento",
  admin: [
    "CREATE_USERS",
    "CREATE_INCIDENT",
    "VIEW_INCIDENTS_ALL",
    "VIEW_INCIDENTS_DEPARTMENT",
    "VIEW_INCIDENTS_BRANCH",
    "CREATE_MAINTENANCE",
    "CONFIRM_MAINTENANCE",
    "VIEW_MAINTENANCE_ALL",
    "VIEW_MAINTENANCE_DEPARTMENT",
    "VIEW_MAINTENANCE_BRANCH",
    "CREATE_INVENTORY",
    "VIEW_INVENTORY_ALL",
    "VIEW_INVENTORY_BRANCH",
    "DISPOSE_INVENTORY",
    "DELETE_MAINTENANCE"
  ],

  gerencia: [],

  direccion: [],

  departamento: []
};


module.exports = ROLES;
