// Copyright 2017 Telefónica Digital España S.L.
//
// This file is part of UrboCore WWW.
//
// UrboCore WWW is free software: you can redistribute it and/or
// modify it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// UrboCore WWW is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero
// General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with UrboCore WWW. If not, see http://www.gnu.org/licenses/.
//
// For those usages not covered by this license please contact with
// iot_support at tid dot es

'use strict';

App.View.Widgets.Gauge = Backbone.View.extend({

  _template: _.template($('#widgets-widget_gauge_template').html()),

  initialize: function (options) {

    this.options = _.defaults(options, {
      fetchModel: false,
      global: false
    });

    this.model = options.model;

    // Hide the widget if the scope has not permissions
    if (!App.mv().validateInMetadata({ 'variables': [this.model.get('var_id')] })) {
      return;
    }

    this.className = this.model.get('className');
  },


  onClose: function () {
    this.stopListening();
  },

  render: function () {
    var _this = this;
    var metaData = App.Utils.toDeepJSON(App.mv().getVariable(this.model.get('var_id')));

    this.$el.html(this._template({ m: this.model.toJSON(), 'metaData': metaData, 'fetchModel': this.options.fetchModel }));

    this.$el.addClass(this.model.get('className'));

    if (!this.options.fetchModel) {
      this._draw(metaData);
    } else {
      this.model.fetch({
        data: this.model.get('data'),
        success: function (data) {
          _this.model.set('var_value', data.get('value'));
          _this._draw(metaData);
          _this.$('.co_value .value').html(App.nbf(data.get('value')) + '<span>' + metaData.units + '</span>')
        }
      });
    }


    return this;
  },

  _draw: function (metaData) {
    var _this = this;
    var chart = this.$('.chart');

    chart.html('');

    var varRange = {
      'min': parseFloat(this.options.global ? metaData.config.global_threshold[0] : metaData.var_thresholds[0]),
      'warning': parseFloat(this.options.global ? metaData.config.global_threshold[1] : metaData.var_thresholds[1]),
      'error': parseFloat(this.options.global ? metaData.config.global_threshold[2] : metaData.var_thresholds[2]),
      'max': parseFloat(this.options.global ? metaData.config.global_threshold[3] : metaData.var_thresholds[3])
    };

    this.model.set('var_value', this.model.get('var_value') == 'null' ? varRange.min : parseFloat(this.model.get('var_value')));

    if (varRange['max'] < this.model.get('var_value'))
      varRange['max'] = Math.ceil(this.model.get('var_value'));


    if (varRange) {
      if (metaData.reverse) {
        if (this.model.get('var_value') <= varRange.error) {
          this.$('.co_value .value').addClass('error');
        } else if (this.model.get('var_value') <= varRange.warning) {
          this.$('.co_value .value').addClass('warning');
        }

      } else {
        if (this.model.get('var_value') >= varRange.error) {
          this.$('.co_value .value').addClass('error');
        } else if (this.model.get('var_value') >= varRange.warning) {
          this.$('.co_value .value').addClass('warning');
        }
      }
    }

    var width = 210;
    var height = 160;
    var r = width / 2;
    var ringWidth = 20;
    var ringInset = 0;
    var minAngle = -120;
    var maxAngle = 120;
    var minValue = varRange.min;
    var maxValue = varRange.max;
    var pointerWidth = 4;
    var pointerTailLength = 0;
    var pointerHeadLength = 81;
    var labelFormat = d3.format(',g');
    var range = maxAngle - minAngle;
    var scale = d3.scale.linear().range([0, 1]).domain([minValue, maxValue]);
    var ticks = [varRange.min, varRange.warning, varRange.error, varRange.max];

    var svg = d3.select(chart[0])
      .append('svg:svg')
      .attr('class', 'gauge')
      .attr('width', width)
      .attr('height', height);

    var centerTx = 'translate(' + r + ',' + r + ')';

    var arcs = svg.append('g')
      .attr('class', 'arc')
      .attr('transform', centerTx);

    var tickData = [];
    tickData[0] = ((varRange.warning - varRange.min) / (varRange.max - varRange.min)) * range;
    tickData[1] = tickData[0] + ((varRange.error - varRange.warning) / (varRange.max - varRange.min)) * range;
    tickData[2] = tickData[1] + ((varRange.max - varRange.error) / (varRange.max - varRange.min)) * range;

    var arc = d3.svg.arc()
      .innerRadius(r - ringWidth - ringInset)
      .outerRadius(r - ringInset)
      .startAngle(function (d, i) {
        return _this._deg2rad(minAngle + (i == 0 ? 0 : tickData[i - 1]));
      })
      .endAngle(function (d, i) {
        return _this._deg2rad(minAngle + tickData[i]);
      })
      ;


    //TODO cambiar esto
    if (metaData.reverse) {
      arcs.selectAll('path')
        .data(tickData)
        .enter().append('path')
        .attr('fill', function (d, i) {
          if (i == 0) {
            return App.Utils.rangeColor(App.Utils.RANGES.ERROR);
          } else if (i == 1) {
            return App.Utils.rangeColor(App.Utils.RANGES.WARNING);
          } else if (i == 2) {
            return App.Utils.rangeColor(App.Utils.RANGES.OK);
          }

        })
        .attr('d', arc);
    } else {
      arcs.selectAll('path')
        .data(tickData)
        .enter().append('path')
        .attr('fill', function (d, i) {
          if (i == 0) {
            return App.Utils.rangeColor(App.Utils.RANGES.OK);
          } else if (i == 1) {
            return App.Utils.rangeColor(App.Utils.RANGES.WARNING);
          } else if (i == 2) {
            return App.Utils.rangeColor(App.Utils.RANGES.ERROR);
          }

        })
        .attr('d', arc);
    }


    /////////////////////////////////////////////////////////////////////////////////////////

    var lg = svg.append('g')
      .attr('class', 'label')
      .attr('transform', centerTx);

    lg.selectAll('text')
      .data(ticks)
      .enter().append('text')
      .attr('transform', function (d) {
        var angle = (minAngle + (scale(d) * range)) - minAngle + (minAngle + 90)
        var x = Math.cos(_this._deg2rad(angle)) * (-r) * 0.64;
        var y = (Math.sin(_this._deg2rad(angle)) * (-r) * 0.64) + 5;
        return 'translate(' + x + ',' + y + ')';
      })
      .attr("text-anchor", function (d) {
        var angle = (minAngle + (scale(d) * range)) - minAngle + (minAngle + 90)
        var anchor = '';
        angle > 90 ? anchor = 'end' : (angle == 90 ? anchor = 'middle' : anchor = 'start');
        return anchor;
      })
      .text(labelFormat)
      ;

    var lines = svg.append('g').attr('transform', centerTx);
    for (var i = varRange.min; i <= varRange.max; i = i + ((varRange.max - varRange.min) / 30)) {

      var angle = (minAngle + (scale(i) * range)) - minAngle + (minAngle + 90)
      var x = Math.cos(_this._deg2rad(angle)) * (-r) * 0.77;
      var y = Math.sin(_this._deg2rad(angle)) * (-r) * 0.77;

      lines.append('line')
        .attr("x1", x)
        .attr("y1", y)
        .attr("x2", x * 0.9)
        .attr("y2", y * 0.9)
        .style("stroke-width", "1px");
    };


    var lineData = [[pointerWidth / 2, 0],
    [0, -pointerHeadLength],
    [-(pointerWidth / 2), 0],
    [0, pointerTailLength],
    [pointerWidth / 2, 0]];

    var pointerLine = d3.svg.line().interpolate('monotone');

    var pg = svg.append('g').data([lineData])
      .attr('class', 'pointer')
      .attr('transform', centerTx);

    // var pointer = pg.append('path')
    // 								.attr('d', pointerLine)
    // 								.attr('transform', 'rotate(' + minAngle +')');

    svg.append("circle")
      .attr("cx", r)
      .attr("cy", r)
      .attr("r", 5)
      .style("fill", "#00475d");

    var arc = d3.svg.arc()
      .innerRadius(5)
      .outerRadius(3)
      .startAngle(0)
      .endAngle(360);

    svg.append("path")
      .attr("d", arc)
      .attr('transform', 'translate(' + r + ',' + r + ')')
      .attr('fill', '#fff');

    if (this.model.get('var_value') != null && this.model.get('var_value') != undefined) {

      var pointer = pg.append('path')
        .attr('d', pointerLine)
        .attr('transform', 'rotate(' + minAngle + ')');

      var newValue = this.model.get('var_value');
      var ratio = scale(newValue);
      if (ratio < 0) {
        ratio = -0.01;
      } else if (ratio > 1) {
        ratio = 1.01;
      }
      var newAngle = minAngle + (ratio * range);
      pointer.attr('transform', 'rotate(-110)')
        .transition()
        .duration(2000)
        .ease('elastic')
        .attr('transform', 'rotate(' + newAngle + ')');
    }
  },

  _deg2rad: function (deg) {
    return deg * Math.PI / 180;
  }

});
