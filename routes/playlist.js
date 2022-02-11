const express = require("express");
const router = express.Router();
const ytpl = require("ytpl");

router.get("/playlist", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");

  try {
    const { pl: url } = req.query;
    const playlist = await ytpl(url, { limit: Infinity });
    return res.status(200).json(playlist);
  } catch (error) {
    console.log(error.message)
    return res.status(400).send(error.message);
  }
});

module.exports = router;
