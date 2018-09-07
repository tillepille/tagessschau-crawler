var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var articleSchema = new Schema({
    publishDate: Date,
    title: String,
    link: String,
    content: String,
    revisions: [String]
});

module.exports = mongoose.model('Article', articleSchema);
