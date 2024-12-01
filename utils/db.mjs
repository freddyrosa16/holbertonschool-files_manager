import mongodb from "mongodb";
import sha1 from "sha1";

const { MongoClient, ObjectId } = mongodb;

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || "localhost";
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || "files_manager";

    MongoClient.connect(`mongodb://${host}:${port}`).then((client) => {
      this.client = client;
      this.db = client.db(database);
      this.usersColl = this.db.collection("users");
      this.filesColl = this.db.collection("files");
    });
  }

  isAlive() {
    if (this.client) {
      return true;
    }
    return false;
  }

  async nbUsers() {
    return this.usersColl.countDocuments({});
  }

  async userByEmail(email) {
    return this.usersColl.findOne({ email });
  }

  async userById(id) {
    return this.usersColl.findOne({ _id: ObjectId(id.toString()) });
  }

  /**
   * Returns the `_id` of the user with `{ email: email }`.
   *
   * if the user or `_id` are not found, this method returns
   * a falsy value (null or undefined).
   *
   * The ID should be an `ObjectID`.
   */
  async userId(email) {
    const userObject = await this.userByEmail(email);
    return userObject ? userObject._id : null;
  }

  async addUser(email, password) {
    return this.usersColl.insertOne({ email, password: sha1(password) });
  }

  async validCredentials(email, password) {
    // assuming there can't be multiple users with the same email and password,
    // NOR same email.
    const matches = await this.usersColl
      .find({ email, password: sha1(password) })
      .toArray();
    return !!matches.length;
  }

  async nbFiles() {
    return this.filesColl.countDocuments({});
  }

  async fileWithID(id) {
    let _id;
    try {
      _id = ObjectId(id);
    } catch (error) {
      // making an ObjectId with an ID in the wrong format throws.
      return null;
    }
    return this.filesColl.findOne({ _id });
  }

  async addFile(file) {
    return this.filesColl.insertOne(file);
  }

  /**
   * Returns an array of all of the file MongoDB
   * documents in `self.filesColl` that belong to
   * the user with `userId` (the documents that have
   * `{ userId: userID }`)
   * and that have `{ parentId: parentId }`.
   *
   * If `userId` is not a valid `ObjectId`,
   * this method returns null.
   * If `parentId` is falsy, it's skipped over;
   * and if it's not a valid `ObjectId`, this method returns
   * null.
   *
   * This method *should* return an array when successful,
   * and *should* return a falsy value when unsuccessful.
   * All of my implementations use null, and the inner
   * MongoDB method call should
   */
  async findFiles(userId, parentId) {
    const query = {};

    try {
      query.userId = ObjectId(userId);
    } catch (error) {
      return null;
    }
    if (parentId) {
      try {
        query.parentId = ObjectId(parentId);
      } catch (error) {
        return null;
      }
    }
    // console.log('query:');
    // console.log(query);
    return this.filesColl.find(query).toArray();
  }

  /**
   * Tries to return one file in `this.filesColl`
   * that's owned by `userId` and has
   * `{ _id: id }`.
   *
   * If `userId` or `id` aren't valid `ObjectId`,
   * this method returns null.
   * This method *should* return null if the file
   * isn't found.
   */
  async findUserFile(userId, id) {
    const query = {};

    try {
      query.userId = ObjectId(userId);
      query._id = ObjectId(id);
    } catch (error) {
      return null;
    }
    return this.filesColl.findOne(query);
  }

  async setFilePublic(userId, id, isPublic) {
    const filter = {};
    try {
      filter.userId = ObjectId(userId);
      filter._id = ObjectId(id);
    } catch (error) {
      /* I think it should be not found anyways */
    }
    return this.filesColl.updateOne(filter, { $set: { isPublic } });
  }
}

const dbClient = new DBClient();
export default dbClient;
