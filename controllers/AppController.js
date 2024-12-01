import redisClient from "../utils/redis";
import dbClient from "../utils/db";

export default class AppController {
  static getStatus(request, response) {
    response.send({ redis: redisClient.isAlive(), db: dbClient.isAlive() });
  }

  static async getStats(request, response) {
    response.send({
      users: await dbClient.nbUsers(),
      files: await dbClient.nbFiles(),
    });
  }
}
