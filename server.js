const mongoose = require('mongoose');
const Article = require('./articleModel');
const parseString = require('xml2js').parseString;
const http = require('http');
const https = require('https');
const config = require("./config.json");

//Prerequisites
/*
mongoose.connect("mongodb://mongo/ts-articles", function(error) {
    if (error) {
        console.log("while connecting to Mongo DB: " + error);
    }
    console.log("successfully connected to Mongo DB");
})
*/

var lastArticleCached = config.lastArticle;
var myInt = setInterval(mainFunction, config.interval);

console.log("System is now running...");

function mainFunction() {
    //GET xml feed
    console.log("calling tagesschau XML...");
    getContent(config.rssLink, "xml", function(err, result) {
        if (err) {
            console.log(err);
            return;
        }
        var articleList = result.rss.channel[0].item;
        var newest = new Date(articleList[0].pubDate[0]).getTime();
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
    console.log("calling tagesschau ARTICLE ...");
    var link = item.link[0].replace("http://", "https://")
    getContent(link, "ssl", function(err, article) {
        if (err) {
            console.log(err);
            callback(err);
        }
        var newArt = new Article({
            publishDate: new Date(item.pubDate[0]).getTime(),
            title: item.title[0],
            link: item.link[0],
            content: article
        });
        /*
        newArt.save(function(err) {
            callback(err)
        })
        */
        callback(err);
    });
}

function getContent(url, type, callback) {
    if (type === "ssl") {
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
