
    var cdb_user = 'cwhong',
    cdb_table = 'cleaned';

    var agencyChart;

    var sql = new cartodb.SQL({ user: cdb_user });

    var zoom = 13;
    var cdbLayer;

    //gets the current date range an updates the header
    getDataRange();

    //create a new empty leaflet map over NYC
    var map = new L.Map('map', { 
      center: [40.705563,-73.971977],
      zoom: zoom
    });



    //add mapzen geocoder to allow for address search
    var options = {
      latlng: true,
      position: 'topright',
      expanded: true
    }


    L.control.geocoder('search-zTuXMNE', options).addTo(map);

    //leaflet hash plugin updates the URL with the current map center and zoom level
    var hash = new L.Hash(map);

    //add dark basemap
    L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',{
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    }).addTo(map);

    //var layerUrl = 'https://cwhong.cartodb.com/api/v2/viz/99d7fb1c-f625-11e5-88fa-0e31c9be1b51/viz.json';

    $.getJSON('data/viz.json', function(vizjson) {
      console.log(vizjson);

      var layerOptions = vizjson.layers[1].options.layer_definition.layers[0].options;

      layerOptions.sql = Mustache.render($('#mapSqlTemplate').text(), {factor: 10});
      layerOptions.cartocss = Mustache.render($('#mapStyleTemplate').text(), {});
      //create the CartoDB Layer
      cartodb.createLayer(map, vizjson)
        .addTo(map)
        .on('done', function(layer) {
          cdbLayer = layer.getSubLayer(0);
          fetchData(map.getBounds());
          updateMap(map.getZoom());

          //event handler for any changes to the map viewport
          map.on('moveend', function(e) {
            fetchData(map.getBounds());
            updateMap(map.getZoom());
          });


        })
    });



    //set up charts with nv.d3.js
    nv.addGraph(function() {
      agencyChart = nv.models.multiBarHorizontalChart()

        .x(function(d) { return d.label })   
        .y(function(d) { return d.value })
        .margin({top: 0, right: 0, bottom: 0, left: 150})
        .showValues(true) 
        .valueFormat(function(d){
          return d;
        })
        .showControls(false)
        .showLegend(false)
        .height(250)
        .showYAxis(false)
        .barColor(function(d) { 
          return getColor(d.label)
        });
      ;

      agencyChart.tooltip.enabled(false);
      nv.utils.windowResize( agencyChart.update);

      return agencyChart;
    });

    nv.addGraph(function() {
      typeChart = nv.models.multiBarHorizontalChart()

        .x(function(d) { return d.label })   
        .y(function(d) { return d.value })
        .margin({top: 0, right: 0, bottom: 0, left: 150})
        .showValues(true) 
        .valueFormat(function(d){
          return d;
        })
        .showControls(false)
        .showLegend(false)
        .height(250)
        .showYAxis(false)
        .barColor(function(d) { 
          return 'steelblue'
        });
      ;

      typeChart.tooltip.enabled(false);
      nv.utils.windowResize(typeChart.update);

      return typeChart;
    });

    //gets the max and min date where date is within 30 days of today
    function getDataRange() {
      sql.execute("SELECT to_char(max(created_date) AT TIME ZONE 'EST5EDT','Dy, Mon DD, YYYY')  max, to_char(min(created_date) AT TIME ZONE 'EST5EDT','Dy, Mon DD, YYYY') min FROM cleaned WHERE created_date > current_date - interval '30 days'")
      .done(function(data) {
        console.log(data);
        $('#dataRange').text(Mustache.render('Current date Range: {{min}} through {{max}}', {
          min: data.rows[0].min,
          max: data.rows[0].max
        }))
      })
    }

    function updateMap(zoom) {
      console.log('new zoom is ' + zoom)
      cdbLayer.setSQL(Mustache.render($('#mapSqlTemplate').text(), {factor: getFactor(zoom)}));
      cdbLayer.setCartoCSS(Mustache.render($('#mapStyleTemplate').text(), {}));
    }

    function getFactor(z) {
      console.log(z);
       return z == 14 ? 30 :
        z == 15 ? 20 :
        z == 16 ? 10 :
        z == 17 ? 5 :
        z == 18 ? 2.5 :
        10;

    }

    //fetches data to power the charts based on the current viewport
    function fetchData(bounds) {

      //count by agency
      sql.execute("SELECT agency, count(cartodb_id) FROM {{table}} WHERE the_geom && ST_MakeEnvelope({{bounds._southWest.lng}}, {{bounds._southWest.lat}}, {{bounds._northEast.lng}}, {{bounds._northEast.lat}}, 4326) AND created_date > current_date - interval '30 days' GROUP BY agency ORDER BY count DESC;", { 
          table: cdb_table,
          bounds: bounds
        })
        .done(function(data) {
          var agencyChartData = [{
            key: "Series 1",
            values: []
          }];

          data.rows.forEach( function(row) {
            agencyChartData[0].values.push({
              label: row.agency,
              value: row.count
            })
          });

          callChart('agencyChart', agencyChartData);

        })
        .error(function(errors) {
          // errors contains a list of errors
          console.log("errors:" + errors);
        });

        //count by complaint_type, limit 10
        sql.execute("SELECT complaint_type, count(cartodb_id) FROM {{table}} WHERE the_geom && ST_MakeEnvelope({{bounds._southWest.lng}}, {{bounds._southWest.lat}}, {{bounds._northEast.lng}}, {{bounds._northEast.lat}}, 4326) AND created_date > current_date - interval '30 days'  GROUP BY complaint_type ORDER BY count DESC LIMIT 10;", { 
          table: cdb_table,
          bounds: bounds
        })
        .done(function(data) {
          var typeChartData = [{
            key: "Series 1",
            values: []
          }];

          data.rows.forEach( function(row) {
            typeChartData[0].values.push({
              label: row.complaint_type,
              value: row.count
            })
          });

          callChart('typeChart',typeChartData);
  
        });
    };

    //updates chart with new data
    function callChart(chart, data) {
      d3.select('#' + chart + ' svg')
        .datum(data)
        .transition().duration(750)
        .call(window[chart]);
    }

    //maps colors to agency acronyms
    function getColor(agency) {
      switch(agency) {
        case 'HPD':
            return '#A6CEE3'
            break;
        case 'NYPD':
            return '#1F78B4'
            break;
        case 'DOT':
            return '#B2DF8A'
            break;
        case 'DEP':
            return '#33A02C'
            break;
        case 'DSNY':
            return '#FB9A99'
            break;
        case 'DOB':
            return '#E31A1C'
            break;
        case 'DPR':
            return '#FDBF6F'
            break;
        case 'DOHMH':
            return '#FF7F00'
            break;
        case 'DOF':
            return '#CAB2D6'
            break;
        case 'DHS':
            return '#6A3D9A'
            break;
        case 'TLC':
            return '#f7ff00'
            break;
        case 'HRA':
            return '#ff00d3'
            break;
        case 'DCA':
            return '#00ceff'
            break;
        default:
            return '#DDDDDD'
        }
      }


