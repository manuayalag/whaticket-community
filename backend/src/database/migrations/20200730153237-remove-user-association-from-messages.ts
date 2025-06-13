import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Verifica si la columna existe antes de intentar eliminarla
    const table = await queryInterface.describeTable("Messages");
    if (Object.prototype.hasOwnProperty.call(table, "userId")) {
      return queryInterface.removeColumn("Messages", "userId");
    }
    // Si no existe, no hace nada
    return Promise.resolve();
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Messages", "userId", {
      type: DataTypes.INTEGER,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
  }
};
