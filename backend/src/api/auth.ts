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

/**
 * Gate for the read-only market-analysis endpoints.
 *
 * Deliberately a *different* secret from RUNNER_API_KEY: that key can trigger
 * `/v1/run-active-strategies`, which places real orders. A read-only consumer
 * such as the MCP server must never hold a credential that can trade.
 */
export function requireAnalysisReadKey(req: Request, res: Response, next: NextFunction) {
  const provided = String(req.headers["x-analysis-key"] || "");
  if (!config.analysisReadKey || provided !== config.analysisReadKey) {
    res.status(401).json({ error: "Invalid analysis key" });
    return;
  }
  next();
}
