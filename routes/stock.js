const express = require('express');
const StockItem = require('../models/StockItem');

const router = express.Router();

// Get all stock
router.get('/', async (req, res) => {
    const { clinicId } = req.query;
    const filter = clinicId ? { clinicId } : {};
    const stock = await StockItem.find(filter).sort({ name: 1 });
    res.json({ stock });
});

module.exports = router;
