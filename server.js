const mongoose = require('mongoose')
const Article = require('./articleModel')
const http = require('http')
const https = require('https')
const config = require('./config.json')
const parseString = require('xml2js').parseString

//  Prerequisites

mongoose.connect('mongodb://mongo/ts-articles')
mongoose.connect('mongodb://mongo/ts-articles', {
	useNewUrlParser: true
}, (error) => {
	if (error) {
		console.log('while connecting to Mongo DB: ' + error)
		return 1
	}
	console.log('successfully connected to Mongo DB')
	//   let all functions run once
	console.log('initial crawling...')
	mainFunction()
	//Wait to have Articles in Database
	setTimeout(() => {
		revision1()
	}, 10000)
	setTimeout(() => {
		revision2()
	}, 20000)
})
//  set the timers
setInterval(mainFunction, config.interval)
setInterval(revision1, config.revision1)
setInterval(revision2, config.revision2)

console.log('System is now running...')

function getLatestArticle(callback) {
	Article.findOne().select('publishDate').sort('-publishDate').limit(1).exec(callback)
}

async function mainFunction() {
	//  GET xml feed
	try {
		const respond = await getContent(config.rssLink)
		const result = await parseString(respond)
		const lastArticle = await getLatestArticle()
		const articleList = result.rss.channel[0].item
	} catch (error) {
		console.log(error);
		return
	}
	console.log('received XML List')
	//  Check the case there is no last Article in DB
	let lastArticleDate
	if (!lastArticle) {
		lastArticleDate = 0
	} else {
		lastArticleDate = lastArticle.publishDate
	}
	articleList.forEach(async (current) => {
		const currentDate = new Date(current.pubDate[0])
		if (lastArticleDate < currentDate) {
			const done = await saveArticle(current)
		}
	})
}

async function saveArticle(item, callback) {
	var link = item.link[0].replace('http://', 'https://')
	getContent(link, (err, article) => {
		if (err) {
			console.log(err)
			throw (err)
		}
		var newArt = new Article({
			publishDate: new Date(item.pubDate[0]).getTime(),
			title: item.title[0],
			link: link,
			content: encodeURI(article),
			revision1: 'nothing',
			revision2: 'nothing'
		})
		return newArt.save()
	})
}

function revision1() {
	var today = new Date()
	const todayMinus24h = new Date().setDate(today.getDate() - 1)
	return Article.find({
			publishDate: {
				$lte: todayMinus24h
			},
			'revision1': 'nothing'
		}).select('publishDate link revision1 revision2')
		.exec(doRevision)
}

function revision2() {
	var today = new Date()
	const todayMinus7d = today.setDate(today.getDate() - 7)
	return Article.find({
			publishDate: {
				$lte: todayMinus7d
			},
			'revision2': 'nothing'
		}).select('publishDate link revision1 revision2')
		.exec(doRevision)
}
//  actually get the content and save it to DB
async function doRevision(error, result) {
	console.log('received ' + result.length + ' items to update')
	return new Promise((resolve, reject) => {
		result.forEach(async (item) => {
			const revisionArticle = await getContent(item.link)
			if (item.revision1 === 'nothing') {
				item.revision1 = encodeURI(revisionArticle)
			} else if (item.revision2 === 'nothing') {
				item.revision2 = encodeURI(revisionArticle)
			} else {
				console.log('Error with this item: ' + JSON.stringify(item))
				throw (new Error('revisions not empty'))
			}
			return item.save()
		})
	})
}
//  Just a wrapper for http/https connections
async function getContent(url, callback) {
	if (url.includes('https://')) {
    const res = await https.get(url)
    return parseContent(res)
	} else {
    const res = await http.get(url)
    return parseContent(res)
	}
}
//  make the request
async function parseContent(res, callback) {
	return new Promise((resolve, reject) => {
		let respond = ''
		res.on('data', chunk => respond += chunk)
		res.on('error', (e) => reject(e))
		res.on('timeout', (e) => reject(e))
		res.on('end', () => resolve(respond))
	})
}
