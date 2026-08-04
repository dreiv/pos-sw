import express from "express";

const app = express();
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Async Logging Learning API running at http://localhost:${PORT}`);
});
