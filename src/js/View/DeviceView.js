App.View.DevicePeriod = Backbone.View.extend({
  _template: _.template( $('#devices-period_template').html() ),

  initialize: function(options) {

  },

  // _changedSelect: function(e){
  //   var $e = $(e.target);
  //   this.model.set($e.attr('id'),$e.val());
  //   // $('.button.water').attr('href', '/water/' + $e.val());
  //   // $('.button.waste').attr('href', '/waste/' + $e.val());
  //   this.$('.section_title span').html($('select#time option:selected').text());
  // },

  render: function(e){

    if (!this._renderer){
      this.$el.html(this._template());
      //this.$('select#time').val(this.model.get('time'));

      // this._chartView = new App.View.DeviceChart({el: this.$('#chart'),model: this.model});
      this._summaryView = new App.View.DeviceSumary({el: this.$('#summary'),model: this.model});
      // this._tableView = new App.View.DeviceTable({el: this.$('#table'),model: this.model});


      var metadata = App.Utils.toDeepJSON(App.mv().getEntity(this.model.get('entity')).get('variables'));
      var entityVariables = _.filter(metadata, function(el){
        return el.config ? el.config.active : el.units;
      });
      var varAgg = {};
      for(var i = 0; i<entityVariables.length; i++){
        var agg = _.findWhere(metadata, {id: entityVariables[i].id}).var_agg[0] || '';
        varAgg[entityVariables[i].id] = agg.toLowerCase();
      }
      var multiVariableModel = new Backbone.Model({
        category:'',
        title: __('Evolución'),
        aggDefaultValues: varAgg
      });

      // Get variables domains
      var yDomains = {};
      _.each(entityVariables, function(elem){
        if(elem.config && elem.config.local_domain)
          yDomains[elem.id] = elem.config.local_domain;
      });
      if(Object.keys(yDomains > 0)){
        multiVariableModel.set({ yAxisDomain: yDomains });
      }

      var stepModel = new Backbone.Model({
        'step':'1d'
      });

      var entityVariablesIds = _.map(entityVariables, function(el){ return el.id});

      var multiVariableCollection = new App.Collection.DeviceTimeSerieChart([],{
        scope: this.model.get('scope'),
        entity: this.model.get('entity'),
        device: this.model.get('id'),
        vars: entityVariablesIds,
        id:this.model.get('id'),
        step: '1h'
      });

      this._chartView = new App.View.Widgets.MultiVariableChart({
        el: this.$('#chart'),
        collection:multiVariableCollection,
        multiVariableModel: multiVariableModel,
        stepModel: stepModel
      });

      this._renderer = true;
    }

    return this;
  },

  onClose: function(){
    this.stopListening();
    if (this._chartView) this._chartView.close();
    if (this._summaryView) this._summaryView.close();
    if (this._tableView) this._tableView.close();
  }

});

App.View.DeviceRaw = Backbone.View.extend({
  _template: _.template( $('#devices-raw_template').html() ),

  initialize: function(options) {

  },

  events: {
    'change select': '_changedSelect',
  },

  _changedSelect: function(e){
    var $e = $(e.target);
    this.model.set($e.attr('id'),$e.val());
  },

  render: function(e){
    if (!this._renderer){
      this.$el.html(this._template());
      this.$('select#time').val(this.model.get('time'));

      var metadata = App.Utils.toDeepJSON(App.mv().getEntity(this.model.get('entity')).get('variables'));
      var entityVariables = _.filter(metadata, function(el){
        return el.config ? el.config.active : el.units;
      });
      var varAgg = [];
      for(var i = 0; i<entityVariables.length; i++){
        var agg = metadata[i].var_agg[0] || '';
        varAgg.push(agg.toLowerCase());
      }
      var multiVariableModel = new Backbone.Model({
        category: '',
        title: __('Evolución'),
        aggDefaultValues: varAgg
      });

      // Get variables domains
      var yDomains = {};
      _.each(entityVariables, function(elem){
        if(elem.config && elem.config.local_domain)
          yDomains[elem.id] = elem.config.local_domain;
      });
      if(Object.keys(yDomains > 0)){
        multiVariableModel.set({ yAxisDomain: yDomains });
      }

      var multiVariableCollection = new App.Collection.DeviceRaw([],{
        scope: this.model.get('scope'),
        entity: this.model.get('entity'),
        device: this.model.get('id'),
        variables: _.pluck(entityVariables,'id')
      });
      multiVariableCollection.parse = App.Collection.Variables.Timeserie.prototype.parse;

      this._chartView = new App.View.Widgets.MultiVariableChart({
        el: this.$('#chart'),
        collection: multiVariableCollection,
        multiVariableModel: multiVariableModel,
        noAgg: true
      });

      this._tableView = new App.View.Widgets.Device.DeviceRawTable({
        el: this.$('#table'),
        model: this.model,
        collection: multiVariableCollection,
        vars: entityVariables
      });

      this._renderer = true;
    }

    return this;
  },

  onClose: function(){
    this.stopListening();
    if (this._chartView) this._chartView.close();
    if (this._tableView) this._tableView.close();
  }

});

