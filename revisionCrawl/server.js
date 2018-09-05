const mongoose = require('mongoose');
const Article = require('./articleModel');
const http = require('http');
const https = require('https');


//Prerequisites

mongoose.connect("mongodb://mongo/ts-articles", function(error) {
    if (error) {
        console.log("while connecting to Mongo DB: " + error);
    }
    console.log("successfully connected to Mongo DB");
    revision1();
    var myInt = setInterval(revision1, 60000 * 60);
    var myInt2 = setInterval(revision2, 60000 * 60 * 24);
    console.log("System is now running...");
})

function revision1() {
    var today = new Date();
    const todayMinus24h = today.setDate(today.getDate() - 1);
    Article.find({
            publishDate: {
                $lte: todayMinus24h.getTime()
            },
            revision1: {
                $exists: false
            }
        }).select('publishDate link')
        .exec(doRevision)
}
function revision2() {
    var today = new Date()
    const todayMinus7d = today.setDate(today.getDate() - 7).getTime();
    Article.find({
            publishDate: {
                $lte: todayMinus7d
            },
            revision2: {
                $exists: false
            }
        }).select('publishDate link')
        .exec(doRevision1)
}
function doRevision1(result, error) {
    result.forEach(getContent(item.link, "ssl", function(err, revisionArticle) {
        item.revision1 = revisionArticle;
        item.save(function(err, updatedArticle) {
            console.log("updated Article-rev1: " + item.link);
        });
    }))
}


function doRevision2(result, error) {
    result.forEach(getContent(item.link, "ssl", function(err, revisionArticle) {
        item.revision2 = revisionArticle;
        item.save(function(err, updatedArticle) {
            console.log("updated Article-rev2: " + item.link);
        });
    }))
}

function getContent(url, callback) {
    if (url.inludes("https://")) {
        var req = https.get(url, function(res) {
            parseContent(res, type, callback);
        });
    } else {
        var req = http.get(url, function(res) {
            parseContent(res, type, callback);
        });
    }
}

function parseContent(res, type, callback) {
    var respond = '';
    res.on('data', function(chunk) {
        respond += chunk;
    });
    res.on('error', function(e) {

        callback(e, null);
    });
    res.on('timeout', function(e) {
        callback(e, null);
    });
    res.on('end', function() {
        if (type === "xml") {
            parseString(respond, function(err, result) {
                if (err) {
                    console.log(err);
                    callback(err);
                } else {
                    callback(null, result);
                }
            });
        } else {
            callback(null, respond);
        }

    });
}
