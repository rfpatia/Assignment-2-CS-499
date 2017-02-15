var request = require('request');
var parseString = require('xml2js').parseString;
var AWS = require('aws-sdk');

AWS.config.update({
    region: "us-west-1"
});

'use strict';

module.exports.hello = (event, context, callback) => {
    const response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin" : "*" // Required for CORS support to work
        },
        body: JSON.stringify({
            message: 'Wait time has been updated!'
        }),
    };

    fetchWaitingtimes();
    callback(null, response);
};

module.exports.queryLatestBus = (event, context, callback) => {
    queryLatestbus(callback);
};




var docClient = new AWS.DynamoDB.DocumentClient();
var table = "bus_live_map";
var tableid = "bus_id"

function fetchWaitingtimes() {
    request('https://rqato4w151.execute-api.us-west-1.amazonaws.com/dev/info', function (error, response, body) {
        if (!error && response.statusCode == 200) {

            var jsonContent = JSON.parse(body);

            for(var i = 0; i < jsonContent.length; i++)
            {
                putItem(jsonContent[i].id, jsonContent[i].logo, jsonContent[i].lat, jsonContent[i].lng, jsonContent[i].route);
                putBusid(jsonContent[i].id);
            }

        }
    })
}

function putItem(id, logo, lat, lng, route) {
    var params = {
        TableName:table,
        Item:{
            "id": id,
            "timestamp": Date.now(),
            "logo": logo,
            "lat": lat,
            "lng": lng,
            "route": route
        }
    };

    console.log("Adding a new item...");
    docClient.put(params, function(err, data) {
        if (err) {
            console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Added item:", JSON.stringify(data, null, 2));
        }
    });
}

function putBusid(id) {
    var params = {
        TableName: tableid,
        Item: {
            "id": id
        }

    };

    console.log("Adding bus id");
    docClient.put(params, function (err, data) {
        if (err) {
            console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Added item:", JSON.stringify(data, null, 2));
        }
    });
}

function queryLatestbus(callback) {
    var paramsbus = {
        TableName: "bus_id"
    };
    docClient.scan(paramsbus, function(err, data) {
        if (err)
        {
            console.log(err, err.stack);
            if (callback) {
                const responseErr = {
                    statusCode: 500,
                    body: JSON.stringify({'err' : err}),
                };
                callback(null, responseErr);
            }
        } // an error occurred
        else
        {
            var obj = [];
            var size = data.Items.length;
            var count = 0;
            data.Items.forEach(function (item) {

                var params = {
                    TableName : table,
                    KeyConditionExpression: "#key = :inputName",
                    ExpressionAttributeNames:{
                        "#key": "id"
                    },
                    ExpressionAttributeValues: {
                        ":inputName":item.id
                    }
                };

                docClient.query(params, function(err, data) {
                    if (err) {
                        console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
                    } else {
                        obj.push(JSON.parse(JSON.stringify(data.Items[0], ["id", "logo", "lat", "lng", "route"])));
                        count++;
                        console.log(count);
                        console.log(size);
                        if(count == size - 1) {
                            if (callback) {
                                const responseOk = {
                                    statusCode: 200,
                                    headers: {
                                        "Access-Control-Allow-Origin" : "*" // Required for CORS support to work
                                    },
                                    body: JSON.stringify(obj),
                                };
                                return callback(null, responseOk);
                            }
                        }

                    }
                });

            })
        }           // successful response
    });
}