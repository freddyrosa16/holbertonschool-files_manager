import AppController from "../controllers/AppController";
import UsersController from "../controllers/UsersController";
import AuthController from "../controllers/AuthController";
import FilesController from "../controllers/FilesController";

const routes = {
  "GET /status": AppController.getStatus,
  "GET /stats": AppController.getStats,
  "POST /users": UsersController.postNew,
  "GET /connect": AuthController.getConnect,
  "GET /disconnect": AuthController.getDisconnect,
  "GET /users/me": UsersController.getMe,
  "POST /files": FilesController.postUpload,
  "GET /files/:id": FilesController.getShow,
  "GET /files": FilesController.getIndex,
  "PUT /files/:id/publish": FilesController.putPublish,
  "PUT /files/:id/unpublish": FilesController.putUnpublish,
  "GET /files/:id/data": FilesController.getFile,
};
export default routes;
