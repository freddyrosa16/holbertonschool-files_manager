import express from "express";
import routes from "./routes/index";

const port = process.env.PORT || 5000;

const app = express();
app.use(express.json());

for (const [request, callback] of Object.entries(routes)) {
  const [method, route] = request.split(" ");

  if (method === "GET") app.get(route, callback);
  if (method === "POST") app.post(route, callback);
  if (method === "PUT") app.put(route, callback);
}

app.listen(port, () => undefined);
