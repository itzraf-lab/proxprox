import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import userRouter from "./user.js";
import modelsRouter from "./models.js";
import adminRouter from "./admin.js";
import internalRouter from "./internal.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/models", modelsRouter);
router.use("/admin", adminRouter);
router.use("/internal", internalRouter);

export default router;
