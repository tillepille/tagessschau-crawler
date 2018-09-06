const mongoose = require('mongoose');
const Article = require('./articleModel');
const http = require('http');
const https = require('https');


//Prerequisites
var lastArticleCached;
mongoose.connect("mongodb://mongo/ts-articles", {
    useNewUrlParser: true
}, function(error) {
    if (error) {
        console.log("while connecting to Mongo DB: " + error);
    }
    console.log("successfully connected to Mongo DB");
    Article.find().select('publishDate').sort('-publishDate').limit(1).exec(function(err, result) {
        if (result) {
            lastArticleCached = new Date(result.publishDate).getTime();
        } else {
            lastArticleCached = 0;
        }
        mainFunction();
    });

    var init = setInterval(mainFunction, config.interval);
    var revision1 = setInterval(revision1, config.revision1);
    var revison2 = setInterval(revision2, config.revision2);

    console.log("System is now running...");
})

function mainFunction() {
    //GET xml feed
    getContent(config.rssLink, "xml", function(err, result) {
        if (err) {
            console.log(err);
            return;
        }
        var articleList = result.rss.channel[0].item;
        var newest = new Date(articleList[0].pubDate[0]).getTime();
        console.log("received list with elements: " + articleList.length);
        for (var i = 0; i < articleList.length; i++) {
            var current = articleList[i];
            var currentDate = new Date(current.pubDate[0]).getTime();
            if (lastArticleCached < currentDate) {
                saveArticle(current, function(err) {
                    console.log("Saved new Article");
                })
            }
        }
        lastArticleCached = newest;
    })
}

function saveArticle(item, callback) {
    var link = item.link[0].replace("http://", "https://");
    getContent(link, "ssl", function(err, article) {
        if (err) {
            console.log(err);
            callback(err);
        }
        var newArt = new Article({
            publishDate: new Date(item.pubDate[0]).getTime(),
            title: item.title[0],
            link: item.link[0],
            content: encodeURI(article)
        });

        newArt.save(function(err) {
            callback(err)
        })

        callback(err);
    });
}

function revision1() {
    var today = new Date();
    const todayMinus24h = today.setDate(today.getDate() - 1).getTime();
    Article.find({
            publishDate: {
                $lte: todayMinus24h.getTime()
            },
            revision1: {
                $exists: false
            }
        }).select('publishDate link')
        .exec(doRevision);
}

function revision2() {
    var today = new Date();
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
        item.revision1 = encodeURI(revisionArticle);
        item.save(function(err, updatedArticle) {
            console.log("updated Article-rev1: " + item.link);
        });
    }))
}


function doRevision2(result, error) {
    result.forEach(getContent(item.link, "ssl", function(err, revisionArticle) {
        item.revision2 = encodeURI(revisionArticle);
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
