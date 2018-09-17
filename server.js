const mongoose = require('mongoose');
const Article = require('./articleModel');
const http = require('http');
const https = require('https');
const config = require('./config.json');
const parseString = require('xml2js').parseString;

//  Prerequisites
var lastArticleCached;
mongoose.connect("mongodb://mongo/ts-articles", {
    useNewUrlParser: true
}, function(error) {
    if (error) {
        console.log("while connecting to Mongo DB: " + error);
        return 1;
    }
    console.log("successfully connected to Mongo DB");
    //   let all functions run once
    console.log("initial crawling...");
    mainFunction();
    //Wait to have Articles in Database
    setTimeout(function() {
        console.log("revision1 crawling...");
        revision1();
    }, 10000);
    setTimeout(function() {
        console.log("revision2 crawling...");
        revision2();
    }, 20000);
});
//  set the timers
var initcrawl = setInterval(mainFunction, config.interval);
var revision1Promise = setInterval(revision1, config.revision1);
var revison2Promise = setInterval(revision2, config.revision2);

console.log("System is now running...");

function getLatestArticle(callback) {
    Article.findOne().select('publishDate').sort('-publishDate').limit(1).exec(callback);
}

function mainFunction() {
    //  GET xml feed
    getContent(config.rssLink, "xml", function(err, result) {
        if (err) {
            console.log(err);
            return;
        }
        var articleList = result.rss.channel[0].item;
        console.log("received XML List");
        getLatestArticle(function(err, lastArticle) {
            //  Check the case there is no last Article in DB
            let lastArticleDate;
            if (!lastArticle) {
                lastArticleDate = 0;
            } else {
                lastArticleDate = lastArticle.publishDate;
            }
            articleList.forEach(function(current) {
                var currentDate = new Date(current.pubDate[0]);
                if (lastArticleDate < currentDate) {
                    saveArticle(current, function(err) {
                        console.log("Saved new Article");
                    })
                }
            });
        });
    });
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
            link: link,
            content: encodeURI(article),
            revision1: "nothing",
            revision2: "nothing"
        });

        newArt.save(function(err) {
            callback(err)
        })

        callback(err);
    });
}

function revision1() {
    var today = new Date();
    const todayMinus24h = new Date().setDate(today.getDate() - 1);
    Article.find({
            publishDate: {
                $lte: todayMinus24h
            },
            'revision1': "nothing"
        }).select('publishDate link revision1 revision2')
        .exec(doRevision);
}

function revision2() {
    var today = new Date();
    const todayMinus7d = today.setDate(today.getDate() - 7);
    Article.find({
            publishDate: {
                $lte: todayMinus7d
            },
            'revision2': "nothing"
        }).select('publishDate link revision1 revision2')
        .exec(doRevision)
}
//  actually get the content and save it to DB
function doRevision(error, result) {
    console.log("received " + result.length + " items to update");
    result.forEach(function(item) {
        getContent(item.link, "ssl", function(error, revisionArticle) {
            if (item.revision1 === "nothing") {
                item.revision1 = encodeURI(revisionArticle);
            } else if (item.revision2 === "nothing") {
                item.revision2 = encodeURI(revisionArticle);
            } else {
                console.log("Error with this item: " + JSON.stringify(item));
            }
            item.save(function(err, updatedArticle) {
                console.log("updated Article-rev1: " + item.link);
            });
        })
    })
}
//  Just a wrapper for http/https connections
function getContent(url, type, callback) {
    if (url.includes("https://")) {
        var req = https.get(url, function(res) {
            parseContent(res, type, callback);
        });
    } else {
        var req = http.get(url, function(res) {
            parseContent(res, type, callback);
        });
    }
}
//  make the request and parse it if type = xml
function parseContent(res, type, callback) {
    var respond = '';
    res.on('data', function(chunk) {
        respond += chunk;
    });
    res.on('error', function(e) {
        console.log("Error in Connection: " + e);
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
