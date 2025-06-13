import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Migración deshabilitada temporalmente por bug de Sequelize en entornos limpios
    // Si necesitas eliminar la columna userId, hazlo manualmente en la base de datos.
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
