const mongoose = require('mongoose');

const stockItemSchema = new mongoose.Schema({
    name: String,
    type: String,
    category: String,
    quantity: Number,
    total: Number,
    color: String,
    desc: String,
    tag: String
});

module.exports = mongoose.model('StockItem', stockItemSchema);