import mongoose from "mongoose";

module.exports = async () => {
  console.log("clearing up....")
  await mongoose.connection.close();
  console.log("connection closed");
  await global.mongoServer.stop();
  console.log("mock server closed");

};