App.View.DeviceLastData = Backbone.View.extend({
  _template: _.template( $('#devices-lastdata_template').html() ),

  initialize: function(options) {
    _.bindAll(this,'_onModelFetched');
  },

  onClose: function(){
    if(this._widgetViews){
      for (var i=0;i<this._widgetViews.length;i++){
        this._widgetViews[i].close();
      }
    }
    this.stopListening();
  },

  render: function(e){

    if (!this._renderer){
      this.collection = new Backbone.Collection();
      this.collection.url = this.model.durl() + '/' + this.model.get('entity') + '/' + this.model.get('id') + '/lastdata';
      this.listenTo(this.collection,'reset',this._onModelFetched);
      this.$el.append(App.circleLoading());
      this.collection.fetch({'reset': true});

    }

    return this;
  },

  _onModelFetched:function(){
    var lastdata = this.collection.toJSON()[0].lastdata;
    var timeinstant = this.collection.toJSON()[0].timeinstant

    this._widgetViews = [new App.View.LastDataWidgetMap({
        model: new Backbone.Model({
          icon: this.model.get('icon'),
          lat: this.collection.toJSON()[0].location.lat,
          lng: this.collection.toJSON()[0].location.lng
        })
    })];

    var legacyScopes = ['andalucia','osuna','guadalajara'];
    if(legacyScopes.indexOf(this.model.get('scope')) !== -1){

      for (var i=0;i<lastdata.length;i++){
        var var_id = lastdata[i].var_id;
        var model = new Backbone.Model({
            'className':'col-md-4',
            'var_id':var_id,
            'var_value':lastdata[i].var_value,
            'timeinstant':timeinstant
        });

        if(
            var_id == 'waste.moba.s_class'
            || var_id == 'waste.moba.sensor_code'
            || var_id == 'waste.issue.category'
            || var_id == 'waste.issue.status'
            || var_id == 'mt_winddir'
            || var_id == 'ev_state'
            || var_id == 'ev_type'
            || var_id == 'tu_activlocality')
          {

          var v = new App.View.LastDataWidgetSimple({'model': model})
        }else if(App.mv().getVariable(var_id).get('var_thresholds') !== null){
          var v = new App.View.Widgets.Gauge({'model': model})
        }
        if(v)
          this._widgetViews.push(v);
      }
    }else{
      // New scopes
      for (var i=0;i<lastdata.length;i++){
        var var_id = lastdata[i].var_id;
        var varMetadata = App.mv().getVariable(var_id);
        var varConfig = varMetadata ? varMetadata.get('config'): null;

        if(varConfig && varConfig.widget){
          var model = new Backbone.Model({
              className: 'col-md-4',
              var_id: var_id,
              var_value: lastdata[i].var_value,
              timeinstant: timeinstant
          });
          var widget = null;
          switch (varConfig.widget) {
            case 'gauge':
              if(varMetadata.get('var_thresholds'))
                widget = new App.View.Widgets.Gauge({
                  model: model
                });
              break;
            case 'fillbar':
              widget = new App.View.Widgets.Device.FillBar({
                title: __(varMetadata.get('name')),
                data: {
                  variable: var_id,
                  value: lastdata[i].var_value,
                  max: varConfig.local_domain ? varConfig.local_domain[1] : 100,
                },
                thresholds: varMetadata.get('var_thresholds') ? [varMetadata.get('var_thresholds')[1],varMetadata.get('var_thresholds')[2]] : [80,90]
              });
              break;
            case 'variable':
              widget = new App.View.LastDataWidgetSimple({
                model: model
              });
              break;
          }
          if(widget)
            this._widgetViews.push(widget);
        }
      }
    }

    this.$el.html(this._template({m: this.model.toJSON()}));
    for (var i=0;i<this._widgetViews.length;i++){
      this.$('.widget_container').append(this._widgetViews[i].el);
      this._widgetViews[i].render();
    }
    this._renderer = true;
  }

});

