import { Router, Request, Response } from "express";
import * as transactionsRepo from "./transactionsRepo.js";

export const transactionsRouter = Router();

// POST /transactions
// Idempotency key is the client-generated `id`. If we've already
// persisted this id, we return the existing record and skip both the
// failure roll and re-processing — a retry of an already-succeeded
// checkout must be a no-op, never a double charge.
transactionsRouter.post("/", async (req: Request, res: Response) => {
  const { id, items, total } = req.body ?? {};
  if (typeof id !== "string" || !Array.isArray(items) || typeof total !== "number") {
    res.status(400).json({ error: "id (string), items (array) and total (number) are required" });
    return;
  }

  const existing = await transactionsRepo.findById(id);
  if (existing) {
    res.status(200).json(existing);
    return;
  }

  if (transactionsRepo.shouldSimulateFailure()) {
    // Deliberately vague — a real flaky network wouldn't tell the
    // client whether the request landed. The client can't distinguish
    // "server never got it" from "server got it but the reply died",
    // which is the whole reason retries must be idempotent.
    res.status(503).json({ error: "Service temporarily unavailable" });
    return;
  }

  const transaction = {
    id,
    items,
    total,
    receivedAt: new Date().toISOString(),
  };
  await transactionsRepo.persist(transaction);
  res.status(201).json(transaction);
});
