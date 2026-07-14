import express from "express";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth, async (req, res) => {
    res.json(req.user.savedFilters || []);
});

router.post("/", auth, async (req, res) => {
    const { name, airports } = req.body;

    req.user.savedFilters.push({
        name,
        airports
    });

    await req.user.save();

    res.json(req.user.savedFilters);
});

router.delete("/:name", auth, async (req, res) => {
    req.user.savedFilters = req.user.savedFilters.filter(
        f => f.name !== req.params.name
    );

    await req.user.save();

    res.json(req.user.savedFilters);
});

export default router;
