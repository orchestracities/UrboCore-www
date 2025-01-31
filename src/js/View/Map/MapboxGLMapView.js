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
App.View.Map.MapboxView = Backbone.View.extend({

  basemaps: {},
  _sources: [],
  _currentBasemap: 'positron',
  _availableBasemaps: ['positron','dark','ortofoto'],
  // map default options
  _mapDefaultOptions: {
    center: [0, 0],
    container: null,
    interactive: true,
    minZoom: 0,
    maxZoom: 22,
    style: null,
    zoom: 12,
  },
  _map: {},
  _layers: [],
  _is3dActive: false,
  mapChanges: new Backbone.Model(),
  button3d: '<div class="toggle-3d"></div>',
  zoomControl: '<div class="zoom-control">'
    + '<div class="control in"> + </div>'
    + '<div class="control out"> - </div>'
    + '</div>',

  events: {
    'click .toggle-3d': 'toggle3d',
    'click .control.in': 'zoom',
    'click .control.out': 'zoom',
  },

  initialize: function(options) {
    this._options = options;
    // Merge user options with default map options
    this._mapOptions = _.defaults({}, this._mapDefaultOptions);
    this._mapOptions = _.reduce(options, function (sumOptions, option, index) {
      if (sumOptions[index]) {
        sumOptions[index] = option;
      }
      return sumOptions;
    }, this._mapOptions);

    this._currentBasemap = options.defaultBasemap || 'positron';
    this._availableBasemaps = options.availableBasemaps || ['positron','dark','ortofoto'];
    this._sprites = options.sprites;
    this.$el[0].id = "map";
    this.legend = new App.View.Map.MapboxLegendView([], this);
    this.basemapSelector = new App.View.Map.MapboxBaseMapSelectorView(this._availableBasemaps, this);
    this.$el.append(this.legend.render().$el);
    this.$el.append(this.basemapSelector.render().$el);
    this.$el.append(this.button3d);
    this.$el.append(this.zoomControl);
    this.filterModel = options.filterModel;

    this.listenTo(App.ctx,'change:bbox_status',this._changeBBOXStatus);
    this.listenTo(App.ctx, 'change:start change:finish', function() {
      if (options.filterModel) {
        options.filterModel.set('time', App.ctx.getDateRange());
      }
    }.bind(this));
    
    if (options.filterModel) {
      this.listenTo(options.filterModel, 'change', this._applyFilter);
    }
    if (options.autoRefresh) {
      this.realTime = setInterval(function() {
        this._applyFilter(options.filterModel);
      }.bind(this), options.autoRefresh);
    }
    _.bindAll(this,'dataLoaded');
  },

  render: function() {
    setTimeout(()=>{
      // TODO: move token to settings
      mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zbW9yc290IiwiYSI6ImNqYXBvcW9oNjVlaDAyeHIxejdtbmdvbXIifQ.a3H7tK8uHIaXbU7K34Q1RA';
      this._preloadBasemaps().then(function() {
        this._map = new mapboxgl.Map(
          _.defaults(
            {
              container: this.$el[0],
              style: this.basemaps['positron'],
            },
            this._mapOptions)
        );
        this._map
          .on('load', this.loaded.bind(this))
          .on('moveend',this.bboxChanged.bind(this))
          .on('dataloading', this.dataLoaded)
      }.bind(this));
    },100)
    return this;
  },

  dataLoaded: function() {
    // To implement in child
  },

  loaded: function() {
    this.mapChanges.set({'loaded':true});
    this._onMapLoaded();
  },

  bboxChanged: function() {
    let bbox = this.getBBox();
    this.mapChanges.set({'bbox': bbox});
    this._onBBoxChange(bbox);
  },

  _onBBoxChange: function(bbox) {
    // This event is called after map moved.
    // Override for bbox changes actions.
  },

  /**
   * Reset BBox
   */
  _resetBBox: function () {
    // Reset BBOX
    App.ctx.set('bbox', null);
    App.ctx.set('bbox_info', false);
    App.ctx.set('bbox_status', false);
  },

  _onMapLoaded: function() {
    // This event is called after map loaded.
    // Place your layers here.
  },

  onClose: function() {
    if (this.realTime) {
      clearInterval(this.realTime);
    }
    this._map.remove();
    this.stopListening();
    this.basemapSelector.close(),
    this.legend.close();

    // Reset BBOX
    this._resetBBox();
  },

  addSource: function(idSource, dataSource) {
    let source = {id: idSource, data: dataSource};
    let src = this._sources.find( function (src) {
      return source.id === src.id;
    }.bind(this));
    
    if(!src) {
      this._sources.push(source);
    }
    
    if (!this.getSource(idSource)) {
      this._map.addSource(idSource, dataSource);
    }

    return source;
  },

  getSource: function(idSource) {
    return this._map.getSource(idSource);
  },

  addLayers: function(layers) {
    layers.forEach(layer => {
      if (!this._map.getLayer(layer.id)) {
        this._map.addLayer(layer);
      }
    });
  },

  changeBasemap: function(name) {
    this._map.setStyle(this.basemaps[name]);
    this._currentBasemap = name;
    let sources = [];
    this._sources.forEach(src => {
      sources.push(this.addSource(src.id, src.data));
    });
    this._sources = sources;
    this.addLayers(this._layers);
  },

  updateData: function(layer) {
    //this._map.getSource(layer._idSource).setData(data);
  },
  
  getBBox: function() {
    return this._map.getBounds();
  },

  _preloadBasemaps: function() {
    let promise = new Promise(function(resolve,reject) {
      Promise.all(this._availableBasemaps.map(name => {
        return this._loadBasemap(name);
      })).then((response) => {
        Promise.all(response.map(r => r.json())).then(response => {
          this._availableBasemaps.forEach((bm, i) => {
            this.basemaps[bm] = response[i];
            
            if (this._sprites) {
              this.basemaps[bm].sprite = window.location.origin + this._sprites;
            }
            resolve();
          });
        })
      });
    }.bind(this));
    return promise;
  },

  _loadBasemap: function(name) {
    return fetch(`/mapstyles/${name}.json`);
  },

  resetSize: function() {
    this._map.resize();
  },

  _changeBBOXStatus: function() {
    if (App.ctx.get('bbox_status'))
      App.ctx.set('bbox', this._getCurrentBBOX());
    else
      App.ctx.set('bbox', null);
  },

  _applyFilter: function() {
    // Extend on implementation
  },

  _getCurrentBBOX: function() {
    let bbox = this.getBBox();
    return [bbox.getNorthEast().lng,bbox.getNorthEast().lat,bbox.getSouthWest().lng,bbox.getSouthWest().lat]
  },
  
  toggle3d: function(e) {
    this._is3dActive = !this._is3dActive;
    e.target.classList.toggle('active');
    this._map.setPitch(this._is3dActive ? 50 : 0);
    // This event is called after 3d button is clicked.
    // Extend on implementation.
  },

  addToLegend: function(item) {
    this.legend.addItemLegend(item);
  },

  drawLegend: function() {
    this.legend.drawLegend();
  },

  clearLegend: function() {
    this.legend.removeLegendItems();
  },
  
  zoom: function(e) {
    let currentZoom = this._map.getZoom();
    if (e.target.classList.contains('out')) {
      this._map.setZoom(currentZoom - 1)
    } else {
      this._map.setZoom(currentZoom + 1)      
    }
  }
});

