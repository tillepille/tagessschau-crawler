const mongoose = require('mongoose')
const Article = require('./articleModel')
const http = require('http')
const https = require('https')
const config = require('./config.json')
const parseString = require('xml2js').parseString

//  Prerequisites
async function init() {
	try {
		const db = await mongoose.connect('mongodb://mongo/ts-articles', {
			useNewUrlParser: true
		})
		mainFunction()
		//Wait to have Articles in Database
		setTimeout(() => {
			findForRevision(6, 'revision1')
		}, 10000)
		setTimeout(() => {
			findForRevision(48, 'revision2')
		}, 20000)

		//  set the timers
		setInterval(() => mainFunction(), config.interval)
		setInterval(() => findForRevision(6, 'revision1'), config.revision1)
		setInterval(() => findForRevision(48, 'revision2'), config.revision2)
	} catch (error) {
		log('while connecting to Mongo DB: ' + error)
		return 1
	}

log('System is now running...')
}

function log(message){
	let date = new Date().toISOString()
	console.log(date + " | " + message)
}
function getLatestArticle() {
	return Article.findOne().select('publishDate').sort('-publishDate').limit(1).exec()
}

async function mainFunction() {
	try {
		const respond = await fetchContent(config.rssLink)
		const result = await parseXML(respond)
		const lastArticle = await getLatestArticle()
		const articleList = result.rss.channel[0].item
		log('received XML List')
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
	} catch (error) {
		console.log(error)
		return 1
	}
}

async function saveArticle(item) {
	var link = item.link[0].replace('http://', 'https://')
	try {
		let article = await fetchContent(link)
		let cleanArticle = article.replace(/[\""]/g, '\\"')
		const encodedArticle = encodeURI(cleanArticle)	
		const newArt = new Article({
			publishDate: new Date(item.pubDate[0]).getTime(),
			title: item.title[0],
			link: link,
			content: encodedArticle,
			revision1: 'nothing',
			revision2: 'nothing'
		})
		return newArt.save()

	} catch (error) {
		console.error('Error while getting the content of an item ' + error)
		return error
	}

}

async function findForRevision(delay, wichRevision) {
	const today = new Date()
	const todayMinusDelay = new Date().setHours(today.getHours() - delay)
	try {
		const toRevision = await Article.find()
			.where('publishDate').lte(todayMinusDelay)
			.where(wichRevision).eq('nothing')
			.select('publishDate link revision1 revision2')
			.exec()
		const revisionedArticles = await doRevision(toRevision)
	} catch (error) {
		console.log(error)
	}

}

//  actually get the content and save it to DB
async function doRevision(result) {
	log('received ' + result.length + ' items to update')
	return new Promise((resolve, reject) => {
		const newArticles = result.map(async (item) => {
			const revisionArticle = await fetchContent(item.link)
			if (item.revision1 === 'nothing') {
				item.revision1 = encodeURI(revisionArticle)
			} else if (item.revision2 === 'nothing') {
				item.revision2 = encodeURI(revisionArticle)
			} else {
				log('Error with this item: ' + JSON.stringify(item))
				throw (new Error('revisions not empty'))
			}
			return item.save()
		})
		return Promise.all(newArticles)
	})
}
//  Just a wrapper for http/https connections
async function fetchContent(url) {
	if (url.includes('https://')) {
		const res = await promiseHTTPS(url)
		return parseContent(res)
	} else {
		const res = await promiseHTTP(url)
		return parseContent(res)
	}
}
//  make the request
function parseContent(res) {
	return new Promise((resolve, reject) => {
		let respond = ''
		res.on('data', chunk => respond += chunk)
		res.on('error', (e) => reject(e))
		res.on('timeout', (e) => reject(e))
		res.on('end', () => resolve(respond))
	})
}

function parseXML(raw) {
	return new Promise((resolve, reject) => {
		parseString(raw, (error, xml) => {
			if (error) {
				reject(error)
			} else {
				resolve(xml)
			}
		})
	})
}

function promiseHTTP(url) {
	return new Promise((resolve, reject) => {
		http.get(url, res => {
			resolve(res)
		})
	})
}

function promiseHTTPS(url) {
	return new Promise((resolve, reject) => {
		https.get(url, res => {
			resolve(res)
		})
	})
}

init()
