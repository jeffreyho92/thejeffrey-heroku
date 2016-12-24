var express = require('express')
var moment = require('moment')
var app = express()

app.use(express.static(__dirname + '/public'));

app.get('/:value', function(req, res){
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

app.listen(process.env.PORT || 8080, function(){
    console.log('start listen in ', process.env.PORT)
})