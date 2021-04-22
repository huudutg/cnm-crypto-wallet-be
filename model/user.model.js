const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const Info = new Schema({
    name: String,
    link: String,
});

const User = new Schema({
    // _id: ObjectId,
    id: String,
    name: String,
    list: [Info],
});
module.exports = mongoose.model('user', User)