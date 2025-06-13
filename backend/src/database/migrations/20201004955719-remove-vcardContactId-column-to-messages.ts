import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Migración deshabilitada temporalmente por bug de Sequelize en entornos limpios
    // Si necesitas eliminar la columna vcardContactId, hazlo manualmente en la base de datos.
    return Promise.resolve();
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Messages", "vcardContactId", {
      type: DataTypes.INTEGER,
      references: { model: "Contacts", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
  }
};
