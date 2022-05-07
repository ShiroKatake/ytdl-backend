import express from "express";
import ytpl from "ytpl";

const router = express.Router();
router.get("/playlist", async (req, res) => {
  try {
    const { pl: url } = req.query;
    const playlist = await ytpl(url, { limit: Infinity });
    return res.status(200).json(playlist);
  } catch (error) {
    console.log(error.message)
    return res.status(400).send(error.message);
  }
});

export default router;
