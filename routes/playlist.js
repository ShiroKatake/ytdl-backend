const express = require("express");
const router = express.Router();
const ytpl = require("ytpl");

router.get("/playlist", async (req, res) => {
  try {
    const { pl: url } = req.query;
    const playlist = await ytpl(url, { limit: Infinity });
    return res.status(200).json({ success: true, data: playlist });
  } catch (error) {
    return res.status(400).send({ success: false, error });
  }
});

module.exports = router;
