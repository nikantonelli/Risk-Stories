Ext.define('Rally.technicalservices.BooleanFieldComboBox',{
    extend: 'Rally.ui.combobox.FieldComboBox',
    alias: 'widget.tsbooleanfieldcombobox',

    _isNotHidden: function(field) {
        return (!field.hidden && field.attributeDefinition && field.attributeDefinition.AttributeType == 'BOOLEAN');
    }
});

Ext.define('Rally.technicalservices.settings.FormConfiguration',{
    extend: 'Ext.form.field.Base',
    alias: 'widget.tsformconfigsettings',
    config: {
        value: undefined,
        fields: undefined,
        decodedValue: {}
    },

    fieldSubTpl: '<div id="{id}" class="settings-grid"></div>',
    noDefaultValue: ['Attachments'],

    width: '100%',
    cls: 'column-settings',

    onDestroy: function() {
        if (this._grid) {
            this._grid.destroy();
            delete this._grid;
        }
        this.callParent(arguments);
    },


    onRender: function() {

        var decodedValue = {};
        if (this.value && !_.isEmpty(this.value)){
            decodedValue = Ext.JSON.decode(this.value);
        }
        this.callParent(arguments);

        var data = [];
        var formData = [];

        _.each(this.fields, function(f){
                data.push({order: f.order, fieldName: f.fieldName, displayName: f.displayName, display: f.display, inedit: f.inedit, required: f.required });
        }, this);

        this._store = Ext.create('Ext.data.Store', {
            fields: ['order', 'fieldName', 'displayName', 'display', 'inedit','required','fieldObj'],
            data: data,
            sortOnFilter: false,
            sortOnLoad: true,
            sorters: [{
                property: 'order',
                value: 'ASC'
            }]
        });

        this._grid = Ext.create('Rally.ui.grid.Grid', {
            autoWidth: true,
            renderTo: this.inputEl,
            columnCfgs: this._getColumnCfgs(),
            showPagingToolbar: false,
            showRowActionsColumn: false,
            store: this._store,
            height: 400,
            width: this.getWidth() * 0.90,
            editingConfig: {
                publishMessages: false
            },
            viewConfig: {
                plugins: {
                    ptype: 'gridviewdragdrop',
                    dragText: 'Drag and drop to reorder'
                }
            }
        });
    },

    _getColumnCfgs: function() {
        var me = this;

        var columns = [
            {
                text: 'Field',
                dataIndex: 'displayName',
                flex: 1
            },
            {
                text: 'Show in View',
                dataIndex: 'display',
                align: 'center',
                renderer: function (value) {
                    return value === true ? 'Yes' : 'No';
                },
                editor: {
                    xtype: 'rallycombobox',
                    displayField: 'name',
                    valueField: 'value',
                    editable: false,
                    storeType: 'Ext.data.Store',
                    storeConfig: {
                        remoteFilter: false,
                        fields: ['name', 'value'],
                        data: [
                            {'name': 'Yes', 'value': true},
                            {'name': 'No', 'value': false}
                        ]
                    }
                }
            },
            {
                text: 'Show in Edit',
                dataIndex: 'inedit',
                align: 'center',
                renderer: function (value) {
                    return value === true ? 'Yes' : 'No';
                },
                editor: {
                    xtype: 'rallycombobox',
                    displayField: 'name',
                    valueField: 'value',
                    editable: false,
                    storeType: 'Ext.data.Store',
                    storeConfig: {
                        remoteFilter: false,
                        fields: ['name', 'value'],
                        data: [
                            {'name': 'Yes', 'value': true},
                            {'name': 'No', 'value': false}
                        ]
                    }
                }
            },
            {
                text: 'Required',
                dataIndex: 'required',
                align: 'center',
                renderer: function (value) {
                    return value === true ? 'Yes' : 'No';
                },
                editor: {
                    xtype: 'rallycombobox',
                    displayField: 'name',
                    valueField: 'value',
                    editable: false,
                    storeType: 'Ext.data.Store',
                    storeConfig: {
                        remoteFilter: false,
                        fields: ['name', 'value'],
                        data: [
                            {'name': 'Yes', 'value': true},
                            {'name': 'No', 'value': false}
                        ]
                    }
                }
            }

        ];
        return columns;
    },
    _isAllowedDefaultValue: function(record){

        var noDefaultValue = ['Attachments'];
        if (Ext.Array.contains(noDefaultValue, record.get('fieldName'))){
            return false;
        }
        return true;
    },
    showEditor: function(record){
        Ext.create('Rally.technicalservices.DynamicCellEditor',{
            record: record,
            context: Rally.getApp().getContext()
        });
    },
    /**
     * When a form asks for the data this field represents,
     * give it the name of this field and the ref of the selected project (or an empty string).
     * Used when persisting the value of this field.
     * @return {Object}
     */
    getSubmitData: function() {
        var data = {};

        data[this.name] = Ext.JSON.encode(this._buildSettingValue());
        return data;
    },
    _buildSettingValue: function() {
        var mappings = {};

        var order = 0;
        this._store.each(function(record) {
                mappings[record.get('fieldName')] = {
                    display: record.get('display'),
                    displayName: record.get('displayName'),
                    fieldName: record.get('fieldName'),
                    defaultValue: record.get('defaultValue'),
                    inedit: record.get('inedit'),
                    required: record.get('required'),
                    order: order++
                };
        }, this);
        return mappings;
    },

    getErrors: function() {
        var errors = [];
        if (_.isEmpty(this._buildSettingValue())) {
           errors.push('At least one field must be shown.');
        }
        return errors;
    },
    validate : function() {
        var me = this,
            isValid = me.isValid();
        if (isValid !== me.wasValid) {
            me.wasValid = isValid;
            me.fireEvent('validitychange', me, isValid);
        }
        if (!isValid){
            var html = this.getErrors().join('<br/>');
            Ext.create('Rally.ui.tooltip.ToolTip', {
                target : this.getEl(),
                html: '<div class="tsinvalid">' + html + '</div>',
                autoShow: true,
                anchor: 'bottom',
                destroyAfterHide: true
            });

        }

        return isValid;
    },
    setValue: function(value) {
        this.callParent(arguments);
        this._value = value;
    }
});
