import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as OpenAIController from "../controllers/OpenAIController";

const openaiRoutes = Router();

openaiRoutes.get("/settings", isAuth, OpenAIController.getSettings);
openaiRoutes.post("/settings", isAuth, OpenAIController.saveSettings);
openaiRoutes.post("/message", isAuth, OpenAIController.sendMessage);

export default openaiRoutes;
