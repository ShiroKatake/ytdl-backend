import express from "express";
import ytsr from "ytsr";

const router = express.Router();
router.get("/suggestions", async (req, res) => {
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

export default router;
