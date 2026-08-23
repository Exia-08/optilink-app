const mongoose = require('mongoose');

const stockItemSchema = new mongoose.Schema({
    name: String,
    type: String,
    category: String,
    quantity: Number,
    total: Number,
    color: String,
    desc: String,
    tag: String,
    clinicId: { type: String, index: true }
});

module.exports = mongoose.model('StockItem', stockItemSchema);
