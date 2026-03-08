import { NextFunction, Request, Response } from "express";
import { auth } from "../infra/firebase";
import { config } from "../infra/config";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireUserAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    const decoded = await auth.verifyIdToken(token);
    req.userId = decoded.uid;
    next();
  } catch (error: any) {
    res.status(401).json({ error: error?.message || "Unauthorized" });
  }
}

export function requireRunnerKey(req: Request, res: Response, next: NextFunction) {
  const provided = String(req.headers["x-runner-key"] || "");
  if (!config.runnerApiKey || provided !== config.runnerApiKey) {
    res.status(401).json({ error: "Invalid runner key" });
    return;
  }
  next();
}
