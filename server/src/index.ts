import express from "express";
import cors from "cors";
import { productsRouter } from "./productsRouter.js";
import { transactionsRouter } from "./transactionsRouter.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.use("/products", productsRouter);
app.use("/transactions", transactionsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