App.View.LastDataWidget = Backbone.View.extend({
  className: 'col-md-4',

  _template: _.template(''),

  initialize: function(options) {

  },

  render: function(){
    this.$el.html(this._template({m: this.model ? this.model.toJSON() : null}));

    // Let's make an square widget
    var $widget = this.$('.widget');
    $widget.height($widget.width());

  }

});

App.View.LastDataWidgetSimple = App.View.LastDataWidget.extend({

  _template: _.template( $('#devices-lastdata_chart_template').html() ),

  initialize: function(options) {

  },

  render: function(){
    this.$el.html(this._template({m: this.model ? this.model.toJSON() : null}));
    this.$('.chart').remove();
    this.$('.co_value').addClass('textleft');
    this.$('.widget').addClass('reduced')
    return this;
  }
});

App.View.LastDataWidgetMap = App.View.LastDataWidget.extend({
  _template: _.template( $('#devices-lastdata_map_template').html() ),


  initialize: function(options) {

  },

  render: function(){
    App.View.LastDataWidget.prototype.render.apply(this);

    // TODO: Create MAP
    this.map = new L.Map(this.$('#devicemap')[0], {
      zoomControl : false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom:false,
      attributionControl : false
    });

    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
    }).addTo(this.map);

    var icon = L.icon({
      iconUrl: '/img/' + this.model.get('icon'),
      iconSize:     [24, 24],
      iconAnchor:   [12, 12],
      popupAnchor:  [0, 0]
    });

    var pos = [this.model.get('lat'),this.model.get('lng')];
    L.marker(pos, {icon: icon}).addTo(this.map);
    this.map.setView(pos, 16);

    return this;

  }

});

App.View.DeviceTimeWidget = Backbone.View.extend({

  initialize: function(options) {

    this._raw = options.raw===true || false;

    this.listenTo(App.ctx,'change:start change:finish',this._fetchCollection);
    this.listenTo(this.model,'change:agg',this._fetchCollection);
    this.listenTo(this.model,'change:lastupdate',this._fetchCollection);

    this.listenTo(this.collection,'reset',this.render);
    this._fetchCollection();

  },

  _fetchCollection: function(){

    // var agg = this._raw ? 'raw' : (this.model.get('current_agg') ? this.model.get('current_agg').join(','): null);
    var agg = [];
    if(this._raw){
      agg = 'raw';
    }else if(this.model.get('current_agg')){
      if(this.model.get('current_agg').length !== undefined)
        agg = this.model.get('current_agg').join(',');
      else
        agg = _.map(this.model.get('current_agg'), function(k,v){return k}).join()
    }

    var vars = this._raw ? null : (this.model.get('vars') ? this.model.get('vars').join(','): null);
    // agg = agg == undefined ? null:agg;

    // this.model.set('current_agg',agg);
    var time = App.ctx.getDateRange();

    this.collection.fetch({
      reset: true,
      data: {
        // time: this.model.get('time'),
        // vars: this.model.get('vars').join(','),
        // devices: this.model.get('id'),
        // agg: this.model.get('current_agg').join(',')
        devid: this.model.get('id'),
        deventity: this.model.get('entity'),
        start: time.start,
        finish: time.finish,
        vars:vars,
        agg:agg
      }
    });
  },

  onClose: function(){
    this.stopListening();
  }

});

App.View.DeviceTable = App.View.DeviceTimeWidget.extend({
  _template: _.template( $('#devices-table_template').html() ),

  initialize: function(options) {
    this.collection = new App.Collection.DeviceTimeSerie(null,{
      scope:this.model.get('scope'),
      entity: this.model.get('entity'),
      device: this.model.get('id')
    });
    // call parent class
    App.View.DeviceTimeWidget.prototype.initialize.call(this, options);
  },

  render: function(){
    this.$el.html(this._template({c: this.collection.toJSON()[0],m:this.model.toJSON()}));
    return this;
  }
});

