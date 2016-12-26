var express = require('express')
var moment = require('moment')
var mongodb = require('mongodb')
var app = express()

var database
var MongoClient = mongodb.MongoClient
//var url = 'mongodb://localhost:27017/short_url'
var url = 'mongodb://heroku_3lhb9g5f:q2sb27qtg09gnvctjjgsr31br8@ds145148.mlab.com:45148/heroku_3lhb9g5f'
MongoClient.connect(url, function (err, db) {
  if (err) {
    console.log('Unable to connect to the mongoDB server. Error:', err);
  } else {
    console.log('Connection established to', url);
    database = db
  }
})

//app.use(express.static(__dirname + '/public'))

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/index.html')
})

// API Basejump: Timestamp microservice

app.get('/api/timestamp', function(req, res) {
    res.sendFile(__dirname + '/public/timestamp-index.html')
})

app.get('/api/timestamp/:value', function(req, res){
    var value = req.params.value
    var object = {}
    
    if(/^\d{8,}$/.test(value)) {
        value = moment(value, "X");
    } else {
        value = moment(value, "MMMM D, YYYY");
    }
    
    if(value.isValid()){
        object.unix = value.format("X")
        object.natural = value.format("MMMM D, YYYY")
    } else {
        object.unix = null
        object.natural = null
    }

    res.json(object)
})

// API Basejump: Request Header Parser Microservice

app.get('/api/whoami', function(req, res){
    var ip = req.headers['x-forwarded-for'] || 
    req.connection.remoteAddress || 
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress
    var info = {
            'ipaddress': ip,
            'language': req.headers["accept-language"].split(',')[0],
            'software': req.headers['user-agent'].split(') ')[0].split(' (')[1]
        }
    res.send(info)
})

// API Basejump: URL Shortener Microservice

app.get('/api/short_url', function(req, res) {
    res.sendFile(__dirname + '/public/short_url-index.html')
})

app.get('/api/short_url/:url', function(req, res) {
    var url = 'https://' + req.headers.host + '/api/short_url/' + req.params.url
    console.log(url)
    if (url != 'https://' + req.headers.host + '/api/short_url/' + 'favicon.ico') {
        // get the url
        var sites = database.collection('sites')
        sites.findOne({
          "short_url": url
        }, function(err, result) {
          if (err) throw err
          
          if (result) {
            console.log('Found ' + result)
            console.log('Redirecting to: ' + result.original_url)
            res.redirect(result.original_url)
          } else {
            res.send('Site not found')
          }
        })
    }
})

app.get('/api/short_url/new/:url*', function(req, res) {
    // Create short url, store and display the info.
    var url = req.url.slice(19)     // remove front character
    var urlObj = {}
    
    // varify URL
    var regex = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?$/i
    var validateURL = regex.test(url)
    console.log(url, validateURL)
    if (validateURL) {
        // Generates random four digit number for link
        var num = Math.floor(100000 + Math.random() * 900000)
        num = num.toString().substring(0, 4)
        urlObj = {
            "original_url": url,
            "short_url": 'https://' + req.headers.host + '/api/short_url/' + num
        }
        // Save object into db.
        var sites = database.collection('sites')
        sites.save(urlObj, function(err, result) {
            if (err) throw err
            console.log('Saved ' + result)
        })
        
        res.send(urlObj)
    } else {
        urlObj = {
            "error": "No short url found for given input"
        }
        res.send(urlObj)
    }
})

app.get('/api/img-sal', function(req, res) {
    res.sendFile(__dirname + '/public/img-sal-index.html')
})

app.get('/api/img-sal/latest', function(req, res) {
    // Check to see if the site is already there
    database.collection('img-sal-history').find().toArray(function(err, docs) {
    //console.log(err, docs);
});
    var coll_history = database.collection('img-sal-history')
    coll_history.find({}, null, {
      "limit": 5,
      "sort": {
        "when": -1
      }
    }, function(err, history) {
      if (err) return console.error(err)
      //console.log(history);
      /*res.send(history.map(function(arg) {
        // Displays only the field we need to show.
        return {
          term: arg.term,
          when: arg.when
        };
      }));*/
        
        history.toArray(function(err, docs) {
            if (err) return console.error(err)
            res.send(Object.keys(docs).map(function(index) {
                return {
                    "term": docs[index].term,
                    "when": docs[index].when
                }
            }))
        })
    });
})

app.get('/api/img-sal/:query', function(req, res) {
    // Get images and save query and date.
    var query = req.params.query
    var size = req.query.offset || 2
    var history = {
      "term": query,
      "when": new Date().toLocaleString()
    }
    
    // Query the image and populate results
    var req_url = `https://api.cognitive.microsoft.com/bing/v5.0/images/search?q=${query}&offset=${size}&count=5`
    var request = require('request');
    request({
        method: 'GET',
        url: req_url,
        headers: {
            'Ocp-Apim-Subscription-Key': 'f70eff2ee8c44c4fbd828baafc624f47'
        }
    }, function (error, response, body) {
        if (error) throw error;
        if (!error && response.statusCode == 200) {
            var object = JSON.parse(body)
            object = object.value
            res.send(Object.keys(object).map(function(index) {
                   return {
                        "url": object[index].contentUrl,
                        "title": object[index].name,
                        "thumbnail": object[index].thumbnailUrl,
                        "context": object[index].hostPageUrl
                    }
                })
            )
        }
    })
    
    // Save query and time to the database
    if (query !== 'favicon.ico') {
        // Save object into db.
        var coll_history = database.collection('img-sal-history')
        coll_history.save(history, function(err, result) {
            if (err) throw err
            console.log('Saved ' + result)
        })
    }
})

app.listen(process.env.PORT || 8080, function(){
    console.log('start listen in ', process.env.PORT)
})