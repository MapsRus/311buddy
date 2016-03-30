var fs = require('fs')
  , csv = require('csv')
  , Mustache = require('mustache')
  ;

var output = fs.createWriteStream('./agencies.cartocss');

var template = '#cleaned[agency="{{agency}}"] {\nmarker-fill: #A6CEE3;\n}';

fs.readFile('agencies.csv', "utf8", function(err, data) {
  if (err) throw err;

  csv.parse(data, function(err, agencies){
    console.log(agencies);

    agencies.forEach(function(agency) {
      var rule = Mustache.render(template,{
        agency: agency[0]
      });

      console.log(rule);
    });
  });
});


// #cleaned[agency="DEP"] {
//    marker-fill: #A6CEE3;
// }