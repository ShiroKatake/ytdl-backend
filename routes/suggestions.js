const express = require("express");
const router = express.Router();
const ytsr = require("ytsr");

router.get("/suggestions", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");

  const { search } = req.query;
  const options = {
    q: search,
    part: "snippet",
    type: "video",
  };
  try {
    const filters = await ytsr.getFilters(options.q);
    const filter = filters.get("Type").get("Video");
    const searchResults = await ytsr(filter.url, { limit: 5 });
    return res.status(200).json(searchResults.items);
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

module.exports = router;