App.View.DeviceSumary = App.View.DeviceTimeWidget.extend({
  _template: _.template( $('#devices-summary_template').html() ),

  events: {
    //'change select': '_changedSelect',
    'click ul[data-variable] li': '_changeVarAgg',
  },

  initialize: function(options) {
    var _this = this;
    this.metadata = App.Utils.toDeepJSON(App.mv().getEntity(this.model.get('entity')).get('variables'));
    this.entityVariables = _.filter(this.metadata, function(el){
      return el.units;
    });
    this.entityVariables = _.map(this.entityVariables, function(el){ return el.id});
    // this.varAgg = {};
    // for(var i = 0; i<this.entityVariables.length; i++){
    //   var agg = _.findWhere(this.metadata, {id: this.entityVariables[i]}).var_agg[0] || '';
    //   this.varAgg[this.entityVariables[i]] = agg.toLowerCase();
    // }

    // this.collection = new App.Collection.DevicesSummary(null,{
    //   scope:this.model.get('scope'),
    //   entity: this.model.get('entity'),
    //   device: this.model.get('id'),
    //   vars: this.entityVariables,
    //   agg: _.map(this.varAgg, function(k,v){return k}).join()
    // });
    this.collection = new Backbone.Collection();
    for(var i = 0; i<this.entityVariables.length; i++){
      var meta = _.findWhere(this.metadata, {id: this.entityVariables[i]});
      var model = new App.Model.Post({
        id: this.entityVariables[i],
        aggs: meta.var_agg,
        current_agg: meta.var_agg[0],
        device: this.model.get('id'),
        name: meta.name,
        units: meta.units,
        color: App.getSensorVariableColor(i)
      });
      model.url = App.config.api_url + '/' + this.model.get('scope') + '/variables/' + this.entityVariables[i] + '/historic';
      this.collection.push(model);
      this._fetchModel(model);
    }

    this.listenTo(App.ctx,'change:start change:finish',function(){
      _.each(_this.collection.models, function(m) {
        _this._fetchModel(m);
      });
    });

    if(options.template)
      this._template = _.template( $(options.template).html() )


    // call parent class
    // App.View.DeviceTimeWidget.prototype.initialize.call(this, options);

    this.render();
  },

  _fetchModel:function(model){
    var _this = this;
    // $(this.$('[data-variable="' + variable + '"]').closest('.summary_block')).html(App.circleLoading())
    var el = this.$('li[variable="' + model.get('id') + '"]');
    if(el.length > 0)
      el.find('.summary_block').html(App.circleLoading())

    model.fetch({
      data:{
        agg:model.get('current_agg'),
        time: {
          start: App.ctx.getDateRange().start,
          finish: App.ctx.getDateRange().finish
        },
        filters: {
          condition:{id_entity__eq:this.model.get('id')}
        }
      },
      success:function(data){
        _this.$('ul.row .loading').remove();
        if(el.length > 0)
          el.replaceWith(_this._template({m:data.toJSON()}));
        else
          _this.$('ul.row').append(_this._template({m:data.toJSON()}));
      }
    });
  },

  render: function(){
    this.$el.html('<ul class="row">' + App.circleLoading() + '</ul>');
      // this.metadata = _.indexBy(this.metadata, function(el){ return el.id; });

      // var agg = [];
      // if(this.collection.toJSON()[0] && this.collection.toJSON()[0].metadata){
      //   _.each(this.collection.toJSON()[0].metadata.varagg,function(aggs){
      //     agg.push(aggs[0].toLocaleLowerCase());
      //   });
      //   !this.model.get('vars') ? this.model.set('vars', this.collection.toJSON()[0].metadata.vars):null;
      // }
      // !this.model.get('current_agg') || this.model.get('current_agg').length == 0 ? this.model.set('current_agg', this.varAgg):[];

      // this.$el.html(this._template({c: this.collection.toJSON()[0], m: this.model.toJSON(), metadata: this.metadata}));

    return this;
  },

  _changeVarAgg: function(e){
    e.preventDefault();
    var $e = $(e.target),
      variable = $e.parent().attr('data-variable'),
      agg = $e.attr('data-agg');

    var model = this.collection.get(variable);
    model.set('current_agg',agg);
    this._fetchModel(model);

    // this.model.get('current_agg')[variable] = agg;

    // // trigger model update
    // this.model.set({
    //   'lastupdate' : new Date()
    // });
  },
});
