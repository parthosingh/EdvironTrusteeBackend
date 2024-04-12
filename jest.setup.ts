const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
module.exports = async () => {
  console.log('setting up mock mongo server....');
  const mongod = await MongoMemoryServer.create();
  global.mongoServer = mongod;
  process.env.MONGO_URI = await mongod.getUri();
};
