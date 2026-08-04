import { Router, Request, Response } from "express";
import * as productsRepo from "./productsRepo.js";

export const productsRouter = Router();

// GET /products
productsRouter.get("/", async (_req: Request, res: Response) => {
  const products = await productsRepo.getAll();
  res.json(products);
});

// GET /products/:id
productsRouter.get("/:id", async (req: Request, res: Response) => {
  const product = await productsRepo.getById(req.params.id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(product);
});

// POST /products
productsRouter.post("/", async (req: Request, res: Response) => {
  const { name, price, barcode, stock } = req.body ?? {};
  if (typeof name !== "string" || typeof price !== "number") {
    res.status(400).json({ error: "name (string) and price (number) are required" });
    return;
  }
  const product = await productsRepo.create({
    name,
    price,
    barcode: typeof barcode === "string" ? barcode : "",
    stock: typeof stock === "number" ? stock : 0,
  });
  res.status(201).json(product);
});

// PUT /products/:id
productsRouter.put("/:id", async (req: Request, res: Response) => {
  const updated = await productsRepo.update(req.params.id, req.body ?? {});
  if (!updated) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(updated);
});

// DELETE /products/:id
productsRouter.delete("/:id", async (req: Request, res: Response) => {
  const deleted = await productsRepo.remove(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.status(204).send();
});
