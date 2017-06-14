Ext.define("risk-viewer-form", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    defaults: { margin: 10 },
    config: {
        defaultSettings: {
            formConfigurationSettings: {},
            formInstructions: '',
            approvalField: false,
            enableFormattedID: false,
            globalUser: '',
            submitDirectory: '',
            enableUserFilter: false
        }
    },
    formModel: undefined,
    formModelName: 'UserStory',
    items: [],
    notAllowedFields: [
            //User story fields
            'ScheduleState','PortfolioItem',
            //Portfolio Item fields
            'State','Children',
            //Common fields
            'Parent','PredecessorsAndSuccessors','Predecessors','Successors','Project','Milestones','Workspace','Tags','Changesets','DisplayColor'
    ],
    externalAppSettingsKey: Ext.id() + 'AppSettings',
    launch: function() {
        if (this.isExternal()){
            this.getExternalAppSettings(this.externalAppSettingsKey);
        } else {
            this.onSettingsUpdate(this.getSettings());
        }
    },
    _prepareApp: function(){
        Rally.technicalservices.WsapiToolbox.fetchModel(this.formModelName).then({
            scope: this,
            success: function(model){
                this.formModel = model;
                this._validateSettings(model);
            },
            failure: function(msg){
                Rally.ui.notify.Notifier.showError({message: msg});
            }
        });
    },
    _validateSettings: function(model){
        var config_obj = this.formConfiguration;
        if (!Ext.isObject(config_obj)){
            var formSettings = this.getSetting('formConfigurationSettings');
            if (!Ext.isObject(formSettings)){
                config_obj = Ext.JSON.decode(formSettings);
            }
        }
        if (_.isEmpty(config_obj)){
            this.add({
                xtype: 'container',
                itemId: 'display_box',
                flex: 1,
                html: 'No form configuration has been defined.<br/>Please use the App Settings to configure the form.',
                style: {
                    fontFamily: 'ProximaNovaLight, Helvetica, Arial'
                }
            });
        } else {
            this.formConfiguration = config_obj;
            this.model = model;
            this._showGrid(model);
        }
    },
    _buildForm: function(model, form_config, record){
        this._clearWindow();
        this.add({xtype:'container',itemId:'display_box', flex: 1});
        this.add({xtype:'container',itemId:'button_box', flex: 1, layout: {type: 'hbox', pack: 'center'}});
        this.down('#display_box').add({
            xtype: 'tsrequestform',
            itemId: 'requestform',
            model: model,
            record: record,
            instructions: this.formInstructions,
            formConfiguration: form_config,
            submitDirectory: this.submitDirectory,  //If ready is set, push the record to here
            listeners: {
                scope: this,
                save: this._onSaved,
                onwarning: this._onWarning,
                onerror: this._onError,
                ready: this._onReady
            }
        });
        this.down('#button_box').add({
            xtype:'rallybutton',
            text: 'Done',
            itemId: 'btn-done',
            style: {
                textAlign: 'center'
            },
            width: 75,
            scope: this,
            handler: this._save
        });
        this.down('#button_box').add({
            xtype:'rallybutton',
            text: 'Cancel',
            itemId: 'btn-cancel',
            style: {
                textAlign: 'center'
            },
            width: 75,
            scope: this,
            handler: this._cancel
        });
    },
    _save: function(){
        var requestForm = this.down('#requestform');
        requestForm.save();
    },
    _onSaved: function(newRecord){
        Rally.ui.notify.Notifier.show({message: newRecord.get('FormattedID') + ': ' + newRecord.get('Name') + ' saved'});
        this._showGrid(this.model);
    },
    _cancel: function(){
        this._showGrid(this.model);
    },
    _onWarning: function(obj){
        Rally.ui.notify.Notifier.showWarning(obj);
    },
    _onError: function(obj){
        Rally.ui.notify.Notifier.showError(obj);
    },
    _onReady: function(form){
        form.doLayout();
        form.setWidth('95%')
        this.down('#display_box').doLayout();
    },
    _clearWindow: function(){
        if (this.down('#story-grid')){
            this.down('#story-grid').destroy();
        }
        if (this.down('#display_box')){
            this.down('#display_box').destroy();
        }
        if (this.down('#btn-cancel')){
            this.down('#btn-cancel').destroy();
        }
        if (this.down('#btn-done')){
            this.down('#btn-done').destroy();
        }
    },
    _checkSubmit: function(store,record,action,field) {
        if (field.includes('Ready') && (action === 'edit') && (record.raw.Ready === false)) {
            if ( this.submitDirectory ) {
                record.set('Project', this.submitDirectory);
                this.fireEvent('update');
            }
        }
    },
    _showGrid: function(model) {
        var app = this;
        this._clearWindow();
        var context = this.getContext();
        var filters = [];
        var oredFilters = [];
        if (this.getSetting('enableUserFilter')){
            oredFilters.push({
                property: 'Owner',
                value: context.getUser().UserName
            });
            var actUser = this.getSetting('globalUser');
            if ( actUser && (actUser.length > 0)) {
                oredFilters.push({
                    property: 'Owner',
                    value: actUser
                });
            }
            filters.push(Rally.data.wsapi.Filter.or(oredFilters));
        }
        filters.push({
                    property: 'ScheduleState.Name',
                    operator: '!=',
                    value: 'Live'
                }
               ,{
                    property: 'StoryType',
                    operator: '=',
                    value: 'Risk'
                }
            );
        var ds = Ext.create('Rally.data.wsapi.TreeStoreBuilder').build({
            models: [model.prettyTypeName],
            autoLoad: true,
            filters: filters,
            enableHierarchy: true
        }).then({
            success: function(store) {
                app.add( {
                    xtype: 'rallygridboard',
                    itemId: 'story-grid',
                    context: context,
                    modelNames: [model.prettyTypeName],
                    toggleState: 'grid',
                    stateful: false,
                    gridConfig: {
                        columnCfgs: app.getColumnCfgs(),
                        store: store
                    },
                    scope: app,
                    height: app.getHeight() - 100
                });
            }
        });
    },
    getColumnCfgs: function(){
        var app = this;
        if (this.isExternal()) {
			config_obj = Ext.JSON.decode(this.formConfigurationSettings);
        }
        else {
            config_obj = Ext.JSON.decode(this.getSetting('formConfigurationSettings'));
        }
        // I am sure there are better ways to do this, but it works....
        var fieldList = {};
        for ( key in config_obj) {
            if (config_obj[key].display) {
                fieldList[key] = config_obj[key];
            }
        }
        var clmns = [];
        if ( !this.getSetting('enableFormattedID')) {
            clmns.push({
                dataIndex: 'FormattedID',
                text: 'ID',
                renderer: function(item, row, record, arg4, arg5) {
                    var tpl = new Ext.XTemplate(
                        '<tpl for=".">',
                        '<span class="icon-eye-open">',
                        '</span>',
                        '<span class="applink" id={[this._getLinkId(values)]}>',
                        '{[this._getPopUp()]}',
                        '</span>',
                        '</tpl>',
                        {
                            _getLinkId: function(x,y,z) {
                                var result = Ext.id();
                                Ext.Function.defer( this.addListener,10, this, [result]);
                                return result;
                            },
                            _getPopUp: function(w,x,y,z) {
                                return item;
                            },
                            addListener: function(id) {
                                Ext.get(id).on('click', function() { app._buildForm(app.model, app.formConfiguration, record);});
                            }
                        });
                    return tpl.apply(record)
                }
            });
        }
        else {
            clmns.push('FormattedID');
        }
        clmns.push({
            dataIndex: 'PortfolioItem',
            text: 'Parent Feature',
            renderer: function( field, cell, record, row, column, view) {
                var nclass = ' class=applink';
                var name =  '<-- Click to Set -->';
                if ( record.data.Parent ) {
                    name = record.data.Parent._refObjectName;
                }
                else {
                    nclass = ' class=errorbar';
                }
                return '<div' + nclass +  '>' +  name + '</div>';
            },
            listeners: {
                click: function(view,cellObject,row,column,event,record,rowObject) {
                    Ext.create('Rally.ui.dialog.ArtifactChooserDialog', {
                        artifactTypes: [ 'PortfolioItem/Feature' ],
                        autoShow: true,
                        title: 'Choose a parent Feature' ,
                        listeners : {
                            artifactchosen: function (dialog, selectedRecord) {
                                record.set('Parent', selectedRecord.get('_ref'));
                                record.save().then({
                                    success: function() {
                                        Rally.ui.notify.Notifier.show({ message: 'Item: ' + record.get('FormattedID') + ' updated'});
                                    },
                                    failure: function (error) {
                                        Rally.ui.notify.Notifier.showError({ message: 'Failed to save item: ' + record.get('FormattedID') });
                                    }
                                })
                            }
                        }
                    });
                }
            }
        });
        if ( this.getSetting('approvalField')) {
            clmns.push({
                dataIndex: 'Project',
                text: 'LifeCycle Stage',
                renderer: function(item){
                    return item._refObjectName;
                }
            });
        }
        clmns = clmns.concat(Ext.Object.getKeys(fieldList));
        return clmns;
    },
    _onNewRequest: function() {
        this._buildForm(this.model, this.formConfiguration)
    },
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    _isFieldAllowed: function(field){
        var forbiddenTypes = ['WEB_LINK'];
        if (Ext.Array.contains(this.notAllowedFields, field.name)){
            return false;
        }
        if (field.readOnly === true || field.hidden === true){
            return false;
        }
        if (field && !field.attributeDefinition){
            return false;
        }
        //Not showing Weblinks for now
        if (Ext.Array.contains(forbiddenTypes, field.attributeDefinition.AttributeType)){
            return false;
        }
        return true;
    },
    getSettingsFields: function() {
        var app = this;
        var formModel = this.formModel;
        var fields = {};
        var configJSON = {};
        if (this.isExternal()){
			configJSON = this.formConfigurationSettings;
        }
        else {
            configJSON = this.getSetting('formConfigurationSettings');
        }
        if ( !_.isEmpty(configJSON)) {
            fields = Ext.JSON.decode( configJSON );
        } else {
            if (formModel){
                modelFields = formModel.getFields();
                var order = 1;
                _.each(modelFields, function(f){
                    if (this._isFieldAllowed(f)){
                        var dsp = f.required || false,
                            def_value = f.defaultValue || '',
                            req = f.required || false,
                            edt = f.required || false;
                        fields[f.name] = { displayName: f.displayName, fieldName: f.name, display: dsp, inedit: edt, required: req, order: order++};
                    }
                }, this);
            }
        }
        var returned = [{
            name: 'formInstructions',
            xtype: 'textareafield',
            fieldLabel: 'Form Instructions',
            labelAlign: 'top',
            autoShow: true,
            width: '100%',
            margin: 15,
            height: 100
        },{
            name: 'formConfigurationSettings',
            xtype: 'tsformconfigsettings',
            fieldLabel: 'Drag rows to specify order on the form. Remember to "leave" the field for it to store!',
            margin: 15,
            labelAlign: 'top',
            fields: fields
        },
        {
            name: 'enableFormattedID',
            xtype: 'rallycheckboxfield',
            fieldLabel: 'Show ID as hyperlink',
            labelAlign: 'top'
        },
        {
            name: 'enableUserFilter',
            xtype: 'rallycheckboxfield',
            fieldLabel: 'Filter to login user',
            labelAlign: 'top'
        },
        {
            name: 'globalUser',
            xtype: 'rallyusercombobox',
            allowClear: true,
            fieldLabel: 'LCT username',
            labelAlign: 'top'
        },
        {
            name: 'approvalField',
            xtype: 'rallycheckboxfield',
            fieldLabel: 'Show project node as approval stage',
            labelAlign: 'top'
        },
        {
            name: 'submitDirectory',
            xtype: 'rallyprojectscopefield',
            labelAlign: 'top',
            fieldLabel: 'Target "submit on ready" project'
        }];
        return returned;
    },
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        Ext.apply(this, settings);
        if (this.isExternal()){
            this.saveExternalAppSettings(this.externalAppSettingsKey, settings);
            this.formConfiguration = Ext.JSON.decode(settings.formConfigurationSettings);
        } else {
            this.saveInternalAppSettings();
        }
        this._prepareApp();
    },
    saveExternalAppSettings: function(key, settings){
        var prefs = {};
        _.each(settings, function(val, setting_key){
            var pref_key = key + '.' + setting_key;
            prefs[pref_key] = val;
        });
        Rally.data.PreferenceManager.update({
//            project: this.getContext().getProject()._ref,
            settings: prefs,
            scope: this,
            success: function(updatedRecords, notUpdatedRecords) {
            }
        });
    },
    getExternalAppSettings: function(key){
        Rally.data.PreferenceManager.load({
//            project: this.getContext().getProject()._ref,
            additionalFilters: [{
                property: 'name',
                operator: 'contains',
                value: key
            }],
            scope: this,
            cache: false,
            success: function(prefs) {
                _.each(prefs, function(val, pref_name){
                    if (/\.formInstructions$/.test(pref_name)){
                        this.formInstructions = val;
                    }
                    if (/\.formConfigurationSettings$/.test(pref_name)){
                        if (val && !_.isEmpty(val)){
                            this.formConfigurationSettings = val;
                        }
                    }
                }, this);
                this.formConfiguration = Ext.JSON.decode(this.formConfigurationSettings);
                this._prepareApp();
            }
        });
    },
    getInternalAppSettings: function() {
        this.formConfiguration = Ext.JSON.decode(this.formConfigurationSettings);
    },
    saveInternalAppSettings: function() {
        this.setSettings();
    }
});
