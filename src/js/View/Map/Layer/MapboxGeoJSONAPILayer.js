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

/**
 * Used by the layers that make use of the API
 */
App.View.Map.Layer.MapboxGeoJSONAPILayer = App.View.Map.Layer.MapboxGLLayer.extend({

  initialize: function (config) {
    this.legendConfig = config.legend;
    this.layers = config.layers;
    this._ignoreOnLegend = config.ignoreOnLegend;
    this._idSource = config.source.id;
    this._ids = config.layers.map(l => l.id);

    // Call parent init class
    App.View.Map.Layer.MapboxGLLayer.prototype
      .initialize.call(
        this, 
        config.source.model,
        config.source.payload,
        config.legend,
        config.map
      );
  },

  _layersConfig: function () {
    return this.layers;
  },

  /**
   * Callback triggered when the server response is 'success'
   * 
   * @param {Object} model - model with server data
   */
  _success: function (model) {
    var response = (model.changed && model.changed.features)
      ? model.changed
      : { type: 'FeatureCollection', features: [] };

    // Set the response into the source
    this._map.getSource(this._idSource).setData(response);

    return model;
  },
});
