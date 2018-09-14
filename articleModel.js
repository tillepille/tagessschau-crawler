var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var articleSchema = new Schema({
    publishDate: Date,
    title: String,
    link: String,
    content: String,
    revision1: String,
    revision2: String
});

module.exports = mongoose.model('Article', articleSchema);
