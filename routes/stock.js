const express = require('express');
const StockItem = require('../models/StockItem');

const router = express.Router();

// Get all stock
router.get('/', async (req, res) => {
    const stock = await StockItem.find();
    res.json({ stock });
});

module.exports = router;