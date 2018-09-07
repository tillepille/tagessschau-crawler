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
    //  find last saved article
    getLatestArticle(function(err, result) {
        if (result) {
            console.log("Last Article is from: " + result.publishDate);
            lastArticleCached = new Date(result.publishDate).getTime();
        } else {
            //  no Article found e.g. Database empty
            lastArticleCached = 0;
        }
        //   let all functions run once
        console.log("initial crawling...");
        mainFunction();
        console.log("revision1 crawling...");
        revision1();
        console.log("revision2 crawling...");
        revision2();
    });
    //  set the timers
    var initcrawl = setInterval(mainFunction, config.interval);
    var revision1Promise = setInterval(revision1, config.revision1);
    var revison2Promise = setInterval(revision2, config.revision2);

    console.log("System is now running...");
});

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
        console.log("received list with elements: " + articleList.length);
        getLatestArticle(function(err, lastArticle) {
            articleList.forEach(function(current) {
                var currentDate = new Date(current.pubDate[0]);
                if (lastArticle.publishDate < currentDate) {
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
            link: item.link[0],
            content: encodeURI(article),
            revisions: []
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
            'revisions.1': ""
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
            'revisions.2': ""
        }).select('publishDate link')
        .exec(doRevision)
}
//  actually get the content and save it to DB
function doRevision(result, error) {
    result.forEach(getContent(item.link, "ssl", function(revisionArticle) {
        item.revisions.push(encodeURI(revisionArticle));
        item.save(function(err, updatedArticle) {
            console.log("updated Article-rev1: " + item.link);
        });
    }))
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
